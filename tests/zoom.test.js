import { describe, it, expect } from 'vitest'
import { MIN_Z, MAX_Z, clampZ, zoomAt, NODE_W, NODE_H, boundsOf, fitView } from '../src/zoom.js'

// world point di bawah titik layar `cur` dengan zoom/pan tertentu
const world = (z, pan, cur) => ({ x: (cur.x - pan.x) / z, y: (cur.y - pan.y) / z })

describe('clampZ', () => {
  it('membatasi batas atas ke MAX_Z', () => { expect(clampZ(10)).toBe(MAX_Z); expect(clampZ(MAX_Z)).toBe(MAX_Z) })
  it('membatasi batas bawah ke MIN_Z', () => { expect(clampZ(0.01)).toBe(MIN_Z); expect(clampZ(MIN_Z)).toBe(MIN_Z) })
  it('nilai dalam rentang tidak diubah', () => { expect(clampZ(1.7)).toBe(1.7) })
})

describe('zoomAt', () => {
  it('factor 2 mengangkar kursor (titik world tidak bergeser)', () => {
    const z = 1, pan = { x: 40, y: -15 }, cur = { x: 300, y: 180 }
    const before = world(z, pan, cur)
    const r = zoomAt(z, pan, cur, 2)
    expect(r.zoom).toBe(2)
    const after = world(r.zoom, r.pan, cur)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
  it('factor < 1 mengecilkan dan menggeser pan ke arah kursor', () => {
    const z = 2, pan = { x: -100, y: -60 }, cur = { x: 500, y: 300 }
    const before = world(z, pan, cur)
    const r = zoomAt(z, pan, cur, 0.5)
    expect(r.zoom).toBe(1)
    // kursor di kanan/bawah pan → pan bergerak mendekati kursor
    expect(r.pan.x).toBeGreaterThan(pan.x)
    expect(r.pan.y).toBeGreaterThan(pan.y)
    const after = world(r.zoom, r.pan, cur)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
  it('faktor ekstrem berhenti di MIN_Z/MAX_Z dan tetap mengangkar', () => {
    const cur = { x: 222, y: 111 }, pan = { x: 7, y: 9 }
    const lo = zoomAt(1, pan, cur, 0.0001)
    expect(lo.zoom).toBe(MIN_Z)
    expect(world(lo.zoom, lo.pan, cur).x).toBeCloseTo(world(1, pan, cur).x)
    const hi = zoomAt(1, pan, cur, 999)
    expect(hi.zoom).toBe(MAX_Z)
    expect(world(hi.zoom, hi.pan, cur).y).toBeCloseTo(world(1, pan, cur).y)
  })
})

describe('boundsOf', () => {
  it('tanpa device → null', () => { expect(boundsOf({})).toBeNull(); expect(boundsOf(null)).toBeNull() })
  it('satu device → kartu penuh di sekelilingnya', () => {
    expect(boundsOf({ a: { x: 100, y: 200 } })).toEqual({ x: 34, y: 170, w: NODE_W, h: NODE_H })
  })
  it('tiga device → bbox membungkus semuanya dengan tepi setengah kartu', () => {
    const b = boundsOf({ a: { x: 0, y: 0 }, b: { x: 200, y: 100 }, c: { x: -50, y: 300 } })
    expect(b).toEqual({ x: -50 - NODE_W / 2, y: 0 - NODE_H / 2, w: 250 + NODE_W, h: 300 + NODE_H })
  })
})

describe('fitView', () => {
  it('memetakan tengah bbox ke tengah viewport', () => {
    const b = { x: 0, y: 0, w: 132, h: 60 }
    const v = fitView(b, 1000, 600)
    expect(v.pan.x + (b.x + b.w / 2) * v.zoom).toBeCloseTo(500)
    expect(v.pan.y + (b.y + b.h / 2) * v.zoom).toBeCloseTo(300)
  })
  it('bbox sangat kecil → zoom ter-clamp ke MAX_Z', () => {
    expect(fitView({ x: 0, y: 0, w: 1, h: 1 }, 1000, 600).zoom).toBe(MAX_Z)
  })
  it('bbox raksasa → zoom ter-clamp ke MIN_Z', () => {
    expect(fitView({ x: 0, y: 0, w: 4000, h: 4000 }, 1000, 600).zoom).toBe(MIN_Z)
  })
  it('bbox null atau viewport belum terukur → identitas', () => {
    expect(fitView(null, 1000, 600)).toEqual({ zoom: 1, pan: { x: 0, y: 0 } })
    expect(fitView({ x: 0, y: 0, w: 10, h: 10 }, 0, 0)).toEqual({ zoom: 1, pan: { x: 0, y: 0 } })
  })
})
