import { describe, it, expect } from 'vitest'
import { topoSummary, diffSummary, timeAgo } from '../src/versions.js'

const snap = (devs = {}, links = [], notes = {}) => ({ devices: devs, links, notes })

describe('topoSummary', () => {
  it('menghitung perangkat/kabel/catatan', () => {
    expect(topoSummary(snap({ d1: {}, d2: {} }, [{}, {}], { z1: {} }))).toBe('2 perangkat · 2 kabel · 1 catatan')
    expect(topoSummary(null)).toBe('kosong')
  })
})

describe('diffSummary', () => {
  it('membandingkan device/link/catatan', () => {
    const a = snap({ d1: {} }, [{}], {})
    const b = snap({ d1: {}, d2: {} }, [], { z1: {} })
    expect(diffSummary(a, b)).toBe('+1 perangkat, -1 kabel, +1 catatan')
  })
  it('mendeteksi perubahan interface', () => {
    const a = snap({ d1: { ifaces: [{ name: 'ether1', addr: null }] } }, [], {})
    const b = snap({ d1: { ifaces: [{ name: 'ether1', addr: '10.0.0.1/24' }] } }, [], {})
    expect(diffSummary(a, b)).toBe('1 interface berubah')
  })
  it('tanpa perubahan', () => {
    expect(diffSummary(snap({ d1: {} }, [{}]), snap({ d1: {} }, [{}]))).toBe('tanpa perubahan')
  })
})

describe('timeAgo', () => {
  it('menerjemahkan waktu server (UTC tanpa Z)', () => {
    const now = new Date()
    const iso = now.toISOString().slice(0, 19).replace('T', ' ')
    expect(timeAgo(iso)).toBe('baru saja')
  })
  it('beberapa jam lalu', () => {
    const ts = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
    expect(timeAgo(ts)).toBe('3 jam lalu')
  })
})
