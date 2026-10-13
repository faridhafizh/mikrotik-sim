import { describe, it, expect } from 'vitest'
import { exec, ping, ping6, bw, wifiLinks, converge, stpBlocked } from '../src/engine.js'
import { validateTopo } from '../src/stores/net.js'

const R = (id, name, x, y, ifaces = {}) => ({ id, type: 'router', name, x, y, routes: [], ifaces: Object.entries(ifaces).map(([n, addr]) => ({ name: n, addr })) })
const PC = (id, name, x, y, addr, gw) => ({ id, type: 'pc', name, x, y, routes: gw ? [{ dst: '0.0.0.0/0', gw }] : [], ifaces: [{ name: 'eth0', addr }] })
const wan = () => {
  const net = { devices: {}, links: [] }
  net.devices.a = PC('a', 'PC1', 0, 0, '192.168.1.10/24', '192.168.1.1')
  net.devices.r = R('r', 'R1', 300, 0, { ether1: '192.168.1.1/24', ether2: '10.0.0.1/24' })
  net.devices.s = { id: 's', type: 'server', name: 'SRV', x: 600, y: 0, routes: [{ dst: '0.0.0.0/0', gw: '10.0.0.1' }], ifaces: [{ name: 'eth0', addr: '10.0.0.10/24' }] }
  net.links = [{ a: { dev: 'a', if: 'eth0' }, b: { dev: 'r', if: 'ether1' } }, { a: { dev: 'r', if: 'ether2' }, b: { dev: 's', if: 'eth0' } }]
  return net
}
const wifiNet = () => {
  const net = { devices: {}, links: [] }
  net.devices.r1 = { id: 'r1', type: 'router', name: 'R1', x: 300, y: 220, routes: [], ifaces: [{ name: 'ether1', addr: null }, { name: 'wlan1', addr: '192.168.10.1/24' }] }
  net.devices.lt = { id: 'lt', type: 'laptop', name: 'LT1', x: 380, y: 220, routes: [{ dst: '0.0.0.0/0', gw: '192.168.10.1' }], ifaces: [{ name: 'wlan0', addr: '192.168.10.11/24' }] }
  net.devices.r2 = { id: 'r2', type: 'router', name: 'R2', x: 420, y: 220, routes: [], ifaces: [{ name: 'ether1', addr: null }, { name: 'wlan1', addr: '192.168.10.2/24' }] }
  exec(net, net.devices.r1, 'interface wireless set wlan1 ssid=LabWiFi password=rahasia123 mode=ap-bridge')
  net.devices.lt.wifi = { ssid: 'LabWiFi', pass: 'rahasia123' }
  return net
}

describe('ping dua subnet via R1', () => {
  it('PC1 mencapai server lewat dua hop', () => {
    const net = wan()
    const r = ping(net, 'a', '10.0.0.10')
    expect(r.ok).toBe(true)
  })
})

describe('simple queue', () => {
  it('bw cap 2M/5M mirror lab5', () => {
    const net = wan()
    exec(net, net.devices.r, 'queue simple add name=q target=192.168.1.0/24 max-limit=2M/5M')
    const r = bw(net, 'a', '10.0.0.10')
    expect(r.ok).toBe(true)
    expect(r.tx).toBeLessThanOrEqual(2)
    expect(r.rx).toBeLessThanOrEqual(5)
  })
})

describe('queue tree + pcq', () => {
  it('tree match-all membatasi kedua arah + pcq rate', () => {
    const net = wan()
    expect(exec(net, net.devices.r, 'queue type add name=pcq-down kind=pcq pcq-rate=5M pcq-classifier=dst-address').out).toEqual([])
    expect(exec(net, net.devices.r, 'queue tree add name=t parent=global max-limit=2M/5M queue=pcq-down').out).toEqual([])
    const p = exec(net, net.devices.r, 'queue tree print')
    expect(p.out.join('\n')).toContain('t')
    const r = bw(net, 'a', '10.0.0.10')
    expect(r.tx).toBeLessThanOrEqual(2)
    expect(r.rx).toBeLessThanOrEqual(5)
  })
  it('parent selain global ditolak', () => {
    const net = wan()
    const r = exec(net, net.devices.r, 'queue tree add name=t parent=ether1 max-limit=2M/5M')
    expect(r.out.join(' ')).toMatch(/failure/)
  })
})

describe('wifi ap vs station', () => {
  it('laptop terasosiasi dalam jangkauan', () => {
    expect(wifiLinks(wifiNet()).some(w => w.cl === 'lt')).toBe(true)
  })
  it('station terhubung dan ping via AP', () => {
    const net = wifiNet()
    exec(net, net.devices.r2, 'interface wireless set wlan1 ssid=LabWiFi password=rahasia123 mode=station')
    expect(wifiLinks(net).some(w => w.cl === 'r2')).toBe(true)
    expect(ping(net, 'lt', '192.168.10.2').ok).toBe(true)
  })
  it('password salah tidak terhubung', () => {
    const net = wifiNet()
    exec(net, net.devices.r2, 'interface wireless set wlan1 ssid=LabWiFi password=salah1234 mode=station')
    expect(wifiLinks(net).some(w => w.cl === 'r2')).toBe(false)
  })
  it('di luar RANGE tidak terhubung', () => {
    const net = wifiNet()
    exec(net, net.devices.r2, 'interface wireless set wlan1 ssid=LabWiFi password=rahasia123 mode=station')
    net.devices.r2.x = 900
    expect(wifiLinks(net).some(w => w.cl === 'r2')).toBe(false)
  })
})

describe('VLAN isolasi mirror lab3', () => {
  it('vlan 10 vs 20 terpisah', () => {
    const net = { devices: {}, links: [] }
    net.devices.sw = { id: 'sw', type: 'switch', name: 'SW1', x: 360, y: 160, routes: [], ifaces: ['ether1', 'ether2', 'ether3'].map(name => ({ name, addr: null })) }
    net.devices.p1 = PC('p1', 'PC1', 200, 330, '192.168.10.11/24', null)
    net.devices.p2 = PC('p2', 'PC2', 360, 330, '192.168.10.12/24', null)
    net.devices.p3 = PC('p3', 'PC3', 520, 330, '192.168.10.13/24', null)
    net.links = [{ a: { dev: 'p1', if: 'eth0' }, b: { dev: 'sw', if: 'ether1' } }, { a: { dev: 'p2', if: 'eth0' }, b: { dev: 'sw', if: 'ether2' } }, { a: { dev: 'p3', if: 'eth0' }, b: { dev: 'sw', if: 'ether3' } }]
    exec(net, net.devices.sw, 'vlan access port=ether1 id=10')
    exec(net, net.devices.sw, 'vlan access port=ether2 id=10')
    exec(net, net.devices.sw, 'vlan access port=ether3 id=20')
    expect(ping(net, 'p1', '192.168.10.12').ok).toBe(true)
    expect(ping(net, 'p1', '192.168.10.13').ok).toBe(false)
  })
  it('vlan remove kembali ke access vlan 1', () => {
    const net = { devices: { sw: { id: 'sw', type: 'switch', name: 'SW1', x: 0, y: 0, routes: [], ifaces: [{ name: 'ether1', addr: null }] } }, links: [] }
    exec(net, net.devices.sw, 'vlan access port=ether1 id=10')
    expect(exec(net, net.devices.sw, 'vlan print').out.join('\n')).toContain('vlan 10')
    exec(net, net.devices.sw, 'vlan remove port=ether1')
    expect(exec(net, net.devices.sw, 'vlan print').out.join('\n')).toContain('vlan 1')
  })
})

describe('help CLI', () => {
  it('help tanpa argumen memberi daftar', () => {
    const net = wan()
    const r = exec(net, net.devices.r, 'help')
    expect(r.out.join('\n')).toContain('Alamat IP')
  })
  it('help topik memberi contoh', () => {
    const net = wan()
    const r = exec(net, net.devices.r, 'help dhcp')
    expect(r.out.join('\n')).toContain('ip pool add')
  })
  it('help topik asing diarahkan ke help', () => {
    const net = wan()
    expect(exec(net, net.devices.r, 'help halilintar').out.join(' ')).toContain('help')
    expect(exec(net, net.devices.a, 'help').out.join('\n')).toContain('dhcp')
  })
  it('perintah tak dikenal menyuruh help', () => {
    const net = wan()
    expect(exec(net, net.devices.r, 'foobar').out.join(' ')).toContain('help')
  })
})

describe('alias host ala router', () => {
  it('ip address add / ip route add / ip dns set', () => {
    const net = wan()
    exec(net, net.devices.a, 'ip address add address=192.168.1.99/24 interface=eth0')
    exec(net, net.devices.a, 'ip route add dst-address=0.0.0.0/0 gateway=192.168.1.1')
    exec(net, net.devices.a, 'ip dns set servers=8.8.8.8')
    expect(net.devices.a.ifaces[0].addr).toBe('192.168.1.99/24')
    expect(net.devices.a.routes[0].gw).toBe('192.168.1.1')
    expect(net.devices.a.dns).toBe('8.8.8.8')
    expect(exec(net, net.devices.a, 'ip address print').out.join(' ')).toContain('eth0')
  })
})

describe('alias switch bridge vlan', () => {
  it('interface bridge vlan add', () => {
    const net = { devices: { sw: { id: 'sw', type: 'switch', name: 'SW1', x: 0, y: 0, routes: [], ifaces: [{ name: 'ether1', addr: null }] } }, links: [] }
    exec(net, net.devices.sw, 'interface bridge vlan add vlan-ids=10 interface=ether1')
    expect(exec(net, net.devices.sw, 'vlan print').out.join(' ')).toContain('vlan 10')
  })
})

describe('speedtest di router', () => {
  it('jalan sebagai alias bandwidth-test', () => {
    const net = wan()
    const r = exec(net, net.devices.r, 'speedtest 10.0.0.10')
    expect(r.ok).toBe(true)
    expect(r.out.join(' ')).toContain('Mbps')
  })
})

describe('remove entri', () => {
  it('ip address remove by interface', () => {
    const net = wan()
    expect(exec(net, net.devices.r, 'ip address remove interface=ether1').out).toEqual([])
    expect(net.devices.r.ifaces.find(i => i.name === 'ether1').addr).toBe(null)
  })
  it('ip route remove by dst-address', () => {
    const net = wan()
    exec(net, net.devices.r, 'ip route add dst-address=8.8.8.8/32 gateway=10.0.0.1')
    exec(net, net.devices.r, 'ip route remove dst-address=8.8.8.8/32')
    expect(net.devices.r.routes.length).toBe(0)
  })
  it('queue simple remove by name', () => {
    const net = wan()
    exec(net, net.devices.r, 'queue simple add name=q target=192.168.1.0/24 max-limit=2M/5M')
    exec(net, net.devices.r, 'queue simple remove name=q')
    expect((net.devices.r.queues || []).length).toBe(0)
  })
  it('numbers di luar rentang gagal', () => {
    const net = wan()
    expect(exec(net, net.devices.r, 'ip address remove numbers=9').out.join(' ')).toMatch(/failure/)
  })
  it('ip firewall filter remove by numbers', () => {
    const net = wan()
    exec(net, net.devices.r, 'ip firewall filter add chain=forward action=drop')
    exec(net, net.devices.r, 'ip firewall filter remove numbers=0')
    expect((net.devices.r.fw || []).length).toBe(0)
  })
})

describe('dhcp client di router', () => {
  const dhcpNet = () => {
    const net = { devices: {}, links: [] }
    net.devices.srv = { id: 'srv', type: 'router', name: 'R2', x: 600, y: 0, routes: [], ifaces: [{ name: 'ether1', addr: '10.0.0.1/24' }, { name: 'wlan1', addr: null }] }
    net.devices.cli = { id: 'cli', type: 'router', name: 'R1', x: 300, y: 0, routes: [], ifaces: [{ name: 'ether1', addr: null }, { name: 'wlan1', addr: null }] }
    net.links = [{ a: { dev: 'cli', if: 'ether1' }, b: { dev: 'srv', if: 'ether1' } }]
    exec(net, net.devices.srv, 'ip pool add name=p ranges=10.0.0.10-10.0.0.20')
    exec(net, net.devices.srv, 'ip dhcp-server network add address=10.0.0.0/24 gateway=10.0.0.1')
    exec(net, net.devices.srv, 'ip dhcp-server add name=d interface=ether1 address-pool=p')
    return net
  }
  it('renew dapat IP, release mengosongkan', () => {
    const net = dhcpNet()
    exec(net, net.devices.cli, 'ip dhcp-client add interface=ether1')
    const r = exec(net, net.devices.cli, 'ip dhcp-client renew')
    expect(r.out.join(' ')).toContain('bound')
    expect(net.devices.cli.ifaces[0].addr).toMatch(/^10\.0\.0\.1[0-9]\/24$/)
    expect(net.devices.cli.routes[0].dhcp).toBe(true)
    exec(net, net.devices.cli, 'ip dhcp-client release')
    expect(net.devices.cli.ifaces[0].addr).toBe(null)
    expect(net.devices.cli.routes.length).toBe(0)
  })
  it('ping ke server setelah bound', () => {
    const net = dhcpNet()
    exec(net, net.devices.cli, 'ip dhcp-client add interface=ether1')
    exec(net, net.devices.cli, 'ip dhcp-client renew')
    expect(ping(net, 'cli', '10.0.0.1').ok).toBe(true)
  })
})

describe('export', () => {
  it('mencetak skrip konfigurasi', () => {
    const net = wan()
    exec(net, net.devices.r, 'ip address add address=192.168.1.1/24 interface=ether1')
    exec(net, net.devices.r, 'ip address add address=10.0.0.1/24 interface=ether2')
    exec(net, net.devices.r, 'ip route add dst-address=0.0.0.0/0 gateway=10.0.0.2')
    const out = exec(net, net.devices.r, 'export').out.join('\n')
    expect(out).toContain('ip address add address=192.168.1.1/24')
    expect(out).toContain('ip route add dst-address=0.0.0.0/0')
  })
  it('export dapat dipakai ulang di perangkat bersih', () => {
    const net = wan()
    exec(net, net.devices.r, 'queue simple add name=q target=192.168.1.0/24 max-limit=2M/5M')
    exec(net, net.devices.r, 'ip dns static add name=web address=10.0.0.10')
    const script = exec(net, net.devices.r, 'export').out
    const fresh = JSON.parse(JSON.stringify(net))
    fresh.devices.r.queues = []; fresh.devices.r.dnsStatic = []; fresh.devices.r.routes = []
    for (const line of script) if (!line.startsWith('#')) exec(fresh, fresh.devices.r, line)
    expect(exec(fresh, fresh.devices.r, 'export').out).toEqual(exec(net, net.devices.r, 'export').out)
  })
})

describe('validateTopo impor', () => {
  const good = () => ({ devices: { d1: { id: 'd1', type: 'pc', x: 0, y: 0, name: 'PC1', ifaces: [{ name: 'eth0', addr: null }], routes: [] } }, links: [] })
  it('menerima snap valid dan wrapper {data}', () => {
    expect(validateTopo(good())).toBe(true)
    expect(validateTopo({ name: 'x', data: good() })).toBe(true)
    expect(validateTopo({ devices: {}, links: [] })).toBe(true)
  })
  it('menolak device berlebih dan link rusak', () => {
    const many = { devices: {}, links: [] }
    for (let i = 0; i < 61; i++) many.devices['d' + i] = { id: 'd' + i, type: 'pc', x: 0, y: 0, name: 'P', ifaces: [], routes: [] }
    expect(validateTopo(many)).toBe(false)
    expect(validateTopo({ devices: {}, links: [{ a: { dev: 'd1' } }] })).toBe(false)
    expect(validateTopo({ devices: 'x', links: [] })).toBe(false)
  })
})

describe('dstnat + filter proto/port', () => {
  const natNet = () => {
    const net = wan()
    exec(net, net.devices.r, 'ip firewall nat add chain=dstnat action=dst-nat to-addresses=10.0.0.10 protocol=tcp dst-port=80 to-ports=80 in-interface=ether1')
    return net
  }
  it('dstnat rewrite path dan filter icmp drop memblokir ping', () => {
    const net = natNet()
    exec(net, net.devices.r, 'ip firewall filter add chain=forward action=accept protocol=tcp dst-port=80')
    exec(net, net.devices.r, 'ip firewall filter add chain=forward action=drop protocol=icmp')
    const p = ping(net, 'a', '10.0.0.10')
    expect(p.ok).toBe(false)
    const b = bw(net, 'a', '10.0.0.10')
    expect(b.ok).toBe(true)
  })
  it('dstnat print/export membulatkan state', () => {
    const net = natNet()
    const pr = exec(net, net.devices.r, 'ip firewall nat print').out.join('\n')
    expect(pr).toContain('dstnat')
    const fresh = JSON.parse(JSON.stringify(net))
    fresh.devices.r.nat = []
    for (const line of exec(net, net.devices.r, 'export').out) if (!line.startsWith('#')) exec(fresh, fresh.devices.r, line)
    expect(JSON.stringify(fresh.devices.r.nat)).toBe(JSON.stringify(net.devices.r.nat))
  })
  it('filter accept hanya match proto/port yang sama', () => {
    const net = wan()
    exec(net, net.devices.r, 'ip firewall filter add chain=forward action=drop protocol=tcp dst-port=443')
    expect(ping(net, 'a', '10.0.0.10').ok).toBe(true)
    exec(net, net.devices.r, 'ip firewall filter add chain=forward action=drop protocol=icmp')
    expect(ping(net, 'a', '10.0.0.10').ok).toBe(false)
  })
  it('validasi protocol/dst-port salah ditolak', () => {
    const net = wan()
    expect(exec(net, net.devices.r, 'ip firewall filter add chain=forward action=drop protocol=gre').out.join(' ')).toMatch(/failure/)
    expect(exec(net, net.devices.r, 'ip firewall filter add chain=forward action=drop dst-port=70000').out.join(' ')).toMatch(/failure/)
    expect(exec(net, net.devices.r, 'ip firewall nat add chain=dstnat action=dst-nat to-addresses=999.1.1.1').out.join(' ')).toMatch(/failure/)
  })
})

describe('RSTP anti-loop', () => {
  const loopNet = () => {
    const net = { devices: {}, links: [] }
    const sw = (id, name) => ({ id, type: 'switch', name, x: 0, y: 0, routes: [], ifaces: ['ether1', 'ether2', 'ether3'].map(n => ({ name: n, addr: null })), stp: 'yes' })
    net.devices.s1 = sw('s1', 'SW1'); net.devices.s2 = sw('s2', 'SW2'); net.devices.s3 = sw('s3', 'SW3')
    net.devices.p1 = PC('p1', 'PC1', 0, 0, '192.168.1.10/24', null)
    net.devices.p2 = PC('p2', 'PC2', 0, 0, '192.168.1.11/24', null)
    net.links = [
      { a: { dev: 's1', if: 'ether1' }, b: { dev: 's2', if: 'ether1' } },
      { a: { dev: 's2', if: 'ether2' }, b: { dev: 's3', if: 'ether1' } },
      { a: { dev: 's1', if: 'ether2' }, b: { dev: 's3', if: 'ether2' } },
      { a: { dev: 'p1', if: 'eth0' }, b: { dev: 's1', if: 'ether3' } },
      { a: { dev: 'p2', if: 'eth0' }, b: { dev: 's3', if: 'ether3' } },
    ]
    return net
  }
  it('loop fisik tetap ping via RSTP', () => {
    const net = loopNet()
    expect(stpBlocked(net).size).toBeGreaterThan(0)
    expect(ping(net, 'p1', '192.168.1.11').ok).toBe(true)
  })
  it('stp print menunjukkan blocked', () => {
    const net = loopNet()
    const pr = exec(net, net.devices.s1, 'interface bridge stp print').out.join(' ')
    expect(pr).toContain('stp: yes')
    expect(pr).toContain('blocked:')
  })
  it('stp=no di semua switch membuat loop bocor', () => {
    const net = loopNet()
    for (const id of ['s1', 's2', 's3']) exec(net, net.devices[id], 'interface bridge set stp=no')
    expect(stpBlocked(net).size).toBe(0)
    expect(ping(net, 'p1', '192.168.1.11').ok).toBe(false)
  })
  it('stp=salah ditolak', () => {
    const net = loopNet()
    expect(exec(net, net.devices.s1, 'interface bridge set stp=maybe').out.join(' ')).toMatch(/failure/)
  })
})

describe('IPv6 ping antar-subnet', () => {
  const v6Net = () => {
    const net = { devices: {}, links: [] }
    net.devices.a = PC('a', 'PC1', 0, 0, null, null)
    net.devices.r = R('r', 'R1', 300, 0, { ether1: null, ether2: null })
    net.devices.b = PC('b', 'PC2', 600, 0, null, null)
    net.links = [{ a: { dev: 'a', if: 'eth0' }, b: { dev: 'r', if: 'ether1' } }, { a: { dev: 'r', if: 'ether2' }, b: { dev: 'b', if: 'eth0' } }]
    exec(net, net.devices.a, 'ipv6 address add address=2001:db8:1::1/64 interface=eth0')
    exec(net, net.devices.r, 'ipv6 address add address=2001:db8:1::2/64 interface=ether1')
    exec(net, net.devices.r, 'ipv6 address add address=2001:db8:2::1/64 interface=ether2')
    exec(net, net.devices.b, 'ipv6 address add address=2001:db8:2::2/64 interface=eth0')
    exec(net, net.devices.a, 'ipv6 route add dst-address=::/0 gateway=2001:db8:1::2')
    exec(net, net.devices.b, 'ipv6 route add dst-address=::/0 gateway=2001:db8:2::1')
    return net
  }
  it('ping6 antar-subnet ok', () => {
    const net = v6Net()
    const r = ping6(net, 'a', '2001:db8:2::2')
    expect(r.ok).toBe(true)
    expect(ping(net, 'a', '2001:db8:2::2').ok).toBe(false)
  })
it('ping lewat CLI memilih jalur v6', () => {
    const net = v6Net()
    const r = exec(net, net.devices.a, 'ping 2001:db8:2::2')
    expect(r.ok).toBe(true)
    expect(r.out.join(' ')).toMatch(/reply from 2001:db8:2::2/i)
  })
  it('export membulatkan state ipv6', () => {
    const net = v6Net()
    const fresh = JSON.parse(JSON.stringify(net))
    for (const id of ['a', 'r', 'b']) { fresh.devices[id].ifaces.forEach(i => i.addr6 = null); fresh.devices[id].routes6 = [] }
    for (const id of ['a', 'r', 'b']) for (const line of exec(net, net.devices[id], 'export').out) if (!line.startsWith('#')) exec(fresh, fresh.devices[id], line)
    expect(ping6(fresh, 'a', '2001:db8:2::2').ok).toBe(true)
  })
  it('alamat v6 salah ditolak', () => {
    const net = v6Net()
    expect(exec(net, net.devices.a, 'ipv6 address add address=not-an-ip/64 interface=eth0').out.join(' ')).toMatch(/failure/)
    expect(exec(net, net.devices.a, 'ipv6 route add dst-address=::/0 gateway=192.168.1.1').out.join(' ')).toMatch(/failure/)
  })
})

