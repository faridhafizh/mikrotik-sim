import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto'
// Ganti JWT_SECRET di produksi
const SECRET = process.env.JWT_SECRET || 'dev-secret-ganti-di-produksi'
const mac = b => createHmac('sha256', SECRET).update(b).digest('base64url')
export const hash = p => { const s = randomBytes(16).toString('hex'); return s + ':' + scryptSync(p, s, 32).toString('hex') }
export const verify = (p, h) => { const [s, k] = h.split(':'); return timingSafeEqual(Buffer.from(k, 'hex'), scryptSync(p, s, 32)) }
export const sign = id => { const b = Buffer.from(JSON.stringify({ id, exp: Date.now() + 7 * 864e5 })).toString('base64url'); return b + '.' + mac(b) }
export function unsign(t) {
  try {
    const [b, m] = String(t).split('.'), e = mac(b)
    if (m.length !== e.length || !timingSafeEqual(Buffer.from(m), Buffer.from(e))) return null
    const p = JSON.parse(Buffer.from(b, 'base64url'))
    return p.exp > Date.now() ? p.id : null
  } catch { return null }
}
