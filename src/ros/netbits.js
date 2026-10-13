// Helper jaringan murni tanpa state (IP, mask, CIDR, IPv6, laju).
// Dipakai bersama oleh engine.js dan ros/registry.js agar tidak ada import siklik.
export const n2 = ip => String(ip).split('.').reduce((a, b) => a * 256 + +b, 0)
export const toIp = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.')
export const parse = c => { const [ip, l = '32'] = String(c).split('/'); return { ip, len: +l } }
export const msk = len => (len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0)

export const inNet = (c, ip) => { const { ip: a, len } = parse(c); return ((n2(a) & msk(len)) >>> 0) === ((n2(ip) & msk(len)) >>> 0) }
export const netOf = c => { const { ip, len } = parse(c); return `${toIp((n2(ip) & msk(len)) >>> 0)}/${len}` }
export const validIp = ip => /^(\d{1,3}\.){3}\d{1,3}$/.test(ip || '') && String(ip).split('.').every(o => +o < 256)

// IPv6 format lab: heksadesimal + kompresi '::' (tanpa IPv4-mapped)
const expand6 = ip => {
  const seg = String(ip || '').split('::')
  if (seg.length > 2) return null
  const head = seg[0] ? seg[0].split(':') : []
  const tail = seg.length === 2 && seg[1] ? seg[1].split(':') : []
  if (seg.length === 1 && head.length !== 8) return null
  const miss = 8 - head.length - tail.length
  if (miss < 0 || (seg.length === 2 && miss < 1)) return null
  return [...head, ...Array(miss).fill('0'), ...tail]
}

export const validIp6 = ip => {
  const e = /^[0-9a-fA-F:]+$/.test(ip || '') && expand6(ip)
  return !!e && e.every(x => /^[0-9a-fA-F]{1,4}$/.test(x))
}

export const parse6 = c => { const [ip, l = '128'] = String(c).split('/'); return { ip, len: +l } }
const g6 = ip => expand6(ip)?.map(x => parseInt(x, 16))

export function inNet6(cidr, ip) {
  const [a, l = '128'] = String(cidr).split('/'), len = +l
  const A = g6(a), I = g6(ip)
  if (!A || !I || !(len >= 0 && len <= 128)) return false
  for (let i = 0; i < 8; i++) {
    const b = Math.min(16, Math.max(0, len - i * 16))
    const m = b === 0 ? 0 : (0xffff << (16 - b)) & 0xffff
    if ((A[i] & m) !== (I[i] & m)) return false
  }
  return true
}

export const validCidr = c => { const { ip, len } = parse(c); return validIp(ip) && len >= 0 && len <= 32 }

// '2M' -> 2 ; '500k' -> 0.5 ; null bila tidak Recognizing
export const rate = v => {
  const m = /^(\d+(?:\.\d+)?)([kmg]?)$/i.exec(String(v || ''))
  return m ? +m[1] * ({ k: .001, m: 1, g: 1000 }[m[2].toLowerCase()] ?? 1) : null
}

// Parser key=value RouterOS
export const kv = t => Object.fromEntries(t.filter(x => String(x).includes('=')).map(x => {
  const i = x.indexOf('=')
  return [x.slice(0, i), x.slice(i + 1)]
}))

// Tokenizer CLI RouterOS: "/" di depan boleh, tanda kutip menjaga spasi di dalam nilai
// sehingga comment="uplink ISP" tetap satu token (kunci=nilai).
export const tokenize = line => {
  const src = String(line).trim().replace(/^\//, '')
  const out = []
  let i = 0
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue }
    let tok = ''
    while (i < src.length && !/\s/.test(src[i])) {
      const c = src[i]
      if (c === '"' || c === "'") {
        const end = src.indexOf(c, i + 1)
        if (end < 0) { tok += c; i++; continue }
        tok += src.slice(i + 1, end); i = end + 1
        continue
      }
      tok += c; i++
    }
    out.push(tok)
  }
  return out
}

// Nilai key= yang perlu tanda kutip saat dicetak ulang (export).
export const quoteVal = v => (/[\s"]/.test(String(v)) ? `"${String(v).replace(/"/g, '')}"` : String(v))