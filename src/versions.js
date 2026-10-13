// Ringkasan & diff versi topologi. Murni: dipakai net.js, HistoryPane.vue, tests/versions.test.js.

const count = o => Object.keys(o || {}).length

// Ringkasan singkat satu snapshot untuk daftar versi
export function topoSummary(t) {
  if (!t || typeof t !== 'object') return 'kosong'
  return `${count(t.devices)} perangkat · ${(t.links || []).length} kabel · ${count(t.notes)} catatan`
}

// Diff dua snapshot: "2 perangkat baru, 1 kabel dihapus"
export function diffSummary(a, b) {
  if (!a || !b) return topoSummary(b)
  const parts = []
  const dA = Object.keys(a.devices || {}), dB = Object.keys(b.devices || {})
  const added = dB.filter(id => !dA.includes(id)).length
  const removed = dA.filter(id => !dB.includes(id)).length
  if (added) parts.push(`+${added} perangkat`)
  if (removed) parts.push(`-${removed} perangkat`)
  const lA = (a.links || []).length, lB = (b.links || []).length
  if (lB > lA) parts.push(`+${lB - lA} kabel`)
  if (lB < lA) parts.push(`-${lA - lB} kabel`)
  const nA = count(a.notes), nB = count(b.notes)
  if (nB > nA) parts.push(`+${nB - nA} catatan`)
  if (nB < nA) parts.push(`-${nA - nB} catatan`)
  const addrChanged = dB.filter(id => dA.includes(id) && JSON.stringify(a.devices[id]?.ifaces) !== JSON.stringify(b.devices[id]?.ifaces)).length
  if (addrChanged) parts.push(`${addrChanged} interface berubah`)
  if (!parts.length) return 'tanpa perubahan'
  return parts.join(', ')
}

// Waktu relatif sederhana untuk daftar versi (tanpa dependensi)
export function timeAgo(ts) {
  const t = typeof ts === 'number' ? ts : Date.parse(String(ts).replace(' ', 'T') + (String(ts).includes('Z') || String(ts).includes('+') ? '' : 'Z'))
  if (!Number.isFinite(t)) return String(ts || '')
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return 'baru saja'
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu'
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'
  return Math.floor(s / 86400) + ' hari lalu'
}
