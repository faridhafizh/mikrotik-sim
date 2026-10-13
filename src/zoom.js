export const MIN_Z = 0.3, MAX_Z = 2.5
export const clampZ = z => Math.min(MAX_Z, Math.max(MIN_Z, z))
// jaga titik world di bawah kursor tetap: world = (cur - pan) / z harus invarian
export function zoomAt(z, pan, cur, factor) {
  const nz = clampZ(z * factor), k = nz / z
  return { zoom: nz, pan: { x: cur.x - (cur.x - pan.x) * k, y: cur.y - (cur.y - pan.y) * k } }
}

export const NODE_W = 132, NODE_H = 60, NODE_PAD = 48

export const NOTE_COLORS = ['#ffbf47', '#5fe3b0', '#6fb7ff', '#d9a6ff', '#ff9084', '#b3cde5']
export const NOTE_MIN_W = 60, NOTE_MIN_H = 40

export function boundsOf(devices, notes) {
  const ds = Object.values(devices || {})
  const zs = Object.values(notes || {})
  if (!ds.length && !zs.length) return null
  const rects = ds.map(d => ({ x1: d.x - NODE_W / 2, y1: d.y - NODE_H / 2, x2: d.x + NODE_W / 2, y2: d.y + NODE_H / 2 }))
    .concat(zs.map(z => ({ x1: z.x, y1: z.y, x2: z.x + z.w, y2: z.y + z.h })))
  const x1 = Math.min(...rects.map(r => r.x1)), x2 = Math.max(...rects.map(r => r.x2))
  const y1 = Math.min(...rects.map(r => r.y1)), y2 = Math.max(...rects.map(r => r.y2))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function fitView(b, vw, vh) {
  if (!b || vw < 40 || vh < 40) return { zoom: 1, pan: { x: 0, y: 0 } }
  const z = clampZ(Math.min((vw - 2 * NODE_PAD) / Math.max(b.w, 1), (vh - 2 * NODE_PAD) / Math.max(b.h, 1)))
  return { zoom: z, pan: { x: vw / 2 - (b.x + b.w / 2) * z, y: vh / 2 - (b.y + b.h / 2) * z } }
}
