// Argumen ping lintas gaya: RouterOS (count= size=) dan Windows/Linux (-n -c -l -w).
// Mengembalikan { count, size, timeout, target } — count default 4, size default 32.
export function parsePingArgs(args, q = {}) {
  let count = null, size = null, timeout = null, target = null
  const NUM = /^\d+$/
  const set = (k, v) => {
    if (k === 'n' || k === 'c' || k === 'count') count = +v
    else if (k === 'l' || k === 'size') size = +v
    else if (k === 'w' || k === 'timeout') timeout = +v
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('-')) { if (target == null) target = a; continue }
    const body = a.slice(1)
    const eq = body.indexOf('=')
    if (eq >= 0) { set(body.slice(0, eq), body.slice(eq + 1)); continue }
    if (['n', 'c', 'l', 'w', 'size', 'count', 'timeout'].includes(body) && NUM.test(args[i + 1] || '')) { set(body, args[++i]); continue }
    const glued = /^([nclw])(\d+)$/.exec(body)
    if (glued) set(glued[1], glued[2])
  }
  for (const k of ['count', 'size', 'timeout']) if (q[k] != null && NUM.test(String(q[k]))) set(k, q[k])
  if (count == null) count = 4
  if (size == null) size = 32
  return { count: Math.min(50, Math.max(1, count)), size: Math.min(1472, Math.max(8, size)), timeout, target }
}