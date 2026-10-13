import { defineStore } from 'pinia'
import { exec } from '../engine'
import { api } from '../api'
import { useUi } from './ui'
import { NOTE_COLORS, NOTE_MIN_W, NOTE_MIN_H } from '../zoom'
import { CABLE_TYPES, buildIfaces, defaultProfileFor, isCableKind, isCableType, linkStatus, migrateTopo, profileById } from '../linkmodel.js'
import { topoSummary } from '../versions.js'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let n = 0
let m = 0
const MAX_HIST = 50
// validateTopo murni (mirror okTopo server/index.js:11 + cek field device/link)
export function validateTopo(t) {
  const td = t && t.data && validateTopo(t.data) ? t.data : null
  if (td) return true
  if (!t || typeof t.devices !== 'object' || !t.devices || Array.isArray(t.devices) || !Array.isArray(t.links)) return false
  const ids = Object.keys(t.devices)
  if (ids.length > 60 || t.links.length > 200) return false
  for (const id of ids) {
    const d = t.devices[id]
    if (!d || typeof d.id !== 'string' || typeof d.type !== 'string' || typeof d.x !== 'number' || typeof d.y !== 'number' || typeof d.name !== 'string' || !Array.isArray(d.ifaces) || !Array.isArray(d.routes)) return false
    for (const i of d.ifaces) if (i && i.kind !== undefined && !isCableKind(i.kind)) return false
  }
  for (const l of t.links) {
    if (!l || !l.a || !l.b || typeof l.a.dev !== 'string' || typeof l.a.if !== 'string' || typeof l.b.dev !== 'string' || typeof l.b.if !== 'string') return false
    if (l.cable !== undefined && !isCableType(l.cable)) return false
  }
  if (t.notes !== undefined) {
    if (!t.notes || typeof t.notes !== 'object' || Array.isArray(t.notes)) return false
    const nks = Object.keys(t.notes)
    if (nks.length > 30) return false
    for (const k of nks) {
      const z = t.notes[k]
      if (!z || typeof z.id !== 'string' || typeof z.title !== 'string' || typeof z.x !== 'number' || typeof z.y !== 'number' || typeof z.w !== 'number' || typeof z.h !== 'number' || typeof z.color !== 'string') return false
      if (z.title.length > 60) return false
      if (!Number.isFinite(z.x) || !Number.isFinite(z.y)) return false
      if (!Number.isFinite(z.w) || !Number.isFinite(z.h) || z.w < 40 || z.w > 2000 || z.h < 40 || z.h > 2000) return false
      if (!NOTE_COLORS.includes(z.color)) return false
    }
  }
  return true
}
const PFX = { router: 'R', switch: 'SW', pc: 'PC', server: 'SRV', laptop: 'LT' }
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export const useNet = defineStore('net', {
  state: () => {
    const sv = JSON.parse(localStorage.getItem('ml') || 'null')
    return { devices: {}, links: [], notes: {}, selected: null, selectedNote: null, tool: 'select', from: null, term: {}, packet: null, api: 'unknown', dirty: false, token: sv?.t || '', user: sv?.u || '', labs: [], activeLab: 'lab1', results: {}, topologies: [], done: [], curId: null, past: [], future: [], traceOverlay: null, stats: {}, stepResults: {}, versions: [] }
  },
  actions: {
    note(text, kind) { useUi().notify(text, kind) },
    commit() { this.past.push(this.snap()); if (this.past.length > MAX_HIST) this.past.shift(); this.future = []; this.dirty = true },
    undo() { if (!this.past.length) { this.note('Tidak ada riwayat untuk diurungkan', 'info'); return }; this.future.push(this.snap()); this.restore(this.past.pop()) },
    redo() { if (!this.future.length) { this.note('Tidak ada riwayat untuk diulangi', 'info'); return }; this.past.push(this.snap()); this.restore(this.future.pop()) },
    add(type, x, y, name, profileId) {
      this.commit()
      const d = {
        id: 'd' + ++n, type, x, y,
        name: name || PFX[type] + (Object.values(this.devices).filter(v => v.type === type).length + 1),
        ifaces: [], routes: [], routes6: [], dns6: null
      }
      if (type === 'laptop') {
        d.ifaces = [{ name: 'wlan0', addr: null }]
      } else {
        d.profileId = profileById(profileId)?.type === type ? profileId : defaultProfileFor(type)
        d.ifaces = buildIfaces(d.profileId)
      }
      if (type === 'switch') d.stp = 'yes'
      this.devices[d.id] = d
      this.selected = d.id
    },
    seed(force = false) {
      if (!force && Object.keys(this.devices).length) return
      this.add('pc', 120, 200, 'PC1'); this.add('router', 330, 200, 'R1'); this.add('pc', 540, 200, 'PC2')
      this.selected = null; this.past = []; this.future = []; this.dirty = false
    },
    pick(id) {
      if (!this.from) { this.from = id; return }
      if (this.from !== id) useUi().openModal({ kind: 'link', title: 'Hubungkan perangkat', aId: this.from, bId: id })
      this.from = null
    },
    connect(a, portA, b, portB, cable) {
      const A = this.devices[a], B = this.devices[b]
      const valid = (dev, name) => !!dev && dev.ifaces.some(i => i.name === name && i.kind)
      if (!valid(A, portA) || !valid(B, portB)) { this.note('Port tidak valid', 'error'); return }
      const used = (id, name) => this.links.some(l => (l.a.dev === id && l.a.if === name) || (l.b.dev === id && l.b.if === name))
      if (used(a, portA) || used(b, portB)) { this.note('Port sudah terpakai', 'error'); return }
      if (!isCableType(cable)) { this.note('Jenis kabel tidak valid', 'error'); return }
      this.commit()
      const link = { a: { dev: a, if: portA }, b: { dev: b, if: portB }, cable }
      this.links.push(link)
      const st = linkStatus(this, link)
      this.note(`Terhubung: ${A.name} ${portA} ↔ ${B.name} ${portB} (${CABLE_TYPES[cable].label})` + (st.up ? '' : ' — DOWN (medium mismatch)'), st.up ? 'success' : 'info')
    },
    async setProfile(devId, profileId) {
      const d = this.devices[devId], p = profileById(profileId)
      if (!d || !p || p.type !== d.type || d.type === 'laptop' || d.profileId === profileId) return
      const next = buildIfaces(profileId)
      const old = new Map((d.ifaces || []).map(i => [i.name, i]))
      const ifaces = next.map(i => { const o = old.get(i.name); return o?.addr ? { ...i, addr: o.addr } : { ...i } })
      const names = new Set(ifaces.map(i => i.name))
      // vlan/bridge di luar profil dipertahankan bila tidak merujuk nama yang hilang
      const extra = (d.ifaces || []).filter(i => !names.has(i.name) && (i.vlan ? names.has(i.parent) : i.members ? (i.members || []).every(m => names.has(m)) : false))
      const combined = [...ifaces, ...extra]
      const live = new Set(combined.map(i => i.name))
      const dropped = this.links.filter(l => (l.a.dev === devId && !live.has(l.a.if)) || (l.b.dev === devId && !live.has(l.b.if)))
      if (dropped.length && !await useUi().ask({ title: 'Ganti profil?', body: `${dropped.length} kabel akan dibuang karena port-nya tidak ada di profil baru.`, confirm: 'Ganti' })) return
      this.commit()
      d.profileId = profileId
      d.ifaces = combined
      if (d.ports) for (const k of Object.keys(d.ports)) if (!live.has(k)) delete d.ports[k]
      this.links = this.links.filter(l => !dropped.includes(l))
      this.note(dropped.length ? `${dropped.length} kabel dibuang: port tidak ada` : `Profil ${p.label} dipasang di ${d.name}`, dropped.length ? 'info' : 'success')
    },
    setPortKind(devId, ifName, kind) {
      const d = this.devices[devId]
      const i = d?.ifaces?.find(x => x.name === ifName)
      if (!i || !i.kind || !isCableKind(kind) || i.kind === kind) return
      this.commit()
      i.kind = kind
    },
    remove(id) {
      const name = this.devices[id]?.name
      this.commit()
      delete this.devices[id]
      delete this.term[id]
      this.links = this.links.filter(l => l.a.dev !== id && l.b.dev !== id)
      if (this.selected === id) this.selected = null
      this.note('Perangkat ' + name + ' dihapus', 'info')
    },
    rename(id, name) {
      this.commit()
      this.devices[id].name = String(name).slice(0, 40)
      this.note('Nama perangkat diubah menjadi ' + this.devices[id].name, 'success')
    },
    clearTerm(id) { this.term[id] = [] },
    async run(line) {
      const d = this.devices[this.selected]
      if (!d) return
      this.commit()
      const r = exec(this, d, line)
      // cls / system reboot: terminal direset (perintah + hasil tetap tampil)
      if (r.clear && this.term[d.id]) this.term[d.id].length = 0
      const t = (this.term[d.id] ??= [])
      t.push('> ' + line)
      t.push(...r.out)
      if (r.anim) {
        this.traceOverlay = { path: r.anim, hops: r.hops || [], ok: r.ok, dstLabel: line }
        const st = (this.stats[d.id] ??= { ping: [], speed: [] })
        const times = r.out.map(l => /time=(\d+)ms/.exec(l)?.[1]).filter(Boolean).map(Number)
        if (times.length) st.ping = [...st.ping, ...times].slice(-20)
        const tx = /^tx: ([\d.]+) Mbps/.exec(r.out[0] || '')?.[1], rx = /^rx: ([\d.]+) Mbps/.exec(r.out[1] || '')?.[1]
        if (tx != null && rx != null) st.speed = [...st.speed, { tx: +tx, rx: +rx }].slice(-20)
      }
      if (r.anim) await this.animate(r.anim, r.ok)
    },
    async animate(path, ok) {
      if (reduceMotion()) {
        const d = this.devices[path[path.length - 1]]
        this.packet = d ? { x: d.x, y: d.y, ok } : null
        await sleep(300)
        this.packet = null
        return
      }
      for (const id of path) {
        const d = this.devices[id]
        if (!d) break
        this.packet = { x: d.x, y: d.y, ok }
        await sleep(420)
      }
      this.packet = null
    },
    async call(path, opt) {
      try {
        const r = await api(path, { ...opt, token: this.token })
        this.api = 'up'
        return r
      } catch (e) {
        this.api = 'down'
        const m = e.message === 'Failed to fetch' ? 'Backend belum aktif (jalankan pnpm dev:api)' : e.message
        this.note(m, 'error')
        if (opt?.throwOnError) throw new Error(m)
        if (e.message === 'Belum login') this.logout()
        return null
      }
    },
    snap() { return JSON.parse(JSON.stringify({ devices: this.devices, links: this.links, notes: this.notes })) },
    restore(t) {
      // undo mengembalikan topologi saja; log terminal (term) disengaja tidak di-snapshot
      const src = t || {}
      migrateTopo({ devices: src.devices, links: src.links })
      this.devices = src.devices || {}; this.links = src.links || []; this.notes = src.notes || {}; this.selected = null; this.selectedNote = null; this.term = {}
      this.traceOverlay = null
      n = Math.max(n, ...Object.keys(this.devices).map(k => +k.slice(1) || 0))
      m = Math.max(m, ...Object.keys(this.notes).map(k => /^z(\d+)$/.exec(k)?.[1] ? +RegExp.$1 : 0))
    },
    addNote({ title, x, y, w, h, color }) {
      this.commit()
      const id = 'z' + ++m
      this.notes[id] = { id, title: String(title ?? '').slice(0, 60), x, y, w, h, color }
      this.selectedNote = id
      this.selected = null
    },
    resizeNote(id, w, h) {
      const z = this.notes[id]
      if (!z) return
      z.w = Math.min(2000, Math.max(NOTE_MIN_W, Number.isFinite(w) ? w : NOTE_MIN_W))
      z.h = Math.min(2000, Math.max(NOTE_MIN_H, Number.isFinite(h) ? h : NOTE_MIN_H))
    },
    renameNote(id, title) {
      const z = this.notes[id]
      if (!z) return
      this.commit()
      z.title = String(title ?? '').slice(0, 60)
    },
    setNoteColor(id, color) {
      const z = this.notes[id]
      if (!z || !NOTE_COLORS.includes(color)) return
      this.commit()
      z.color = color
    },
    removeNote(id) {
      if (!this.notes[id]) return
      this.commit()
      delete this.notes[id]
      if (this.selectedNote === id) this.selectedNote = null
    },
    noteToFront(id) {
      const z = this.notes[id]
      if (!z) return
      this.commit()
      const rest = { ...this.notes }
      delete rest[id]
      this.notes = { ...rest, [id]: z }
    },
    noteToBack(id) {
      const z = this.notes[id]
      if (!z) return
      this.commit()
      const rest = { ...this.notes }
      delete rest[id]
      this.notes = { [id]: z, ...rest }
    },
    exportFile() {
      const data = JSON.stringify(this.snap(), null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mikrolab-topologi.json'; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      this.note('Topologi diekspor', 'success')
    },
    importData(t) {
      if (t && t.data && validateTopo(t.data)) t = t.data
      if (!validateTopo(t)) { this.note('File topologi tidak valid', 'error'); return false }
      this.commit()
      const ids = Object.keys(t.devices), map = {}
      ids.forEach((old, i) => { map[old] = 'd' + (i + 1) })
      const devices = {}
      for (const old of ids) devices[map[old]] = { ...t.devices[old], id: map[old] }
      const links = []
      let dropped = 0
      for (const l of t.links) {
        const ad = map[l.a.dev], bd = map[l.b.dev]
        const A = devices[ad], B = devices[bd]
        if (!A || !B || !A.ifaces.some(i => i.name === l.a.if) || !B.ifaces.some(i => i.name === l.b.if)) { dropped++; continue }
        links.push({ a: { dev: ad, if: l.a.if }, b: { dev: bd, if: l.b.if }, cable: isCableType(l.cable) ? l.cable : 'cat6' })
      }
      migrateTopo({ devices, links })
      this.restore({ devices, links, notes: t.notes ? JSON.parse(JSON.stringify(t.notes)) : {} })
      n = ids.length
      this.curId = null; this.dirty = false
      if (dropped) this.note(`${dropped} link dibuang: port tidak ada`, 'info')
      this.note('Topologi diimpor', 'success'); return true
    },
    async importFile(file) {
      if (!file) return false
      try { return this.importData(JSON.parse(await file.text())) }
      catch { this.note('File JSON rusak', 'error'); return false }
    },
    async boot() {
      this.labs = (await this.call('/labs'))?.labs || []
      const h = location.hash.match(/^#\/s\/(\w+)/)
      if (h) { const r = await this.call('/shared/' + h[1]); if (r) { this.commit(); this.restore(r.data); this.note('Topologi bersama: ' + r.name, 'info') } }
      if (this.token) await this.refresh()
    },
    async refresh() {
      const [a, b] = await Promise.all([this.call('/topologies'), this.call('/progress')])
      if (a) this.topologies = a.items
      if (b) this.done = b.passed
    },
    async auth(mode, username, password) {
      // throwOnError: pemanggil menampilkan pesan server secara inline (toast tetap muncul dari call())
      const r = await this.call('/' + mode, { method: 'POST', body: { username, password }, throwOnError: true })
      this.token = r.token; this.user = r.username
      localStorage.setItem('ml', JSON.stringify({ t: r.token, u: r.username }))
      this.note('Halo, ' + r.username, 'success')
      await this.refresh()
    },
    logout() { this.token = ''; this.user = ''; this.topologies = []; this.done = []; this.curId = null; localStorage.removeItem('ml') },
    async save(name) {
      const data = this.snap()
      const body = { name: this.curId ? null : (name || 'Topologi').slice(0, 80), data, summary: topoSummary(data) }
      const r = this.curId ? await this.call('/topologies/' + this.curId, { method: 'PUT', body }) : await this.call('/topologies', { method: 'POST', body })
      if (r) { this.curId = r.id; this.dirty = false; this.note('Tersimpan', 'success'); await this.refresh(); await this.loadVersions() }
    },
    async loadVersions() {
      if (!this.curId || !this.token) { this.versions = []; return }
      const r = await this.call('/topologies/' + this.curId + '/versions')
      this.versions = r?.items || []
    },
    async restoreVersion(ver) {
      if (!this.curId) return
      const ok = await useUi().ask({ title: 'Pulihkan versi ' + ver + '?', body: 'Kanvas saat ini akan diganti. Versi saat ini otomatis disimpan agar bisa kembali.', confirm: 'Pulihkan' })
      if (!ok) return
      const r = await this.call(`/topologies/${this.curId}/restore/${ver}`, { method: 'POST' })
      if (!r) return
      this.importData(r.data)
      this.curId = r.id
      this.dirty = false
      this.note('Versi ' + ver + ' dipulihkan', 'success')
      await this.loadVersions()
    },
    async load(id) {
      const r = await this.call('/topologies/' + id)
      if (r) { this.commit(); this.restore(r.data); this.curId = id; this.dirty = false; this.note('Dimuat: ' + r.name, 'success'); await this.loadVersions() }
    },
    async share() {
      if (!this.curId) await this.save()
      if (!this.curId) return
      const r = await this.call(`/topologies/${this.curId}/share`, { method: 'POST' })
      if (!r) return
      const url = `${location.origin}/#/s/${r.slug}`
      try { await navigator.clipboard.writeText(url) } catch {
        await useUi().askText({ title: 'Tautan berbagi', label: 'Salin tautan ini', value: url, max: 200 })
        return
      }
      this.note('Tautan disalin: ' + url, 'success')
    },
    async delTopo(id) {
      if (await this.call('/topologies/' + id, { method: 'DELETE' })) { if (this.curId === id) this.curId = null; this.note('Topologi dihapus', 'success'); await this.refresh() }
    },
    seedLab(l) { this.commit(); this.restore(JSON.parse(JSON.stringify(l.seed))); this.curId = null; this.note('Topologi awal dimuat', 'info') },
    async applyTemplate(id) {
      const { TEMPLATES } = await import('../templates.js')
      const t = TEMPLATES.find(x => x.id === id)
      if (!t) return
      const load = () => { this.commit(); this.restore(JSON.parse(JSON.stringify(t.build()))); this.curId = null; this.dirty = false; this.note('Template dimuat', 'info') }
      if (Object.keys(this.devices).length) {
        const ok = await useUi().ask({ title: 'Ganti topologi?', body: 'Kanvas yang berisi akan ditimpa template.', confirm: 'Ganti' })
        if (ok) load()
        return
      }
      load()
    },
    async checkLab(id) {
      const r = await this.call(`/labs/${id}/check`, { method: 'POST', body: { topology: this.snap() } })
      if (!r) return
      this.results = { ...this.results, [id]: r.results }
      this.stepResults = { ...this.stepResults, [id]: r.steps || [] }
      const store = (() => { try { return JSON.parse(localStorage.getItem('ml.stepdone') || '{}') } catch { return {} } })()
      let lead = 0
      for (const s of r.steps || []) { if (s.results.every(x => x.ok)) lead++; else break }
      store[id] = Math.max(store[id] || 0, lead)
      try { localStorage.setItem('ml.stepdone', JSON.stringify(store)) } catch {}
      if (r.passed && !this.done.includes(id)) this.done.push(id)
      this.note(r.passed ? 'Lab lulus!' : 'Belum lulus, cek daftar syarat', r.passed ? 'success' : 'info')
    }
  }
})
