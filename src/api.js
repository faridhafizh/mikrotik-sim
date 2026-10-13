export async function api(path, { method = 'GET', body, token } = {}) {
  // Content-Type hanya saat ada body: Fastify menolak application/json tanpa body (400)
  const r = await fetch('/api' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Backend tidak merespons')
  return j
}
