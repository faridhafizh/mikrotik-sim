import { describe, it, expect } from 'vitest'
import { exec, ping } from '../src/engine.js'
import { HELP } from '../src/help.js'
import { CMDS } from '../src/catalog.js'
import { parsePingArgs } from '../src/ros/pingargs.js'
import { lenOfMask, maskOf } from '../src/ros/num.js'
import { macOf } from '../src/ros/mac.js'

// Net dasar: PC1 — R1 — SRV (PC1 punya gateway default supaya reply balik lewat R1)
const net = () => {
  const n = { devices: {}, links: [] }
  n.devices.pc = { id: 'pc', type: 'pc', name: 'PC1', x: 0, y: 0, routes: [{ dst: '0.0.0.0/0', gw: '192.168.1.1' }], ifaces: [{ name: 'eth0', addr: '192.168.1.10/24', kind: 'GBE' }], dns: '192.168.1.1' }
  n.devices.r = { id: 'r', type: 'router', name: 'R1', x: 300, y: 0, routes: [], ifaces: [{ name: 'ether1', addr: '192.168.1.1/24', kind: 'GBE' }, { name: 'ether2', addr: '10.0.0.1/24', kind: 'GBE' }, { name: 'wlan1', addr: null }] }
  n.devices.srv = { id: 'srv', type: 'server', name: 'SRV', x: 600, y: 0, routes: [{ dst: '0.0.0.0/0', gw: '10.0.0.1' }], ifaces: [{ name: 'eth0', addr: '10.0.0.10/24', kind: 'GBE' }] }
  n.links = [{ a: { dev: 'pc', if: 'eth0' }, b: { dev: 'r', if: 'ether1' } }, { a: { dev: 'r', if: 'ether2' }, b: { dev: 'srv', if: 'eth0' } }]
  return n
}
const out = (n, d, cmd) => exec(n, d, cmd).out.join('\n')
const sw = () => ({ id: 'sw', type: 'switch', name: 'SW1', x: 0, y: 0, routes: [], stp: 'yes', ifaces: ['ether1', 'ether2', 'ether3'].map((name, k) => ({ name, addr: null, kind: 'GBE' })) })

describe('registry: dump RouterOS', () => {
  it('system resource / identity / clock print', () => {
    const n = net()
    expect(out(n, n.devices.r, 'system resource print')).toMatch(/cpu-load: \d+%/)
    expect(out(n, n.devices.r, 'system identity print')).toContain('R1')
    expect(out(n, n.devices.r, 'system clock print')).toMatch(/date: \d{4}-\d{2}-\d{2}/)
    exec(n, n.devices.r, 'system clock set date=2026-01-02 time=10:30')
    const c = out(n, n.devices.r, 'system clock print')
    expect(c).toContain('2026-01-02')
    expect(c).toContain('10:30:00')
  })
  it('clock set format salah ditolak', () => {
    const n = net()
    expect(out(n, n.devices.r, 'system clock set date=02-01-2026')).toMatch(/failure/)
    expect(out(n, n.devices.r, 'system clock set time=25:99')).toMatch(/failure/)
  })
  it('system reboot mereset terminal dan menambah log', () => {
    const n = net()
    const r = exec(n, n.devices.r, 'system reboot')
    expect(r.clear).toBe(true)
    expect(r.out.join(' ')).toMatch(/Reboot selesai/)
    expect(out(n, n.devices.r, 'log print')).toContain('system reboot requested')
  })
  it('user add/print/set/remove', () => {
    const n = net()
    exec(n, n.devices.r, 'user add name=operator group=read')
    exec(n, n.devices.r, 'user add name=admin group=read')
    const p = out(n, n.devices.r, 'user print')
    expect(p).toContain('admin')
    expect(p).toContain('operator')
    expect(exec(n, n.devices.r, 'user add name=buruk!nama group=read').out.join(' ')).toMatch(/failure/)
    expect(exec(n, n.devices.r, 'user add name=x group=jahat').out.join(' ')).toMatch(/failure/)
    exec(n, n.devices.r, 'user set name=operator group=write')
    expect(out(n, n.devices.r, 'user print')).toContain('write')
    exec(n, n.devices.r, 'user remove name=operator')
    expect(out(n, n.devices.r, 'user print')).not.toContain('operator')
  })
  it('ip service print/set/enable', () => {
    const n = net()
    const p = out(n, n.devices.r, 'ip service print')
    expect(p).toContain('www')
    expect(p).toContain('winbox')
    exec(n, n.devices.r, 'ip service disable 2')
    expect(out(n, n.devices.r, 'ip service print')).toMatch(/www\s+X/)
    exec(n, n.devices.r, 'ip service set 2 port=8081')
    expect(out(n, n.devices.r, 'ip service print')).toMatch(/www\s+(X\s+)?8081/)
    expect(exec(n, n.devices.r, 'ip service set 99 port=1').out.join(' ')).toMatch(/failure/)
  })
  it('ip dns print/set/flush', () => {
    const n = net()
    exec(n, n.devices.r, 'ip dns set servers=8.8.8.8,1.1.1.1')
    expect(out(n, n.devices.r, 'ip dns print')).toContain('8.8.8.8,1.1.1.1')
    expect(exec(n, n.devices.r, 'ip dns set servers=999.1.1.1').out.join(' ')).toMatch(/failure/)
    exec(n, n.devices.r, 'ip dns set allow-remote-requests=no')
    expect(out(n, n.devices.r, 'ip dns print')).toContain('allow-remote-requests: no')
  })
  it('ip address/route/filter print count-only', () => {
    const n = net()
    exec(n, n.devices.r, 'ip route add dst-address=8.8.8.8/32 gateway=10.0.0.9')
    expect(out(n, n.devices.r, 'ip address print count-only')).toContain('2 address(es) found')
    expect(out(n, n.devices.r, 'ip route print count-only')).toContain('route(s) found')
    exec(n, n.devices.r, 'ip firewall filter add chain=forward action=drop')
    expect(out(n, n.devices.r, 'ip firewall filter print count-only')).toContain('1 filter rule(s) found')
  })
  it('interface print detail punya MAC + comment', () => {
    const n = net()
    exec(n, n.devices.r, 'interface ethernet set ether1 comment=uplink')
    const d = out(n, n.devices.r, 'interface print detail')
    expect(d).toContain('uplink')
    expect(d).toContain(macOf('r', 'ether1'))
    expect(d).toContain('Flags:')
  })
  it('tool ping / tool traceroute = alias RouterOS', () => {
    const n = net()
    const a = exec(n, n.devices.r, 'tool ping 192.168.1.10')
    const b = exec(n, n.devices.r, 'ping 192.168.1.10')
    expect(a.ok).toBe(true)
    expect(a.out.length).toBe(b.out.length)
    expect(out(n, n.devices.r, 'tool traceroute 10.0.0.10')).toContain('traceroute ke 10.0.0.10')
  })
  it('ping count= dan size= diterima', () => {
    const n = net()
    const r = exec(n, n.devices.r, 'ping 192.168.1.10 count=3 size=64')
    expect(r.out.filter(l => l.startsWith('reply from'))).toHaveLength(3)
    expect(r.out.join(' ')).toContain('size=64')
    expect(exec(n, n.devices.r, 'ping').out.join(' ')).toMatch(/failure/)
  })
  it('nilai bertanda kutip tetap satu token (comment="uplink ISP")', () => {
    const n = net()
    exec(n, n.devices.r, 'interface ethernet set ether1 comment="uplink ke ISP"')
    expect(n.devices.r.ifaces.find(i => i.name === 'ether1').comment).toBe('uplink ke ISP')
    exec(n, n.devices.r, 'system identity set name="Rack Utama"')
    expect(out(n, n.devices.r, 'system identity print')).toContain('Rack Utama')
  })
  it('perintah tak didukung jujur gagal', () => {
    const n = net()
    expect(out(n, n.devices.r, 'ip firewall mangle add chain=forward')).toMatch(/failure: mangle/)
    expect(out(n, n.devices.r, 'ip firewall connection print')).toMatch(/failure/)
    expect(out(n, n.devices.r, 'caps man print')).toMatch(/failure/)
    expect(out(n, n.devices.r, 'certificate print')).toMatch(/failure/)
  })
})

describe('interface ethernet disable = tautan DOWN', () => {
  it('ping lewat port yang di-disable gagal, ARP kosong, enable memulihkan', () => {
    const n = net()
    expect(ping(n, 'pc', '10.0.0.10').ok).toBe(true)
    exec(n, n.devices.r, 'interface ethernet disable ether2')
    expect(out(n, n.devices.r, 'interface print')).toMatch(/ether2\s+disabled/)
    expect(ping(n, 'pc', '10.0.0.10').ok).toBe(false)
    expect(out(n, n.devices.r, 'ip arp print')).not.toContain('10.0.0.10')
    exec(n, n.devices.r, 'interface ethernet enable ether2')
    expect(ping(n, 'pc', '10.0.0.10').ok).toBe(true)
  })
  it('disable tidak ada / salah nama ditolak', () => {
    const n = net()
    expect(exec(n, n.devices.r, 'interface ethernet disable ether9').out.join(' ')).toMatch(/failure/)
    expect(exec(n, n.devices.r, 'interface ethernet set ether1 disabled=mungkin').out.join(' ')).toMatch(/failure/)
  })
  it('port switch yang di-disable tidak ikut STP', () => {
    const n = { devices: { sw: sw() }, links: [] }
    const pc = (id, name, x, y, addr) => ({ id, type: 'pc', name, x, y, routes: [], ifaces: [{ name: 'eth0', addr, kind: 'GBE' }] })
    n.devices.p1 = pc('p1', 'PC1', 0, 300, '192.168.1.10/24')
    n.devices.p2 = pc('p2', 'PC2', 600, 300, '192.168.1.11/24')
    n.devices.sw2 = sw(); n.devices.sw2.id = 'sw2'; n.devices.sw2.name = 'SW2'
    n.links = [
      { a: { dev: 'sw', if: 'ether1' }, b: { dev: 'sw2', if: 'ether1' } },
      { a: { dev: 'sw2', if: 'ether2' }, b: { dev: 'p1', if: 'eth0' } },
      { a: { dev: 'sw', if: 'ether2' }, b: { dev: 'p2', if: 'eth0' } }
    ]
    expect(ping(n, 'p1', '192.168.1.11').ok).toBe(true)
    // matikan jalur p1 -> p2: hanya bisa lewat SW1, link antar switch jadi uni-directional
    exec(n, n.devices.sw, 'interface ethernet disable ether2')
    expect(out(n, n.devices.sw, 'interface print')).toMatch(/ether2\s+disabled/)
    expect(ping(n, 'p1', '192.168.1.11').ok).toBe(false)
  })
})

describe('ARP / neighbor', () => {
  it('arp print menampilkan tetangga L2 + MAC', () => {
    const n = net()
    const p = out(n, n.devices.r, 'ip arp print')
    expect(p).toContain('192.168.1.10')
    expect(p).toContain(macOf('pc', 'eth0'))
    expect(p).toContain('Flags:')
  })
  it('arp remove menyembunyikan entri', () => {
    const n = net()
    exec(n, n.devices.r, 'ip arp remove address=192.168.1.10')
    expect(out(n, n.devices.r, 'ip arp print')).not.toContain('192.168.1.10')
    expect(exec(n, n.devices.r, 'ip arp remove address=1.1.1.1').out.join(' ')).toMatch(/failure/)
  })
  it('neighbor print menambah kolom identitas', () => {
    const n = net()
    const p = out(n, n.devices.r, 'ip neighbor print')
    expect(p).toContain('PC1')
    expect(p).toContain('IDENTITY')
  })
})

describe('routing dinamis neighbor', () => {
  it('ospf neighbor print menampilkan adjacency Full', () => {
    const n = net()
    n.devices.r2 = { id: 'r2', type: 'router', name: 'R2', x: 900, y: 0, routes: [], ifaces: [{ name: 'ether1', addr: '172.16.0.1/24', kind: 'GBE' }] }
    n.links.push({ a: { dev: 'r', if: 'ether3' }, b: { dev: 'r2', if: 'ether1' } })
    n.devices.r.ifaces.push({ name: 'ether3', addr: '172.16.0.2/24', kind: 'GBE' })
    exec(n, n.devices.r, 'routing ospf network add network=172.16.0.0/24')
    exec(n, n.devices.r2, 'routing ospf network add network=172.16.0.0/24')
    const p = out(n, n.devices.r, 'routing ospf neighbor print')
    expect(p).toContain('172.16.0.1')
    expect(p).toContain('Full')
    expect(out(n, n.devices.r, 'routing ospf neighbor print count-only')).toContain('1 neighbor(s) found')
    expect(out(n, n.devices.r, 'routing rip neighbor print')).toBe('(kosong)')
  })
})

describe('CMD Windows di host', () => {
  it('ipconfig dan ipconfig /all', () => {
    const n = net()
    const a = out(n, n.devices.pc, 'ipconfig')
    expect(a).toContain('Windows IP Configuration')
    expect(a).toContain('192.168.1.10/24')
    expect(a).toContain('255.255.255.0')
    const b = out(n, n.devices.pc, 'ipconfig /all')
    expect(b).toContain('Physical Address')
    expect(b).toContain('Subnet Mask')
    expect(b).toContain('Default Gateway')
  })
  it('ping -n dan -l', () => {
    const n = net()
    const r = exec(n, n.devices.pc, 'ping -n 2 -l 64 10.0.0.10')
    expect(r.ok).toBe(true)
    expect(r.out.filter(l => l.startsWith('Reply from'))).toHaveLength(2)
    expect(r.out.join(' ')).toContain('bytes=64')
    expect(r.out.join(' ')).toContain('0% loss')
    const bad = exec(n, n.devices.pc, 'ping -n 1 8.8.8.8')
    expect(bad.ok).toBe(false)
    expect(bad.out.join(' ')).toContain('100% loss')
  })
  it('tracert hanya butuh jalur pergi', () => {
    const n = net()
    n.devices.srv.routes = []
    const r = exec(n, n.devices.pc, 'tracert 10.0.0.10')
    expect(r.out.join(' ')).toContain('Trace complete.')
    expect(r.out.join(' ')).toContain('192.168.1.1')
  })
  it('arp -a, route print, netstat, getmac, hostname', () => {
    const n = net()
    expect(out(n, n.devices.pc, 'arp -a')).toContain('192.168.1.1')
    const rp = out(n, n.devices.pc, 'route print')
    expect(rp).toContain('Network Destination')
    expect(rp).toContain('0.0.0.0')
    expect(out(n, n.devices.pc, 'netstat')).toContain('Active Connections')
    expect(out(n, n.devices.pc, 'netstat -r')).toContain('Network Destination')
    expect(out(n, n.devices.pc, 'getmac')).toContain(macOf('pc', 'eth0').replace(/:/g, '-'))
    expect(out(n, n.devices.pc, 'hostname')).toBe('PC1')
  })
  it('route add/delete dengan masker desimal', () => {
    const n = net()
    expect(out(n, n.devices.pc, 'route add 0.0.0.0 mask 0.0.0.0 192.168.1.254')).toContain('Berhasil')
    expect(n.devices.pc.routes[0].gw).toBe('192.168.1.254')
    expect(out(n, n.devices.pc, 'route delete 0.0.0.0')).toContain('Berhasil')
    expect(n.devices.pc.routes).toHaveLength(0)
    expect(out(n, n.devices.pc, 'route add 0.0.0.0 mask 255.255.0.0 gateway')).toMatch(/parameter salah/)
  })
  it('cls dan echo', () => {
    const n = net()
    expect(exec(n, n.devices.pc, 'cls').clear).toBe(true)
    expect(out(n, n.devices.pc, 'echo halo dunia')).toContain('halo dunia')
  })
  it('shim RouterOS host tetap jalan berdampingan', () => {
    const n = net()
    expect(out(n, n.devices.pc, 'ip address add address=192.168.1.50/24 interface=eth0')).toBe('')
    expect(n.devices.pc.ifaces[0].addr).toBe('192.168.1.50/24')
    expect(out(n, n.devices.pc, 'ip 192.168.1.60/24 192.168.1.1 8.8.8.8')).toBe('ok')
    expect(out(n, n.devices.pc, 'help')).toContain('Konfigurasi IP')
    expect(out(n, n.devices.pc, 'export')).toContain('system identity set name=PC1')
  })
})

describe('switch parity', () => {
  it('interface print detail + resource + identity + log', () => {
    const n = { devices: { sw: sw() }, links: [] }
    expect(out(n, n.devices.sw, 'interface print detail')).toContain(macOf('sw', 'ether1'))
    expect(out(n, n.devices.sw, 'system resource print')).toMatch(/cpu-load/)
    expect(exec(n, n.devices.sw, 'system identity set name=SW-Utama').out).toEqual([])
    expect(out(n, n.devices.sw, 'system identity print')).toContain('SW-Utama')
    exec(n, n.devices.sw, 'vlan access port=ether1 id=10')
    expect(out(n, n.devices.sw, 'log print')).toContain('ether1 vlan access')
  })
  it('export switch_round-trip_vlan_dan_port_disabled', () => {
    const n = { devices: { sw: sw() }, links: [] }
    exec(n, n.devices.sw, 'vlan access port=ether2 id=20')
    exec(n, n.devices.sw, 'interface ethernet disable ether3')
    exec(n, n.devices.sw, 'interface ethernet set ether1 comment="uplink ISP"')
    const fresh = JSON.parse(JSON.stringify(n))
    fresh.devices.sw.ports = {}; fresh.devices.sw.stp = 'yes'
    for (const i of fresh.devices.sw.ifaces) { i.disabled = false; i.comment = '' }
    for (const line of exec(n, n.devices.sw, 'export').out) if (!line.startsWith('#')) exec(fresh, fresh.devices.sw, line)
    expect(fresh.devices.sw.ports.ether2).toEqual({ mode: 'access', vlan: 20 })
    expect(fresh.devices.sw.ifaces.find(i => i.name === 'ether3').disabled).toBe(true)
    expect(fresh.devices.sw.ifaces.find(i => i.name === 'ether1').comment).toBe('uplink ISP')
    expect(exec(fresh, fresh.devices.sw, 'export').out).toEqual(exec(n, n.devices.sw, 'export').out)
  })
})

describe('export round-trip untuk state baru', () => {
  const replay = (n, d) => {
    const fresh = JSON.parse(JSON.stringify(n))
    const fd = fresh.devices[d.id]
    fd.dhcp = []; fd.dhcpNets = []; fd.pools = []; fd.leases = []; fd.fw = []; fd.nat = []
    fd.addrList = []; fd.routes = []; fd.log = []
    delete fd.users   // perangkat bersih = belum punya field users sama sekali
    for (const i of fd.ifaces) { i.disabled = false; i.comment = '' }
    fd.dns = null
    for (const line of exec(n, d, 'export').out) if (!line.startsWith('#')) exec(fresh, fd, line)
    return fresh
  }
  it('users, address-list, dns, dan komentar port kembali', () => {
    const n = net()
    exec(n, n.devices.r, 'user add name=operator group=read')
    exec(n, n.devices.r, 'ip firewall address-list add list=blokir address=10.0.0.9')
    exec(n, n.devices.r, 'interface ethernet set ether1 disabled=yes comment=jumbotron')
    const fresh = replay(n, n.devices.r)
    const f = fresh.devices.r
    expect(f.users.map(u => u.name).sort()).toEqual(['admin', 'operator'])
    expect(f.addrList[0]).toMatchObject({ list: 'blokir', address: '10.0.0.9' })
    expect(f.ifaces.find(i => i.name === 'ether1')).toMatchObject({ disabled: true, comment: 'jumbotron' })
    expect(exec(fresh, f, 'export').out).toEqual(exec(n, n.devices.r, 'export').out)
  })
  it('user remove admin ikut diekspor', () => {
    const n = net()
    exec(n, n.devices.r, 'user remove name=admin')
    const fresh = replay(n, n.devices.r)
    expect(fresh.devices.r.users).toEqual([])
    expect(exec(fresh, fresh.devices.r, 'export').out).toEqual(exec(n, n.devices.r, 'export').out)
  })
  it('jam manual ikut diekspor', () => {
    const n = net()
    exec(n, n.devices.r, 'system clock set date=2026-03-04 time=07:08')
    const fresh = replay(n, n.devices.r)
    expect(fresh.devices.r.clockDate).toBe('2026-03-04')
    expect(exec(fresh, fresh.devices.r, 'export').out).toEqual(exec(n, n.devices.r, 'export').out)
  })
})

describe('helper murni', () => {
  it('parsePingArgs membaca gaya RouterOS dan Windows', () => {
    expect(parsePingArgs(['1.1.1.1'], {})).toMatchObject({ count: 4, size: 32, target: '1.1.1.1' })
    expect(parsePingArgs(['-n', '5', '1.1.1.1'], {})).toMatchObject({ count: 5, target: '1.1.1.1' })
    expect(parsePingArgs(['-l', '64', '1.1.1.1'], {})).toMatchObject({ size: 64 })
    expect(parsePingArgs(['-c3', '1.1.1.1'], {})).toMatchObject({ count: 3 })
    expect(parsePingArgs(['1.1.1.1'], { count: '2', size: '128' })).toMatchObject({ count: 2, size: 128 })
    expect(parsePingArgs([], {})).toMatchObject({ target: null })
  })
  it('masker dan mask', () => {
    expect(maskOf(24)).toBe('255.255.255.0')
    expect(maskOf(0)).toBe('0.0.0.0')
    expect(lenOfMask('255.255.255.0')).toBe(24)
    expect(lenOfMask('0.0.0.0')).toBe(0)
    expect(lenOfMask('255.0.255.0')).toBe(null)
    expect(lenOfMask('bukan-mask')).toBe(null)
  })
  it('macOf stabil dan berbeda per iface', () => {
    expect(macOf('r', 'ether1')).toBe(macOf('r', 'ether1'))
    expect(macOf('r', 'ether1')).not.toBe(macOf('r', 'ether2'))
    expect(macOf('r', 'ether1')).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/)
  })
})

describe('help + completion tetap sinkron', () => {
  it('setiap perintah baru punya entri help + katalog', () => {
    const routerCmds = CMDS.router.join(' ')
    const hostCmds = CMDS.host.join(' ')
    const all = HELP.map(h => h.cmd).join(' ')
    for (const s of ['ip arp print', 'ip service print', 'system resource print', 'interface ethernet disable', 'log print', 'user add']) expect(routerCmds).toContain(s)
    for (const s of ['tracert', 'arp -a', 'route print', 'netstat', 'getmac', 'ipconfig']) expect(all).toContain(s)
    expect(hostCmds).toContain('ipconfig /all')
  })
  it('help topik baru menjawab', () => {
    const n = net()
    expect(out(n, n.devices.r, 'help interface')).toContain('interface ethernet disable')
    expect(out(n, n.devices.r, 'help system')).toMatch(/resource/)
    expect(out(n, n.devices.pc, 'help windows cmd')).toContain('ipconfig')
  })
})