import Fastify from 'fastify'
import { randomBytes } from 'node:crypto'
import { db } from './db.js'
import { hash, verify, sign, unsign } from './auth.js'
import { LABS, runLab, runLabSteps } from './labs.js'

const app = Fastify({ bodyLimit: 1_000_000 })
const uidOf = req => unsign((req.headers.authorization || '').slice(7))
const need = async (req, rep) => { req.uid = uidOf(req); if (!req.uid) return rep.code(401).send({ error: 'Belum login' }) }
const T = { preHandler: need }
const okTopo = t => t && typeof t.devices === 'object' && !Array.isArray(t.devices) && Array.isArray(t.links) && Object.keys(t.devices).length <= 60 && t.links.length <= 200 && (t.notes === undefined || (typeof t.notes === 'object' && !Array.isArray(t.notes) && Object.keys(t.notes).length <= 30))
const bad = (rep, m, c = 400) => rep.code(c).send({ error: m })
const MAX_VER = 30

// Versi baru untuk sebuah topologi; simpan maksimal MAX_VER versi terakhir.
function pushVersion(topoId, uid, data, summary) {
  const ver = (db.prepare('SELECT MAX(ver) AS v FROM topology_versions WHERE topo_id = ?').get(topoId)?.v || 0) + 1
  db.prepare('INSERT INTO topology_versions (topo_id, user_id, ver, summary, data) VALUES (?, ?, ?, ?, ?)')
    .run(topoId, uid, ver, String(summary || 'perubahan').slice(0, 120), JSON.stringify(data))
  db.prepare('DELETE FROM topology_versions WHERE topo_id = ? AND ver <= ?').run(topoId, ver - MAX_VER)
  return ver
}
const ownedTopo = (uid, id) => db.prepare('SELECT * FROM topologies WHERE id = ? AND user_id = ?').get(id, uid)

app.post('/api/register', async (req, rep) => {
  const b = req.body
  if (!/^[a-z0-9_]{3,30}$/i.test(b?.username || '') || String(b?.password || '').length < 6) return bad(rep, 'Username 3-30 huruf/angka/_, password minimal 6 karakter')
  const name = b.username.toLowerCase()
  try {
    const r = db.prepare('INSERT INTO users (username, hash) VALUES (?, ?)').run(name, hash(String(b.password)))
    return { token: sign(Number(r.lastInsertRowid)), username: name }
  } catch { return bad(rep, 'Username sudah dipakai', 409) }
})
app.post('/api/login', async (req, rep) => {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.body?.username || '').toLowerCase())
  if (!u || !verify(String(req.body.password || ''), u.hash)) return bad(rep, 'Username atau password salah', 401)
  return { token: sign(u.id), username: u.username }
})

app.get('/api/labs', async () => ({ labs: LABS.map(({ id, title, desc, seed, steps }) => ({ id, title, desc, seed, steps: steps.map(({ title, hint }) => ({ title, hint })) })) }))
app.post('/api/labs/:id/check', async (req, rep) => {
  const lab = LABS.find(l => l.id === req.params.id)
  if (!lab) return bad(rep, 'Lab tidak ditemukan', 404)
  if (!okTopo(req.body?.topology)) return bad(rep, 'Topologi tidak valid')
  let results, steps
  try { results = runLab(lab, req.body.topology); steps = runLabSteps(lab, req.body.topology) } catch { return bad(rep, 'Topologi tidak valid') }
  const passed = results.every(r => r.ok), uid = uidOf(req)
  if (passed && uid) db.prepare('INSERT OR IGNORE INTO progress (user_id, lab_id) VALUES (?, ?)').run(uid, lab.id)
  return { passed, results, steps }
})
app.get('/api/progress', T, async req => ({ passed: db.prepare('SELECT lab_id FROM progress WHERE user_id = ?').all(req.uid).map(r => r.lab_id) }))

app.get('/api/topologies', T, async req => ({ items: db.prepare('SELECT id, name, slug, updated_at FROM topologies WHERE user_id = ? ORDER BY updated_at DESC').all(req.uid) }))
app.post('/api/topologies', T, async (req, rep) => {
  const { name, data } = req.body || {}
  if (!okTopo(data) || !String(name || '').trim()) return bad(rep, 'Nama dan topologi wajib valid')
  const r = db.prepare('INSERT INTO topologies (user_id, name, data) VALUES (?, ?, ?)').run(req.uid, String(name).slice(0, 80), JSON.stringify(data))
  return { id: Number(r.lastInsertRowid) }
})
app.get('/api/topologies/:id', T, async (req, rep) => {
  const r = db.prepare('SELECT id, name, data FROM topologies WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  return r ? { id: r.id, name: r.name, data: JSON.parse(r.data) } : bad(rep, 'Topologi tidak ditemukan', 404)
})
app.put('/api/topologies/:id', T, async (req, rep) => {
  const { name, data, summary } = req.body || {}
  if (!okTopo(data)) return bad(rep, 'Topologi tidak valid')
  const id = Number(req.params.id)
  if (!ownedTopo(req.uid, id)) return bad(rep, 'Topologi tidak ditemukan', 404)
  db.prepare('UPDATE topologies SET name = COALESCE(?, name), data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(name ? String(name).slice(0, 80) : null, JSON.stringify(data), id, req.uid)
  const ver = pushVersion(id, req.uid, data, summary)
  return { id, ver }
})
app.get('/api/topologies/:id/versions', T, async (req, rep) => {
  const t = ownedTopo(req.uid, Number(req.params.id))
  return t
    ? { items: db.prepare('SELECT ver, summary, ts FROM topology_versions WHERE topo_id = ? ORDER BY ver DESC LIMIT 50').all(t.id) }
    : bad(rep, 'Topologi tidak ditemukan', 404)
})
app.post('/api/topologies/:id/restore/:ver', T, async (req, rep) => {
  const id = Number(req.params.id), t = ownedTopo(req.uid, id)
  if (!t) return bad(rep, 'Topologi tidak ditemukan', 404)
  const v = db.prepare('SELECT * FROM topology_versions WHERE topo_id = ? AND ver = ?').get(id, Number(req.params.ver))
  if (!v) return bad(rep, 'Versi tidak ditemukan', 404)
  const data = JSON.parse(v.data)
  if (!okTopo(data)) return bad(rep, 'Versi tidak valid')
  // kondisi sekarang disimpan lebih dulu supaya tetap bisa dikembalikan
  pushVersion(id, req.uid, JSON.parse(t.data), 'sebelum pulih v' + v.ver)
  db.prepare('UPDATE topologies SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(v.data, id)
  return { id, data }
})
// Monitoring: ingest sampel + riwayat 1 jam terakhir
app.post('/api/metrics', T, async (req, rep) => {
  const arr = req.body?.samples
  if (!Array.isArray(arr) || arr.length > 500) return bad(rep, 'Sampel tidak valid')
  const stmt = db.prepare('INSERT INTO metrics (user_id, dev, up, total, ts) VALUES (?, ?, ?, ?, ?)')
  for (const s of arr.slice(0, 500)) {
    if (!s || typeof s.dev !== 'string' || !Number.isFinite(s.up) || !Number.isFinite(s.total)) continue
    stmt.run(req.uid, s.dev.slice(0, 40), Math.max(0, Math.min(999, s.up | 0)), Math.max(0, Math.min(999, s.total | 0)), Number.isFinite(s.t) ? s.t : Date.now())
  }
  db.prepare('DELETE FROM metrics WHERE user_id = ? AND ts < ?').run(req.uid, Date.now() - 86400_000)
  return { ok: true }
})
app.get('/api/metrics', T, async req => {
  const since = Math.max(0, Number(req.query?.since) || 0)
  return { items: db.prepare('SELECT dev, up, total, ts FROM metrics WHERE user_id = ? AND ts >= ? ORDER BY ts ASC LIMIT 2000').all(req.uid, since) }
})
app.delete('/api/topologies/:id', T, async (req, rep) => {
  const r = db.prepare('DELETE FROM topologies WHERE id = ? AND user_id = ?').run(req.params.id, req.uid)
  return r.changes ? { ok: true } : bad(rep, 'Topologi tidak ditemukan', 404)
})
app.post('/api/topologies/:id/share', T, async (req, rep) => {
  const t = db.prepare('SELECT id, slug FROM topologies WHERE id = ? AND user_id = ?').get(req.params.id, req.uid)
  if (!t) return bad(rep, 'Topologi tidak ditemukan', 404)
  const slug = t.slug || randomBytes(6).toString('hex')
  db.prepare('UPDATE topologies SET slug = ? WHERE id = ?').run(slug, t.id)
  return { slug }
})
app.get('/api/shared/:slug', async (req, rep) => {
  const r = db.prepare('SELECT name, data FROM topologies WHERE slug = ?').get(req.params.slug)
  return r ? { name: r.name, data: JSON.parse(r.data) } : bad(rep, 'Link tidak ditemukan', 404)
})

app.listen({ port: +process.env.PORT || 3000, host: '127.0.0.1' }).then(() => console.log('API di http://127.0.0.1:' + (process.env.PORT || 3000)))
