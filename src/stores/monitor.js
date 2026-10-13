import { defineStore } from 'pinia'
import { api } from '../api'
import { sampleMetrics, evalAlerts, DEFAULT_RULES } from '../monitor.js'
import { useNet } from './net'
import { useUi } from './ui'

// badKount modul-level: hidup lintas polling agar aturan "berturut-turut" akurat
const badKount = new Map()
let timer = null
const RULE_LABEL = { 'link-down': 'Kabel DOWN', 'no-ip': 'Tanpa IP' }

export const useMonitor = defineStore('monitor', {
  state: () => ({
    rules: JSON.parse(localStorage.getItem('ml.rules') || 'null') || DEFAULT_RULES.map(r => ({ ...r })),
    on: false,
    interval: 5,               // detik
    history: {},               // devId -> [{t, up, total}]
    alerts: [],                // [{rule, dev, name, text, t}]
    summary: null              // sample terakhir
  }),
  getters: {
    devCount: s => Object.keys(s.summary?.devices || {}).length
  },
  actions: {
    toggleRule(id) {
      const r = this.rules.find(x => x.id === id)
      if (!r) return
      r.on = !r.on
      localStorage.setItem('ml.rules', JSON.stringify(this.rules))
    },
    sample(net) {
      const s = sampleMetrics(net)
      this.summary = s
      for (const [id, m] of Object.entries(s.devices)) {
        const h = (this.history[id] ||= [])
        h.push({ t: s.t, up: m.up, total: m.total })
        if (h.length > 300) h.splice(0, h.length - 300)
      }
      const ui = useUi()
      for (const f of evalAlerts(this.rules, s, badKount)) {
        const name = net.devices[f.dev]?.name || f.dev
        this.alerts.unshift({ ...f, name, t: s.t })
        this.alerts = this.alerts.slice(0, 50)
        ui.notify(`${name}: ${RULE_LABEL[f.rule] || f.rule} — ${f.text}`, 'error')
      }
      if (net.token) {
        // Ingest ke server agar riwayat bisa dibaca dari perangkat lain; kegagalan diabaikan
        api('/metrics', {
          method: 'POST', token: net.token,
          body: { samples: Object.entries(s.devices).map(([dev, m]) => ({ t: s.t, dev, up: m.up, total: m.total, hasIp: m.hasIp })) }
        }).catch(() => {})
      }
    },
    start(net) {
      if (this.on) return
      this.on = true
      this.sample(net)
      timer = setInterval(() => this.sample(net), Math.max(2, this.interval) * 1000)
    },
    stop() {
      this.on = false
      if (timer) { clearInterval(timer); timer = null }
    },
    setIntervalSec(net, sec) {
      this.interval = Math.max(2, Math.min(300, sec | 0))
      if (this.on) { this.stop(); this.start(net) }
    },
    async backfill() {
      const net = useNet()
      if (!net.token) return
      try {
        const r = await api('/metrics?since=3600000', { token: net.token })
        const oneHourAgo = Date.now() - 3600_000
        for (const it of r.items || []) {
          if (it.ts < oneHourAgo) continue
          const h = (this.history[it.dev] ||= [])
          if (!h.some(x => x.t === it.ts && x.up === it.up)) h.push({ t: it.ts, up: it.up, total: it.total })
        }
        for (const k of Object.keys(this.history)) this.history[k].sort((a, b) => a.t - b.t)
      } catch { /* riwayat server opsional */ }
    },
    clearAlerts() { this.alerts = []; badKount.clear() }
  }
})
