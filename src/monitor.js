// Aturan & sampel monitoring. Murni: dipakai stores/monitor.js, MonitoringPane.vue, tests/monitor.test.js.
import { linkStatus } from './linkmodel'

// Satu sampel kondisi seluruh topologi. up/total = jumlah kabel (satu link dihitung sekali);
// per device dihitung dari link yang menyentuhnya.
export function sampleMetrics(net, now = Date.now()) {
  const devices = {}
  for (const d of Object.values(net.devices || {})) {
    devices[d.id] = { up: 0, total: 0, hasIp: !!(d.ifaces || []).some(i => i.addr) }
  }
  let up = 0, total = 0
  for (const l of net.links || []) {
    total++
    const isUp = linkStatus(net, l).up
    if (isUp) up++
    for (const end of [l.a?.dev, l.b?.dev]) {
      const m = devices[end]
      if (!m) continue
      m.total++
      if (isUp) m.up++
    }
  }
  return { t: now, devices, up, total, noIp: Object.values(devices).filter(m => !m.hasIp).length }
}

// Aturan default. severity: 'error' = segera, 'warn' = butuh nBad berturut-turut.
export const DEFAULT_RULES = [
  { id: 'link-down', label: 'Ada kabel DOWN', severity: 'error', on: true },
  { id: 'no-ip', label: 'Perangkat tanpa IP', severity: 'warn', on: false }
]

// Evaluasi satu sampel terhadap aturan aktif.
// badKount = Map `${rule}:${dev}` -> jumlah sampel buruk berturut-turut (dimutasi untuk aturan bertingkat).
// Kembalikan fired = [{rule, dev, text}] — hanya transisi buruk pertama yang dipanggil sekali.
export function evalAlerts(rules, sample, badKount) {
  const fired = []
  const devs = Object.entries(sample.devices)
  for (const rule of rules) {
    if (!rule.on) continue
    for (const [id, m] of devs) {
      if (rule.id === 'link-down' && m.up < m.total) {
        const key = rule.id + ':' + id
        if (!badKount.get(key)) { badKount.set(key, 1); fired.push({ rule: rule.id, dev: id, text: `${m.total - m.up} dari ${m.total} kabel DOWN` }) }
      } else if (rule.id === 'no-ip' && !m.hasIp) {
        const key = rule.id + ':' + id
        const c = (badKount.get(key) || 0) + 1
        badKount.set(key, c)
        if (c === 2) fired.push({ rule: rule.id, dev: id, text: 'Tanpa alamat IP' })
      } else badKount.delete(rule.id + ':' + id)
    }
  }
  return fired
}

// Titik polyline sparkline 0..1 dari deret nilai
export function sparkPoints(values, w = 96, h = 20) {
  if (!values.length) return ''
  const max = Math.max(...values, 1), n = values.length
  return values.map((v, i) => `${(i / Math.max(1, n - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(' ')
}
