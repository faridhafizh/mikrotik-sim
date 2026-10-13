export const ERROR_PREFIXES = [
  'failure:', 'bad command', 'dns:', 'dhcp:', 'SSID ', '* ', 'address tidak valid',
  'autentikasi gagal', 'bridge atau', 'di luar jangkauan', 'interface ', 'interface atau',
  'perangkat ini', 'queue type', 'tidak ada', 'tidak terhubung', 'tujuan tidak terjangkau',
  'wlan1 belum dikonfigurasi'
]

export function classify(line) {
  if (line.startsWith('> ')) return 'echo'
  if (line.startsWith('#  ') || line.startsWith('    DST-ADDRESS')) return 'head'
  if (line.startsWith('perintah: ')) return 'hint'
  // RouterOS '100% packet loss' dan CMD Windows '100% loss' / 'Request timed out.'
  if (/100%\s*(packet\s*)?loss/.test(line) || line.startsWith('Request timed out.') || ERROR_PREFIXES.some(p => line.startsWith(p))) return 'error'
  if (/^reply from/i.test(line) || /^(tx:|rx:|ok$)/.test(line) || /0%\s*(packet\s*)?loss/.test(line)
    || line.startsWith('Trace complete.') || line.startsWith('Operasi Berhasil!')) return 'ok'
  if (/ (running|no link|disabled)$/.test(line)) return / running/.test(line) ? 'ok' : 'dim'
  return ''
}

// updated_at SQLite = CURRENT_TIMESTAMP (UTC tanpa sufiks zona) → parse sebagai UTC
export function relTime(ts, now = Date.now()) {
  const t = Date.parse(String(ts ?? '').replace(' ', 'T') + 'Z')
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'baru saja'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

export const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
