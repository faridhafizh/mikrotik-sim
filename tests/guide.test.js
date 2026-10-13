import { describe, it, expect } from 'vitest'
import { GUIDE_STEPS, isSafeCmd } from '../src/guide.js'

describe('konten mode pemula', () => {
  it('punya 5 langkah tur dengan anchor valid/null', () => {
    expect(GUIDE_STEPS).toHaveLength(5)
    for (const s of GUIDE_STEPS) {
      expect(typeof s.title).toBe('string')
      expect(typeof s.body).toBe('string')
      expect(s.anchor === null || typeof s.anchor === 'string').toBe(true)
    }
    expect(GUIDE_STEPS.map(s => s.anchor)).toEqual(['add', 'link', 'terminal', 'terminal', null])
  })
})

describe('isSafeCmd', () => {
  it('menerima perintah dasar dan print', () => {
    expect(isSafeCmd('ip address print')).toBe(true)
    expect(isSafeCmd('ping 192.168.1.1')).toBe(true)
    expect(isSafeCmd('/traceroute 10.0.0.1')).toBe(true)
    expect(isSafeCmd('help ip')).toBe(true)
  })
  it('menyembunyikan perintah lanjutan', () => {
    expect(isSafeCmd('ip firewall nat add chain=srcnat action=masquerade out-interface=ether1')).toBe(false)
    expect(isSafeCmd('interface bridge add name=br1')).toBe(false)
    expect(isSafeCmd('routing ospf network add network=10.0.0.0/24')).toBe(false)
    expect(isSafeCmd('queue tree add name=t parent=global max-limit=2M/5M')).toBe(false)
  })
})
