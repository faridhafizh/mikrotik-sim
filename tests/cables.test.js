import { describe, it, expect } from 'vitest'
import { borderAnchor, sagFor, hitsObstacle, routeCable, rectOf, SAG_MIN, SAG_MAX } from '../src/cables.js'

const dev = (id, x, y) => ({ id, x, y })
const mapOf = arr => Object.fromEntries(arr.map(d => [d.id, d]))

describe('borderAnchor', () => {
  it('jangkar pada border untuk pasangan horizontal', () => {
    const p = borderAnchor(dev('a', 0, 0), dev('b', 300, 0))
    expect(p.x).toBeCloseTo(68, 1) // 66 + EDGE_PAD(2)
    expect(p.y).toBeCloseTo(0, 5)
  })
  it('anchor dari sisi yang benar untuk arah berlawanan', () => {
    const p = borderAnchor(dev('b', 300, 0), dev('a', 0, 0))
    expect(p.x).toBeCloseTo(232, 1)
    expect(p.y).toBeCloseTo(0, 5)
  })
})

describe('sagFor', () => {
  it('clamp minimum', () => { expect(sagFor(10)).toBe(SAG_MIN) })
  it('clamp maksimum', () => { expect(sagFor(10000)).toBe(SAG_MAX) })
})

describe('routing hindari obstacle', () => {
  it('tiga device segaris rapat: base menabrak, routeCable menang tanpa hit', () => {
    const A = dev('a', 0, 0), B = dev('b', 200, 0), C = dev('c', 400, 0)
    const devices = mapOf([A, B, C])
    const p0 = borderAnchor(A, C), p3 = borderAnchor(C, A)
    const hits = hitsObstacle(p0, { x: p0.x + 100, y: 48 }, { x: p3.x - 100, y: 48 }, p3, [rectOf(B, 12)])
    expect(hits.hit).toBe(true)
    const r = routeCable(A, C, devices, 0, 1)
    const obst = [rectOf(B, 12)]
    expect(hitsObstacle(r.p0, r.p1, r.p2, r.p3, obst).hit).toBe(false)
  })
})

describe('label kurva', () => {
  it('la/lb dekat ujung kurva', () => {
    const A = dev('a', 0, 0), C = dev('c', 400, 100)
    const r = routeCable(A, C, mapOf([A, C]), 0, 1)
    expect(Math.hypot(r.la.x - r.p0.x, r.la.y - r.p0.y)).toBeLessThan(40)
    expect(Math.hypot(r.lb.x - r.p3.x, r.lb.y - r.p3.y)).toBeLessThan(40)
  })
})
