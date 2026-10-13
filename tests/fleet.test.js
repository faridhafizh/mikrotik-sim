import { describe, it, expect } from 'vitest'
import { exec } from '../src/engine.js'
import { parseVars, renderScript, scriptLines, runFleet, scriptChanges } from '../src/fleet.js'

const mkNet = () => {
  const R = (id, name) => ({ id, type: 'router', name, x: 0, y: 0, routes: [], routes6: [], ifaces: [{ name: 'ether1', addr: null, kind: 'GBE' }, { name: 'wlan1', addr: null }] })
  return { devices: { r1: R('r1', 'R1'), r2: R('r2', 'R2'), pc: { id: 'pc', type: 'pc', name: 'PC1', x: 0, y: 0, routes: [], ifaces: [{ name: 'eth0', addr: null, kind: 'GBE' }] } }, links: [] }
}
const run = (net, ids, script, vars) => runFleet(net, ids, script, vars, (d, l) => exec(net, d, l))

describe('parseVars', () => {
  it('membaca key=value, mengabaikan baris tanpa =', () => {
    expect(parseVars('ip=192.168.88.1\ngw=192.168.88.254\n\nsalah')).toEqual({ ip: '192.168.88.1', gw: '192.168.88.254' })
  })
})

describe('renderScript', () => {
  it('mengganti placeholder', () => {
    const r = renderScript('/ip address add address={{ip}}/24 interface=ether1', { ip: '10.0.0.1' })
    expect(r.out).toBe('/ip address add address=10.0.0.1/24 interface=ether1')
    expect(r.missing).toEqual([])
  })
  it('melaporkan variabel tanpa nilai', () => {
    const r = renderScript('ping {{a}} ; ping {{b}}', { a: '1.1.1.1' })
    expect(r.missing).toEqual(['b'])
  })
})

describe('scriptLines', () => {
  it('membuang komentar dan baris kosong', () => {
    expect(scriptLines('# judul\n\nping x\n  \n# lagi')).toEqual(['ping x'])
  })
})

describe('scriptChanges', () => {
  it('membedakan skrip konfigurasi vs read-only', () => {
    expect(scriptChanges('/ip address add address=10.0.0.1/24 interface=ether1')).toBe(true)
    expect(scriptChanges('# catatan\ninterface print')).toBe(false)
    expect(scriptChanges('ping 10.0.0.1')).toBe(false)
  })
})

describe('runFleet', () => {
  it('menerapkan skrip ke setiap perangkat terpilih', () => {
    const net = mkNet()
    const r = run(net, ['r1', 'r2'], '/ip address add address={{ip}}/24 interface=ether1\n/ip route add dst-address=0.0.0.0/0 gateway={{gw}}', { ip: '192.168.1.1', gw: '192.168.1.254' })
    expect(r.missing).toEqual([])
    expect(r.results).toHaveLength(2)
    for (const res of r.results) {
      expect(res.ok).toBe(true)
      expect(res.changed).toBe(true)
    }
    expect(net.devices.r1.ifaces[0].addr).toBe('192.168.1.1/24')
    expect(net.devices.r1.routes).toEqual([{ dst: '0.0.0.0/0', gw: '192.168.1.254' }])
    expect(net.devices.r2.ifaces[0].addr).toBe('192.168.1.1/24')
    expect(net.devices.pc.ifaces[0].addr).toBeNull() // PC tidak dipilih
  })

  it('tidak menjalankan apa pun bila variabel kurang', () => {
    const net = mkNet()
    const r = run(net, ['r1'], '/ip address add address={{ip}}/24 interface=ether1', {})
    expect(r.missing).toEqual(['ip'])
    expect(r.results).toEqual([])
    expect(net.devices.r1.ifaces[0].addr).toBeNull()
  })

  it('mencatat error per baris; perangkat lain tetap jalan', () => {
    const net = mkNet()
    // ether9 tidak ada di router -> engine menolak dengan failure
    const r = run(net, ['r1', 'pc'], '/ip address add address={{ip}}/24 interface=ether9', { ip: '172.16.0.5' })
    expect(r.results).toHaveLength(2)
    const pcs = r.results.find(x => x.id === 'pc')
    const rts = r.results.find(x => x.id === 'r1')
    // PC memakai ifaces[0] apa pun interface= (perilaku host), jadi tetap ok
    expect(pcs.ok).toBe(true)
    expect(net.devices.pc.ifaces[0].addr).toBe('172.16.0.5/24')
    // Router menolak karena ether9 tidak ada
    expect(rts.ok).toBe(false)
    expect(rts.lines.join(' ')).toMatch(/failure/)
    expect(net.devices.r1.ifaces[0].addr).toBeNull()
  })

  it('read-only tidak menandai changed', () => {
    const net = mkNet()
    const r = run(net, ['r1'], '/interface print', {})
    expect(r.results[0].changed).toBe(false)
    expect(r.results[0].lines.length).toBeGreaterThan(0)
  })
})
