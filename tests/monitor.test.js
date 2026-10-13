import { describe, it, expect } from 'vitest'
import { sampleMetrics, evalAlerts, DEFAULT_RULES, sparkPoints } from '../src/monitor.js'

const build = (addrA, addrB, cableA = 'cat6') => ({
  devices: {
    a: { id: 'a', type: 'router', name: 'R1', x: 0, y: 0, ifaces: [{ name: 'ether1', addr: addrA, kind: 'GBE' }] },
    b: { id: 'b', type: 'pc', name: 'PC1', x: 0, y: 0, ifaces: [{ name: 'eth0', addr: addrB, kind: 'GBE' }] }
  },
  links: [{ a: { dev: 'a', if: 'ether1' }, b: { dev: 'b', if: 'eth0' }, cable: cableA }]
})

describe('sampleMetrics', () => {
  it('menghitung kabel UP dan perangkat tanpa IP', () => {
    const s = sampleMetrics(build('192.168.1.1/24', null), 1000)
    expect(s.up).toBe(1)
    expect(s.total).toBe(1)
    expect(s.noIp).toBe(1)
    expect(s.devices.a).toEqual({ up: 1, total: 1, hasIp: true })
    expect(s.t).toBe(1000)
  })
  it('link DOWN saat medium beda', () => {
    const s = sampleMetrics(build('192.168.1.1/24', '192.168.1.5/24', 'fiber1g'), 1000)
    expect(s.up).toBe(0)
    expect(s.total).toBe(1)
    expect(s.devices.a.up).toBe(0)
  })
})

describe('evalAlerts', () => {
  it('link-down menembak sekali saat kabel DOWN', () => {
    const bad = new Map()
    const rules = DEFAULT_RULES.map(r => ({ ...r }))
    const s = sampleMetrics(build('1.1.1.1/24', '1.1.1.2/24', 'fiber1g'), 1000)
    const fired = evalAlerts(rules, s, bad)
    expect(fired).toHaveLength(2) // kedua ujung kabel DOWN
    expect(fired[0].rule).toBe('link-down')
    // sampel kedua: tidak menembak ulang
    expect(evalAlerts(rules, { ...s, t: 2000 }, bad)).toEqual([])
  })

  it('no-ip butuh dua sampel berturut-turut lalu pulih saat IP ada', () => {
    const bad = new Map()
    const rules = [{ id: 'no-ip', label: 'Perangkat tanpa IP', severity: 'warn', on: true }]
    const s = sampleMetrics(build(null, '2.2.2.2/24'), 1000)
    expect(evalAlerts(rules, s, bad)).toEqual([])
    expect(evalAlerts(rules, { ...s, t: 2000 }, bad)).toEqual([{ rule: 'no-ip', dev: 'a', text: 'Tanpa alamat IP' }])
    const fixed = sampleMetrics(build('2.2.2.1/24', '2.2.2.2/24'), 3000)
    expect(evalAlerts(rules, fixed, bad)).toEqual([])
    expect(bad.size).toBe(0)
  })

  it('aturan nonaktif tidak menembak', () => {
    const bad = new Map()
    const rules = [{ id: 'link-down', label: 'x', severity: 'error', on: false }]
    expect(evalAlerts(rules, sampleMetrics(build('1.1.1.1/24', null, 'fiber1g'), 1), bad)).toEqual([])
  })
})

describe('sparkPoints', () => {
  it('kosong untuk deret kosong', () => {
    expect(sparkPoints([])).toBe('')
  })
  it('menskalakan ke lebar/tinggi', () => {
    const p = sparkPoints([0, 1])
    expect(p.startsWith('0,19')).toBe(true)
    expect(p.endsWith('96,1')).toBe(true)
  })
})
