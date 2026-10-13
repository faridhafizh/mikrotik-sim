export const hex = (n, pad) => (n >>> 0).toString(16).padStart(pad, '0')

// '192.168.1.10/24' -> { ip, len }
export const splitAddr = a => { const [ip, l = '32'] = String(a || '').split('/'); return { ip, len: +l } }

export const maskOf = len => [0, 1, 2, 3]
  .map(i => { const b = Math.min(8, Math.max(0, len - i * 8)); return b === 0 ? 0 : (255 << (8 - b)) & 255 })
  .join('.')

// '255.255.255.0' -> 24 ; return null bila bukan mask valid
export const lenOfMask = mask => {
  const p = String(mask || '').split('.').map(Number)
  if (p.length !== 4 || p.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return null
  let n = 0, seenZero = false
  for (const o of p) {
    for (let b = 7; b >= 0; b--) {
      const bit = (o >> b) & 1
      if (bit) { if (seenZero) return null; n++ } else seenZero = true
    }
  }
  return n
}

const p2 = n => String(n).padStart(2, '0')

export const fmtTime = ts => { const d = ts instanceof Date ? ts : new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` }
export const fmtDate = ts => { const d = ts instanceof Date ? ts : new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` }

export const uptimeOf = ms => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60
  return `${h}h${m}m${sec}s`
}

// MAC gaya Windows (pisah tanda hubung)
export const winMac = m => String(m || '').replace(/:/g, '-')