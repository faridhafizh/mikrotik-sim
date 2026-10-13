import { describe, it, expect } from 'vitest'
import { exec, ping } from '../src/engine.js'
import { PROFILES, buildIfaces, defaultCableFor, linkStatus, migrateTopo, portKind, freePorts } from '../src/linkmodel.js'

const dev = (id, kind, ifName = 'ether1') => ({ id, type: 'router', name: id, x: 0, y: 0, routes: [], ifaces: [{ name: ifName, addr: null, kind }] })
const netOf = (kA, kB, cable) => ({
  devices: { a: dev('a', kA), b: dev('b', kB) },
  links: [{ a: { dev: 'a', if: 'ether1' }, b: { dev: 'b', if: 'ether1' }, cable }]
})

describe('linkStatus medium + speed', () => {
  it('copper-copper-cat6 UP 1000', () => {
    expect(linkStatus(netOf('GBE', 'GBE', 'cat6'), netOf('GBE', 'GBE', 'cat6').links[0])).toMatchObject({ up: true, speed: 1000 })
  })
  it('fiber-copper DOWN dengan alasan mismatch', () => {
    const n = netOf('SFP', 'GBE', 'fiber1g')
    const r = linkStatus(n, n.links[0])
    expect(r.up).toBe(false)
    expect(r.speed).toBe(0)
    expect(r.reason).toBe('medium mismatch: fiber/copper/fiber')
  })
  it('cat5e di GbE↔GbE UP dibatasi 100', () => {
    const n = netOf('GBE', 'GBE', 'cat5e')
    expect(linkStatus(n, n.links[0])).toMatchObject({ up: true, speed: 100 })
  })
  it('SFP↔SFP fiber1g UP 1000', () => {
    const n = netOf('SFP', 'SFP', 'fiber1g')
    expect(linkStatus(n, n.links[0])).toMatchObject({ up: true, speed: 1000 })
  })
  it('SFPP↔SFPP fiber10g UP 10000', () => {
    const n = netOf('SFPP', 'SFPP', 'fiber10g')
    expect(linkStatus(n, n.links[0])).toMatchObject({ up: true, speed: 10000 })
  })
})

describe('defaultCableFor', () => {
  it('copper→cat6, fiber→fiber1g, campur→cat6', () => {
    expect(defaultCableFor('GBE', 'FE')).toBe('cat6')
    expect(defaultCableFor('SFP', 'SFP')).toBe('fiber1g')
    expect(defaultCableFor('SFPP', 'SFP')).toBe('fiber10g')
    expect(defaultCableFor('SFP', 'GBE')).toBe('cat6')
  })
})

describe('buildIfaces penamaan', () => {
  it('router-gbe-sfp: ether1..4 + sfp1 (+wlan1)', () => {
    expect(buildIfaces('router-gbe-sfp').map(i => i.name)).toEqual(['ether1', 'ether2', 'ether3', 'ether4', 'sfp1', 'wlan1'])
  })
  it('switch-gbe-sfp: ether1..8 + sfp1,sfp2', () => {
    expect(buildIfaces('switch-gbe-sfp').map(i => i.name)).toEqual(['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'ether6', 'ether7', 'ether8', 'sfp1', 'sfp2'])
  })
  it('pc-gbe: eth0 copper; server-sfpp: sfp1 fiber', () => {
    expect(buildIfaces('pc-gbe')).toEqual([{ name: 'eth0', addr: null, kind: 'GBE' }])
    expect(buildIfaces('server-sfpp')).toEqual([{ name: 'sfp1', addr: null, kind: 'SFPP' }])
  })
  it('router map port ke kind yang sama', () => {
    for (const p of PROFILES) {
      const ifaces = buildIfaces(p.id)
      const cable = ifaces.filter(i => i.kind)
      expect(cable.map(i => i.kind)).toEqual(p.ports)
    }
  })
})

describe('portKind + freePorts', () => {
  it('wlan tanpa kind -> null', () => {
    const d = { id: 'x', ifaces: [{ name: 'ether1', kind: 'GBE' }, { name: 'wlan1' }] }
    expect(portKind(d, 'ether1')).toBe('GBE')
    expect(portKind(d, 'wlan1')).toBe(null)
  })
  it('freePorts membuang port terpakai', () => {
    const d = { id: 'x', ifaces: [{ name: 'ether1', kind: 'GBE' }, { name: 'ether2', kind: 'GBE' }] }
    const links = [{ a: { dev: 'x', if: 'ether1' }, b: { dev: 'y', if: 'ether1' }, cable: 'cat6' }]
    expect(freePorts(d, links, 'x').map(i => i.name)).toEqual(['ether2'])
  })
})

describe('migrateTopo data lama', () => {
  it('device tanpa kind -> GBE, link tanpa cable -> cat6, profil default', () => {
    const t = {
      devices: { d1: { id: 'd1', type: 'pc', name: 'PC1', x: 0, y: 0, routes: [], ifaces: [{ name: 'eth0', addr: null }] }, d2: { id: 'd2', type: 'laptop', name: 'LT', x: 0, y: 0, routes: [], ifaces: [{ name: 'wlan0', addr: null }] } },
      links: [{ a: { dev: 'd1', if: 'eth0' }, b: { dev: 'd2', if: 'wlan0' } }]
    }
    migrateTopo(t)
    expect(t.devices.d1.ifaces[0].kind).toBe('GBE')
    expect(t.devices.d1.profileId).toBe('pc-gbe')
    expect(t.devices.d2.profileId).toBeUndefined()
    expect(t.links[0].cable).toBe('cat6')
  })
})

describe('engine menghormati DOWN', () => {
  const rtr = (id, x, addr) => ({ id, type: 'router', name: id.toUpperCase(), x, y: 0, routes: [], ifaces: [{ name: 'ether1', addr, kind: 'GBE' }] })
  const net2 = cable => ({ devices: { r1: rtr('r1', 0, '10.0.0.1/24'), r2: rtr('r2', 300, '10.0.0.2/24') }, links: [{ a: { dev: 'r1', if: 'ether1' }, b: { dev: 'r2', if: 'ether1' }, cable }] })

  it('kabel fiber di port copper: ping gagal, interface print mismatch', () => {
    const n = net2('fiber1g')
    expect(ping(n, 'r1', '10.0.0.2').ok).toBe(false)
    const line = exec(n, n.devices.r1, 'interface print').out.find(l => l.includes('ether1'))
    expect(line).toContain('no link (mismatch)')
  })
  it('kabel cat6: ping ok, interface print running 1G', () => {
    const n = net2('cat6')
    expect(ping(n, 'r1', '10.0.0.2').ok).toBe(true)
    const line = exec(n, n.devices.r1, 'interface print').out.find(l => l.includes('ether1'))
    expect(line).toContain('running 1G')
  })
  it('tanpa link: no link', () => {
    const n = { devices: { r1: rtr('r1', 0, '10.0.0.1/24') }, links: [] }
    const line = exec(n, n.devices.r1, 'interface print').out.find(l => l.includes('ether1'))
    expect(line).toContain('no link')
    expect(line).not.toContain('mismatch')
  })
})
