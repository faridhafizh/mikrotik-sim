// Validator lab memakai engine yang sama dengan frontend (src/engine.js)
import { ping, ping6, bw, wifiLinks, resolveDns, converge } from '../src/engine.js'
import { buildIfaces, defaultProfileFor } from '../src/linkmodel.js'
const dev = (n, name) => Object.values(n.devices).find(d => d.name === name)
const ip = d => d?.ifaces.find(i => i.addr)?.addr.split('/')[0]
const ip6 = d => d?.ifaces.find(i => i.addr6)?.addr6?.split('/')[0]
const can = (n, a, b) => { const A = dev(n, a), B = dev(n, b); return !!(A && ip(B) && ping(n, A.id, ip(B)).ok) }
const can6 = (n, a, b) => { const A = dev(n, a), B = dev(n, b); return !!(A && ip6(B) && ping6(n, A.id, ip6(B)).ok) }
const has = (n, name, f) => { const d = dev(n, name); return !!d && f(d) }
const noStatic = (n, ...names) => names.every(x => has(n, x, d => !d.routes.length))

const bwOk = (n, a, b, tx, rx) => { const A = dev(n, a), B = dev(n, b); if (!A || !ip(B)) return false; const r = bw(n, A.id, ip(B)); return !!r.ok && r.tx <= tx && r.rx <= rx }

// Topologi awal tiap lab
const mk = (id, type, name, x, y, ad = {}, gw) => {
  const profileId = defaultProfileFor(type)
  const ifaces = profileId ? buildIfaces(profileId) : [{ name: 'wlan0', addr: null }]
  for (const i of ifaces) i.addr = ad[i.name] || null
  const d = { id, type, name, x, y, routes: gw ? [{ dst: '0.0.0.0/0', gw }] : [], routes6: [], dns6: null, ifaces }
  if (profileId) d.profileId = profileId
  if (type === 'switch') d.stp = 'yes'
  return d
}
const L = (a, ai, b, bi, cable = 'cat6') => ({ a: { dev: a, if: ai }, b: { dev: b, if: bi }, cable })
const topo = (devs, links) => ({ devices: Object.fromEntries(devs.map(d => [d.id, d])), links })

export const LABS = [
  { id: 'lab1', title: 'Satu router, dua jaringan', desc: 'PC1 dan PC2 sudah terkabel ke R1. Beri R1 alamat di tiap port (subnet berbeda), beri PC IP dan gateway, lalu PC1 harus bisa ping PC2.',
    seed: topo([mk('d1', 'pc', 'PC1', 140, 220), mk('d2', 'router', 'R1', 360, 220), mk('d3', 'pc', 'PC2', 580, 220)], [L('d1', 'eth0', 'd2', 'ether1'), L('d3', 'eth0', 'd2', 'ether2')]),
    steps: [
      { title: 'Siapkan LAN', hint: 'R1: ip address add address=192.168.1.1/24 interface=ether1 (dan 192.168.2.1/24 di ether2)\nPC1/PC2: ip 192.168.1.10/24 192.168.1.1', checks: [['PC1 dan PC2 sudah punya IP', n => !!ip(dev(n, 'PC1')) && !!ip(dev(n, 'PC2'))], ['R1 menjadi penghubung (punya 2 alamat)', n => has(n, 'R1', d => d.ifaces.filter(i => i.addr).length >= 2)]] },
      { title: 'Verifikasi', hint: 'PC1: ping 192.168.2.10', checks: [['PC1 berhasil ping PC2', n => can(n, 'PC1', 'PC2')]] },
    ] },
  { id: 'lab2', title: 'NAT masquerade ke ISP', desc: 'Sisi ISP (R2 dan SRV) sudah dikonfigurasi dan tidak punya route ke LAN. Atur LAN PC1 dan R1 (ether2 = 10.0.0.1/24, default route ke 10.0.0.2), lalu pasang masquerade supaya PC1 bisa ping SRV.',
    seed: topo([mk('d1', 'pc', 'PC1', 110, 220), mk('d2', 'router', 'R1', 300, 220), mk('d3', 'router', 'R2', 500, 220, { ether1: '10.0.0.2/24', ether2: '203.0.113.1/24' }), mk('d4', 'server', 'SRV', 700, 220, { eth0: '203.0.113.10/24' }, '203.0.113.1')], [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'ether1'), L('d3', 'ether2', 'd4', 'eth0')]),
    steps: [
      { title: 'Atur LAN & route', hint: 'PC1: ip 192.168.1.10/24 192.168.1.1\nR1: ip address add address=192.168.1.1/24 interface=ether1\nR1: ip address add address=10.0.0.1/24 interface=ether2\nR1: ip route add dst-address=0.0.0.0/0 gateway=10.0.0.2', checks: [['R2 tanpa route ke LAN (tanpa static/RIP/OSPF)', n => has(n, 'R2', d => !d.routes.length && !d.rip?.length && !d.ospf?.length)]] },
      { title: 'Pasang NAT', hint: 'R1: ip firewall nat add chain=srcnat action=masquerade out-interface=ether2', checks: [['R1 punya aturan srcnat masquerade', n => has(n, 'R1', d => d.nat?.length > 0)]] },
      { title: 'Verifikasi', hint: 'PC1: ping 203.0.113.10', checks: [['PC1 berhasil ping SRV', n => can(n, 'PC1', 'SRV')]] },
    ] },
  { id: 'lab3', title: 'Pisahkan jaringan dengan VLAN', desc: 'PC1, PC2, PC3 satu subnet dan satu switch. Buat PC1 dan PC2 di VLAN 10 serta PC3 di VLAN 20 (vlan access port=... id=...), sehingga PC1 bisa ping PC2 tetapi tidak PC3.',
    seed: topo([mk('d1', 'switch', 'SW1', 360, 160), mk('d2', 'pc', 'PC1', 200, 330, { eth0: '192.168.10.11/24' }), mk('d3', 'pc', 'PC2', 360, 330, { eth0: '192.168.10.12/24' }), mk('d4', 'pc', 'PC3', 520, 330, { eth0: '192.168.10.13/24' })], [L('d2', 'eth0', 'd1', 'ether1'), L('d3', 'eth0', 'd1', 'ether2'), L('d4', 'eth0', 'd1', 'ether3')]),
    steps: [
      { title: 'Set VLAN per port', hint: 'SW1: vlan access port=ether1 id=10\nSW1: vlan access port=ether2 id=10\nSW1: vlan access port=ether3 id=20', checks: [['PC1 berhasil ping PC2', n => can(n, 'PC1', 'PC2')]] },
      { title: 'Verifikasi isolasi', hint: 'PC1: ping 192.168.10.13 harus gagal', checks: [['PC3 punya IP dan terisolasi dari PC1', n => !!ip(dev(n, 'PC3')) && !can(n, 'PC1', 'PC3')]] },
    ] },
  { id: 'lab4', title: 'Routing dinamis dengan OSPF', desc: 'Alamat semua router dan PC sudah diatur. Tanpa route statis, aktifkan OSPF di R1, R2, R3 (/routing ospf network add network=...) supaya PC1 bisa ping PC2.',
    seed: topo([mk('d1', 'pc', 'PC1', 80, 220, { eth0: '192.168.1.10/24' }, '192.168.1.1'), mk('d2', 'router', 'R1', 250, 220, { ether1: '192.168.1.1/24', ether2: '10.0.12.1/24' }), mk('d3', 'router', 'R2', 450, 220, { ether1: '10.0.12.2/24', ether2: '10.0.23.2/24' }), mk('d4', 'router', 'R3', 650, 220, { ether1: '10.0.23.3/24', ether2: '192.168.3.1/24' }), mk('d5', 'pc', 'PC2', 820, 220, { eth0: '192.168.3.10/24' }, '192.168.3.1')],
      [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'ether1'), L('d3', 'ether2', 'd4', 'ether1'), L('d4', 'ether2', 'd5', 'eth0')]),
    steps: [
      { title: 'Aktifkan OSPF', hint: 'R1: routing ospf network add network=192.168.1.0/24 (dan 10.0.12.0/24)\nR2: 10.0.12.0/24 + 10.0.23.0/24\nR3: 10.0.23.0/24 + 192.168.3.0/24', checks: [['R1, R2, R3 tanpa route statis', n => noStatic(n, 'R1', 'R2', 'R3')], ['R1 belajar rute lewat OSPF', n => { converge(n); return has(n, 'R1', d => (d.dyn || []).some(r => r.proto === 'ospf')) }]] },
      { title: 'Verifikasi', hint: 'PC1: ping 192.168.3.10', checks: [['PC1 berhasil ping PC2', n => can(n, 'PC1', 'PC2')]] },
    ] },
  { id: 'lab5', title: 'Batasi bandwidth dengan queue', desc: 'Jaringan sudah berjalan. Di R1 buat simple queue untuk LAN 192.168.1.0/24 dengan max-limit=2M/5M (upload/download), lalu uji dari PC1 dengan speedtest 10.0.0.10.',
    seed: topo([mk('d1', 'pc', 'PC1', 140, 220, { eth0: '192.168.1.10/24' }, '192.168.1.1'), mk('d2', 'router', 'R1', 360, 220, { ether1: '192.168.1.1/24', ether2: '10.0.0.1/24' }), mk('d3', 'server', 'SRV', 580, 220, { eth0: '10.0.0.10/24' }, '10.0.0.1')], [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'eth0')]),
    steps: [
      { title: 'Buat queue', hint: 'R1: queue simple add name=q target=192.168.1.0/24 max-limit=2M/5M', checks: [['R1 punya simple queue', n => has(n, 'R1', d => d.queues?.length > 0)], ['PC1 terhubung ke SRV', n => can(n, 'PC1', 'SRV')]] },
      { title: 'Ukur bandwidth', hint: 'PC1: speedtest 10.0.0.10', checks: [['Upload PC1 maksimal 2 Mbps dan download maksimal 5 Mbps', n => bwOk(n, 'PC1', 'SRV', 2, 5)]] },
    ] },
  { id: 'lab6', title: 'Hotspot Wi-Fi', desc: 'Atur R1 sebagai AP: /interface wireless set wlan1 ssid=LabWiFi password=rahasia123 mode=ap-bridge, beri wlan1 IP, aktifkan DHCP server di wlan1. Di LT1 jalankan wifi connect lalu dhcp, dan LT1 harus bisa ping R1.',
    seed: topo([mk('d1', 'router', 'R1', 300, 220), mk('d2', 'laptop', 'LT1', 480, 220)], []),
    steps: [
      { title: 'Siapkan AP', hint: 'R1: interface wireless set wlan1 ssid=LabWiFi password=rahasia123 mode=ap-bridge\nR1: ip address add address=192.168.10.1/24 interface=wlan1', checks: [['R1 memancarkan SSID', n => has(n, 'R1', d => !!d.wlan?.ssid)]] },
      { title: 'DHCP server', hint: 'R1: ip pool add name=p ranges=192.168.10.10-192.168.10.20\nR1: ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1\nR1: ip dhcp-server add name=d interface=wlan1 address-pool=p', checks: [['LT1 mendapat IP dari DHCP R1', n => has(n, 'R1', d => (d.leases || []).some(x => x.by === dev(n, 'LT1')?.id))]] },
      { title: 'Hubungkan klien', hint: 'LT1: wifi connect ssid=LabWiFi password=rahasia123\nLT1: dhcp', checks: [['LT1 terhubung ke AP', n => { const l = dev(n, 'LT1'); return !!l && wifiLinks(n).some(w => w.cl === l.id) }], ['LT1 berhasil ping R1', n => can(n, 'LT1', 'R1')]] },
    ] },
  { id: 'lab7', title: 'Routing dinamis dengan RIP', desc: 'Semua alamat sudah diatur, tanpa route statis. Aktifkan RIP di R1, R2, R3 (/routing rip network add network=...) supaya PC1 bisa ping PC2.',
    seed: topo([mk('d1', 'pc', 'PC1', 80, 220, { eth0: '192.168.1.10/24' }, '192.168.1.1'), mk('d2', 'router', 'R1', 250, 220, { ether1: '192.168.1.1/24', ether2: '10.0.12.1/24' }), mk('d3', 'router', 'R2', 450, 220, { ether1: '10.0.12.2/24', ether2: '10.0.23.2/24' }), mk('d4', 'router', 'R3', 650, 220, { ether1: '10.0.23.3/24', ether2: '192.168.3.1/24' }), mk('d5', 'pc', 'PC2', 820, 220, { eth0: '192.168.3.10/24' }, '192.168.3.1')],
      [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'ether1'), L('d3', 'ether2', 'd4', 'ether1'), L('d4', 'ether2', 'd5', 'eth0')]),
    steps: [
      { title: 'Aktifkan RIP', hint: 'R1: routing rip network add network=192.168.1.0/24 (dan 10.0.12.0/24)\nR2: 10.0.12.0/24 + 10.0.23.0/24\nR3: 10.0.23.0/24 + 192.168.3.0/24', checks: [['R1, R2, R3 tanpa route statis', n => noStatic(n, 'R1', 'R2', 'R3')], ['R1 belajar rute lewat RIP', n => { converge(n); return has(n, 'R1', d => (d.dyn || []).some(r => r.proto === 'rip')) }]] },
      { title: 'Verifikasi', hint: 'PC1: ping 192.168.3.10', checks: [['PC1 berhasil ping PC2', n => can(n, 'PC1', 'PC2')]] },
    ] },
  { id: 'lab8', title: 'Firewall filter sederhana', desc: 'Jaringan sudah berjalan. Pasang aturan firewall di R1 agar PC1 TIDAK bisa ping SRV (drop forward), tetapi PC1 tetap bisa ping R1.',
    seed: topo([mk('d1', 'pc', 'PC1', 140, 220, { eth0: '192.168.1.10/24' }, '192.168.1.1'), mk('d2', 'router', 'R1', 360, 220, { ether1: '192.168.1.1/24', ether2: '10.0.0.1/24' }), mk('d3', 'server', 'SRV', 580, 220, { eth0: '10.0.0.10/24' }, '10.0.0.1')], [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'eth0')]),
    steps: [
      { title: 'Pasang filter', hint: 'R1: ip firewall filter add chain=forward action=drop src-address=192.168.1.10/32 dst-address=10.0.0.10/32', checks: [['R1 punya aturan firewall filter', n => has(n, 'R1', d => d.fw?.some(x => x.chain === 'forward' && x.action === 'drop'))], ['PC1 tidak bisa ping SRV', n => { const a = dev(n, 'PC1'), b = dev(n, 'SRV'); return !!a && !!ip(b) && !ping(n, a.id, ip(b)).ok }]] },
      { title: 'Verifikasi', hint: 'PC1: ping 10.0.0.10 (gagal), ping 192.168.1.1 (ok)', checks: [['PC1 tetap bisa ping R1', n => can(n, 'PC1', 'R1')]] },
    ] },
  { id: 'lab9', title: 'DNS statis', desc: 'PC1 terhubung ke R1. Tambahkan catatan DNS statis di R1 (name=web address=10.0.0.10), set DNS server PC1 ke R1, lalu PC1 harus bisa ping web.',
    seed: topo([mk('d1', 'pc', 'PC1', 160, 220, { eth0: '192.168.1.10/24' }, '192.168.1.1'), mk('d2', 'router', 'R1', 360, 220, { ether1: '192.168.1.1/24', ether2: '10.0.0.1/24' }), mk('d3', 'server', 'SRV', 580, 220, { eth0: '10.0.0.10/24' }, '10.0.0.1')], [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'eth0')]),
    steps: [
      { title: 'DNS di R1', hint: 'R1: ip dns static add name=web address=10.0.0.10', checks: [['R1 punya catatan DNS statis', n => has(n, 'R1', d => d.dnsStatic?.length > 0)]] },
      { title: 'DNS di PC1', hint: 'PC1: ip dns set servers=192.168.1.1', checks: [['PC1 memakai R1 sebagai DNS', n => has(n, 'PC1', d => d.dns === '192.168.1.1')], ['PC1 bisa resolve web', n => { const d = dev(n, 'PC1'); return !!d && resolveDns(n, d, 'web').ip === '10.0.0.10' }]] },
      { title: 'Verifikasi', hint: 'PC1: ping web', checks: [['PC1 berhasil ping web', n => { const d = dev(n, 'PC1'); if (!d) return false; const r = resolveDns(n, d, 'web'); return !r.err && ping(n, d.id, r.ip).ok }]] },
    ] },
  { id: 'lab10', title: 'Inter-VLAN routing', desc: 'PC1 & PC2 di VLAN 10, PC3 di VLAN 20 (switch sudah diatur). Buat R1 melayani gateway kedua VLAN dan arahkan gateway PC, lalu semua PC harus bisa saling ping via router.',
    seed: topo((() => {
      const sw = mk('d1', 'switch', 'SW1', 360, 140)
      sw.ports = { ether1: { mode: 'trunk', vlans: [10, 20] }, ether2: { mode: 'access', vlan: 10 }, ether3: { mode: 'access', vlan: 10 }, ether4: { mode: 'access', vlan: 20 } }
      return [sw, mk('d2', 'pc', 'PC1', 170, 330, { eth0: '192.168.10.11/24' }), mk('d3', 'pc', 'PC2', 360, 330, { eth0: '192.168.10.12/24' }), mk('d4', 'pc', 'PC3', 550, 330, { eth0: '192.168.20.13/24' }), mk('d5', 'router', 'R1', 360, 60)]
    })(), [L('d2', 'eth0', 'd1', 'ether2'), L('d3', 'eth0', 'd1', 'ether3'), L('d4', 'eth0', 'd1', 'ether4'), L('d1', 'ether1', 'd5', 'ether1')]),
    steps: [
      { title: 'Gateway di R1', hint: 'R1: interface vlan add name=vlan10 vlan-id=10 interface=ether1\nR1: interface vlan add name=vlan20 vlan-id=20 interface=ether1\nR1: ip address add address=192.168.10.1/24 interface=vlan10\nR1: ip address add address=192.168.20.1/24 interface=vlan20', checks: [['R1 punya subinterface vlan10 & vlan20 ber-IP', n => has(n, 'R1', d => d.ifaces.some(i => i.vlan === 10 && i.addr) && d.ifaces.some(i => i.vlan === 20 && i.addr))]] },
      { title: 'Gateway di PC', hint: 'PC1/PC2: ip route add dst-address=0.0.0.0/0 gateway=192.168.10.1\nPC3: ip route add dst-address=0.0.0.0/0 gateway=192.168.20.1', checks: [['PC gateway menunjuk subinterface yang benar', n => has(n, 'PC1', d => d.routes[0]?.gw === '192.168.10.1') && has(n, 'PC3', d => d.routes[0]?.gw === '192.168.20.1')]] },
      { title: 'Verifikasi', hint: 'PC1: ping 192.168.10.12 (ok), PC1: ping 192.168.20.13 (ok via R1)', checks: [['PC1 berhasil ping PC2', n => can(n, 'PC1', 'PC2')], ['PC1 berhasil ping PC3 lewat router', n => can(n, 'PC1', 'PC3')]] },
    ] },
  { id: 'lab11', title: 'NAT & firewall lanjutan', desc: 'R1 sudah masquerade. Pasang dstnat (port-forward) 80 ke SRV, accept TCP/80, dan drop ICMP forward: ping PC1→SRV gagal, tetapi speedtest (TCP) tetap jalan.',
    seed: topo((() => {
      const r1 = mk('d2', 'router', 'R1', 360, 220, { ether1: '192.168.1.1/24', ether2: '10.0.0.1/24' })
      r1.nat = [{ chain: 'srcnat', action: 'masquerade', out: 'ether2' }]
      return [mk('d1', 'pc', 'PC1', 140, 220, { eth0: '192.168.1.10/24' }, '192.168.1.1'), r1, mk('d3', 'server', 'SRV', 580, 220, { eth0: '10.0.0.10/24' }, '10.0.0.1')]
    })(), [L('d1', 'eth0', 'd2', 'ether1'), L('d2', 'ether2', 'd3', 'eth0')]),
    steps: [
      { title: 'dstnat port-forward', hint: 'R1: ip firewall nat add chain=dstnat action=dst-nat to-addresses=10.0.0.10 protocol=tcp dst-port=80 to-ports=80 in-interface=ether1', checks: [['dstnat port 80 ke SRV terpasang', n => has(n, 'R1', d => (d.nat || []).some(x => (x.chain === 'dstnat' || x.toAddr) && x.dport === '80' && (x.toAddr === '10.0.0.10' || x.redirect)))]] },
      { title: 'Filter accept TCP/80 lalu drop ICMP', hint: 'R1: ip firewall filter add chain=forward action=accept protocol=tcp dst-port=80\nR1: ip firewall filter add chain=forward action=drop protocol=icmp', checks: [['filter accept tcp/80 ada', n => has(n, 'R1', d => d.fw?.some(x => x.action === 'accept' && x.proto === 'tcp' && x.dport === '80'))], ['filter drop icmp ada', n => has(n, 'R1', d => d.fw?.some(x => x.action === 'drop' && x.proto === 'icmp'))]] },
      { title: 'Verifikasi', hint: 'PC1: ping 192.168.1.1→? sebenarnya ping ke IP publik R1 10.0.0.1; ping PC1→SRV (10.0.0.10) gagal, speedtest tetap ok', checks: [['ping PC1→SRV gagal', n => { const a = dev(n, 'PC1'), b = dev(n, 'SRV'); return !!a && !!ip(b) && !ping(n, a.id, ip(b)).ok }], ['speedtest PC1→SRV tetap ok', n => bwOk(n, 'PC1', 'SRV', 1000, 1000)]] },
    ] },
  { id: 'lab12', title: 'IPv6 dasar', desc: 'Tiga perangkat terkabel tanpa IPv4 sama sekali. Beri alamat IPv6 /64, tambahkan default route ::/0, lalu PC1 harus bisa ping alamat IPv6 PC2.',
    seed: topo([mk('d1', 'pc', 'PC1', 140, 220), mk('d2', 'router', 'R1', 360, 220), mk('d3', 'pc', 'PC2', 580, 220)], [L('d1', 'eth0', 'd2', 'ether1'), L('d3', 'eth0', 'd2', 'ether2')]),
    steps: [
      { title: 'Alamat IPv6', hint: 'PC1: ipv6 address add address=2001:db8:1::1/64 interface=eth0\nR1: ipv6 address add address=2001:db8:1::2/64 interface=ether1 (dan 2001:db8:2::1/64 di ether2)\nPC2: ipv6 address add address=2001:db8:2::2/64 interface=eth0', checks: [['ketiga device punya addr6 /64', n => has(n, 'PC1', d => !!ip6(d)) && has(n, 'R1', d => d.ifaces.filter(i => i.addr6).length >= 2) && has(n, 'PC2', d => !!ip6(d))]] },
      { title: 'Route default', hint: 'PC1: ipv6 route add dst-address=::/0 gateway=2001:db8:1::2\nR1: ipv6 route add dst-address=2001:db8:2::/64 gateway=2001:db8:2::1 (atau langsung connected)\nPC2: ipv6 route add dst-address=::/0 gateway=2001:db8:2::1', checks: [['route/default ::/0 menunjuk tetangga', n => has(n, 'PC1', d => d.routes6?.some(r => r.dst === '::/0')) && has(n, 'PC2', d => d.routes6?.some(r => r.dst === '::/0'))]] },
      { title: 'Verifikasi', hint: 'PC1: ping 2001:db8:2::2', checks: [['PC1 ping6 PC2 ok', n => can6(n, 'PC1', 'PC2')]] },
    ] },
]

for (const l of LABS) l.checks = l.steps.flatMap(s => s.checks)

export const runLab = (lab, n) => lab.checks.map(([label, f]) => { let ok = false; try { ok = !!f(n) } catch {} return { label, ok } })
export const runLabSteps = (lab, n) => lab.steps.map(s => ({ title: s.title, hint: s.hint, results: s.checks.map(([label, f]) => { let ok = false; try { ok = !!f(n) } catch {} return { label, ok } }) }))
