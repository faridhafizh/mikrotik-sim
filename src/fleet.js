// Runner skrip massal (fleet): satu perintah untuk banyak perangkat.
// Murni, tanpa Vue/DOM — dipakai store fleet.js dan tests/fleet.test.js.

// Variabel dari textarea "key=value" per baris; baris kosong/diabaikan bila tanpa '='.
export function parseVars(text) {
  const vars = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    if (!k) continue
    vars[k] = line.slice(i + 1).trim()
  }
  return vars
}

const validVar = k => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)

// Substitusi {{var}}; kembalikan {out, missing: [nama var tanpa nilai]}
export function renderScript(script, vars) {
  const v = vars || {}
  const missing = []
  const out = String(script || '').replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_, k) => {
    if (v[k] == null || v[k] === '') { missing.push(k); return '' }
    return String(v[k])
  })
  return { out, missing: [...new Set(missing)] }
}

// Baris skrip: buang komentar (#) dan baris kosong
export function scriptLines(script) {
  return String(script || '').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
}

// Perintah yang mengubah konfigurasi (bukan sekadar print/help/ping)
const CHANGING = /^(ip\s+address\s+add|ip\s+route\s+add|ip\s+dhcp|ip\s+dns|ip\s+pool|ip\s+firewall|ipv6\s+(address|route)\s+add|interface\s+(set|bridge|vlan|wireless)|routing\s+(rip|ospf)|queue\s+\w+\s+add|system\s+identity|vlan\s+)/i

// true bila skrip memuat minimal satu perintah yang mengubah konfigurasi
export function scriptChanges(script) {
  return scriptLines(String(script || '')).some(l => CHANGING.test(l.replace(/^\//, '')))
}

// Jalankan skrip pada sekumpulan perangkat lewat engine exec.
// net = store net (dibutuhkan exec); ids = daftar id device;
// execFn = (dev, line) => {out, ok?} dari engine exec.
// Kembalikan {missing, badVar, results: [{id, name, ok, lines, changed}]}
export function runFleet(net, ids, script, vars, execFn) {
  const { out, missing } = renderScript(script, vars)
  const badVar = Object.keys(vars || {}).find(k => !validVar(k))
  // tidak ada var tanpa nilai dan nama var valid: boleh jalan
  if (badVar || missing.length) return { missing, badVar: badVar || null, results: [] }
  const results = []
  for (const id of ids) {
    const d = net.devices[id]
    if (!d) continue
    const lines = []
    let ok = true
    for (const line of scriptLines(out)) {
      const r = execFn(d, line)
      lines.push(...(r.out || []))
      if (r.ok === false) ok = false
    }
    const changed = scriptChanges(out)
    results.push({ id, name: d.name, ok, lines, changed })
  }
  return { missing, badVar: null, results }
}
