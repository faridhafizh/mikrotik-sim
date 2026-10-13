import { NODE_W, NODE_H } from './zoom.js'

export const EDGE_PAD = 2, CABLE_PAD = 12, SAG_MIN = 10, SAG_MAX = 64, SAG_K = 0.12
export const PAIR_GAP = 10, BOW = 80, VIA_MARGIN = 28, SAMPLES = 24

export function rectOf(dev, pad = 0) {
  return { x1: dev.x - NODE_W / 2 - pad, y1: dev.y - NODE_H / 2 - pad, x2: dev.x + NODE_W / 2 + pad, y2: dev.y + NODE_H / 2 + pad }
}

export function borderAnchor(from, to, pad = EDGE_PAD) {
  const r = rectOf(from, pad)
  const dx = to.x - from.x, dy = to.y - from.y
  if (Math.hypot(dx, dy) < 1) return { x: r.x2, y: from.y }
  const tx = dx === 0 ? Infinity : (dx > 0 ? r.x2 - from.x : r.x1 - from.x) / dx
  const ty = dy === 0 ? Infinity : (dy > 0 ? r.y2 - from.y : r.y1 - from.y) / dy
  const t = Math.min(tx, ty)
  return { x: from.x + dx * t, y: from.y + dy * t }
}

export function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
  }
}

export function cubicSamples(p0, p1, p2, p3, n = SAMPLES) {
  const out = []
  for (let i = 0; i <= n; i++) out.push(cubicPoint(p0, p1, p2, p3, i / n))
  return out
}

function cubicTangent(p0, p1, p2, p3, t) {
  const u = 1 - t
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
  }
}

export function labelPos(p0, p1, p2, p3, t) {
  const p = cubicPoint(p0, p1, p2, p3, t)
  const tg = cubicTangent(p0, p1, p2, p3, t)
  const l = Math.hypot(tg.x, tg.y) || 1
  return { x: p.x + (-tg.y / l) * -10, y: p.y + (tg.x / l) * -10 }
}

export function pairKey(aId, bId) { return [aId, bId].sort().join('|') }

export function groupLinks(links) {
  const m = new Map()
  for (const l of links) {
    const k = pairKey(l.a.dev, l.b.dev)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(l)
  }
  return m
}

export function sagFor(dist) { return Math.min(SAG_MAX, Math.max(SAG_MIN, dist * SAG_K)) }

export function baseControls(p0, p3, dist, pairOffset, up = false, bow = 0) {
  const ux = (p3.x - p0.x) / (dist || 1), uy = (p3.y - p0.y) / (dist || 1)
  const nx = -uy, ny = ux
  const sag = sagFor(dist) * (up ? -1 : 1)
  const p1 = { x: p0.x + ux * dist * 0.25 + nx * (pairOffset + bow), y: p0.y + uy * dist * 0.25 + sag + ny * (pairOffset + bow) }
  const p2 = { x: p3.x - ux * dist * 0.25 + nx * (pairOffset + bow), y: p3.y - uy * dist * 0.25 + sag + ny * (pairOffset + bow) }
  return [p1, p2]
}

function inRect(p, r) { return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2 }

function segRect(a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y
  let t0 = 0, t1 = 1
  if (dx === 0) { if (a.x < r.x1 || a.x > r.x2) return false }
  else {
    let ta = (r.x1 - a.x) / dx, tb = (r.x2 - a.x) / dx
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  if (dy === 0) { if (a.y < r.y1 || a.y > r.y2) return false }
  else {
    let ta = (r.y1 - a.y) / dy, tb = (r.y2 - a.y) / dy
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  return true
}

export function hitCurveRect(p0, p1, p2, p3, r) {
  const pts = cubicSamples(p0, p1, p2, p3)
  let count = 0
  for (const p of pts) if (inRect(p, r)) count++
  for (let i = 0; i < pts.length - 1; i++) if (segRect(pts[i], pts[i + 1], r)) return { hit: true, count }
  return { hit: count > 0, count }
}

export function hitsObstacle(p0, p1, p2, p3, obstacles) {
  let count = 0, hit = false
  const xs = [p0.x, p1.x, p2.x, p3.x], ys = [p0.y, p1.y, p2.y, p3.y]
  const bx1 = Math.min(...xs), bx2 = Math.max(...xs), by1 = Math.min(...ys), by2 = Math.max(...ys)
  for (const r of obstacles) {
    if (bx2 < r.x1 || bx1 > r.x2 || by2 < r.y1 || by1 > r.y2) continue
    const h = hitCurveRect(p0, p1, p2, p3, r)
    count += h.count
    if (h.hit) hit = true
  }
  return { hit, count }
}

const r1 = v => Math.round(v * 10) / 10

export function routeCable(devA, devB, devices, pairIndex = 0, pairCount = 1, wobA = null, wobB = null) {
  const p0 = borderAnchor(devA, devB), p3 = borderAnchor(devB, devA)
  const dist = Math.hypot(devB.x - devA.x, devB.y - devA.y)
  const obstacles = Object.values(devices || {})
    .filter(d => d.id !== devA.id && d.id !== devB.id)
    .map(d => rectOf(d, CABLE_PAD))
  const pairOffset = (pairIndex - (pairCount - 1) / 2) * PAIR_GAP

  const tryAll = ([p1, p2]) => {
    const h = hitsObstacle(p0, p1, p2, p3, obstacles)
    return { p1, p2, hit: h.hit, count: h.count, obstaclesHit: obstacles.filter(r => hitCurveRect(p0, p1, p2, p3, r).hit) }
  }

  const base = tryAll(baseControls(p0, p3, dist, pairOffset))
  const candidates = [
    base,
    tryAll(baseControls(p0, p3, dist, pairOffset, true)),
    tryAll(baseControls(p0, p3, dist, pairOffset, false, BOW)),
    tryAll(baseControls(p0, p3, dist, pairOffset, false, -BOW))
  ]
  const hitObs = base.obstaclesHit
  if (hitObs.length) {
    const viaYDown = Math.max(...hitObs.map(r => r.y2)) + VIA_MARGIN
    const viaYUp = Math.min(...hitObs.map(r => r.y1)) - VIA_MARGIN
    candidates.push(tryAll([{ x: p0.x, y: viaYDown }, { x: p3.x, y: viaYDown }]))
    candidates.push(tryAll([{ x: p0.x, y: viaYUp }, { x: p3.x, y: viaYUp }]))
  }

  const winner = candidates.find(c => !c.hit) || candidates.reduce((a, c) => (c.count < a.count ? c : a))
  let { p1, p2 } = winner

  const ux = (p3.x - p0.x) / (dist || 1), uy = (p3.y - p0.y) / (dist || 1)
  const nx = -uy, ny = ux
  const wx = (wobA?.ox || 0) + (wobB?.ox || 0), wy = (wobA?.oy || 0) + (wobB?.oy || 0)
  const s = (wx * nx + wy * ny) / 2
  p1 = { x: p1.x + nx * s, y: p1.y + ny * s }
  p2 = { x: p2.x + nx * s, y: p2.y + ny * s }

  return {
    d: `M ${r1(p0.x)} ${r1(p0.y)} C ${r1(p1.x)} ${r1(p1.y)} ${r1(p2.x)} ${r1(p2.y)} ${r1(p3.x)} ${r1(p3.y)}`,
    p0, p1, p2, p3,
    la: labelPos(p0, p1, p2, p3, 0.1),
    lb: labelPos(p0, p1, p2, p3, 0.9)
  }
}
