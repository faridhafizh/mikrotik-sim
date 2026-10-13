// Perintah CMD Windows untuk host (PC / Server / Laptop).
// Berdampingan dengan shim RouterOS di registry.js: gaya Windows menang kalau cocok.
import { parsePingArgs } from './pingargs.js'
import { arpEntries } from './arp.js'
import { macOf } from './mac.js'
import { splitAddr, maskOf, lenOfMask, winMac, uptimeOf } from './num.js'

const r = (w, fn) => ({ w, fn })
const pad = (s, n) => String(s).padEnd(n)
const RULE = '='.repeat(70)
const primary = d => d.ifaces.find(i => i.addr) || d.ifaces[0] || { name: '-', addr: null }
const ifLabel = d => (d.type === 'laptop' ? 'Wireless LAN adapter Wi-Fi' : 'Ethernet adapter Ethernet')
const gwOf = d => (d.routes || []).find(x => x.dst === '0.0.0.0/0')?.gw || ''

const CMD_HELP = {
  ipconfig: '/all konfigurasi lengkap', ping: '[-n jumlah] [-l ukuran] <ip>',
  tracert: '<ip>', nslookup: '<nama> [server]', netstat: '[-r|-a|-n] koneksi / rute',
  arp: '-a tabel ARP', route: 'print | add | delete', hostname: 'nama komputer',
  getmac: 'alamat MAC adapter', systeminfo: 'rincian sistem',
  netsh: 'wlan show interfaces | connect name=<ssid>', cls: 'bersihkan layar', echo: '<teks>'
}

// Panjang kata kunci DESC agar `ipconfig /all` menang atas `ipconfig`.
export const HOST_CMDS = [
  r(['netsh', 'interface', 'ip', 'show', 'config'], c => ipconfig(c, true)),
  r(['netsh', 'wlan', 'show', 'interfaces'], c => winWlan(c)),
  r(['netsh', 'wlan', 'disconnect'], c => winWlanDisconnect(c)),
  r(['netsh', 'wlan', 'connect'], c => winWlanConnect(c)),
  r(['ipconfig', '/all'], c => ipconfig(c, true)),
  r(['ipconfig', '/release'], c => ({ out: ['Melepas sewa DHCP...', c.api.dhcp(c.net, c.d)] })),
  r(['ipconfig', '/renew'], c => ({ out: ['Meminta sewa DHCP...', c.api.dhcp(c.net, c.d)] })),
  r(['ipconfig'], c => ipconfig(c, false)),
  r(['ping'], c => winPing(c)),
  r(['tracert'], c => winTracert(c)),
  r(['nslookup'], c => winNslookup(c)),
  r(['netstat'], c => winNetstat(c)),
  r(['arp'], c => winArp(c)),
  r(['route'], c => winRoute(c)),
  r(['hostname'], c => ({ out: [c.d.name] })),
  r(['getmac'], c => ({
    out: ['Physical Address    Transport Name', ...c.d.ifaces.map(i => `${pad(winMac(macOf(c.d.id, i.name)), 20)} \\Device\\Tcpip_{${c.d.id}${i.name}}`)]
  })),
  r(['systeminfo'], c => ({
    out: [
      `Host Name:                 ${c.d.name}`,
      'OS Name:                   Microsoft Windows 11 Pro (simulasi)',
      'OS Version:                10.0.22631.1',
      'System Manufacturer:       MikroLab Simulator',
      'System Model:              simulated device',
      `System Type:               ${c.d.type}-based device`,
      'Processor(s):              1 Processor Installed',
      'Locale:                    id-ID',
      'Boot Device:               \\Device\\HarddiskVolume1',
      `Simulator Uptime:          ${uptimeOf(Date.now() - c.api.START)}`,
      ''
    ]
  })),
  r(['ver'], c => ({ out: ['Microsoft Windows [Version 10.0.22631.1] (simulasi MikroLab)'] })),
  r(['whoami'], c => ({ out: [`mikrolab\\${String(c.d.name).toLowerCase()}`] })),
  r(['cls'], c => ({ out: [], clear: true })),
  r(['clear'], c => ({ out: [], clear: true })),
  r(['echo'], c => ({ out: [t_slice(c, 1).join(' ')] })),
  r(['?'], c => ({ out: winHelp() }))
]

const t_slice = (c, n) => c.t.slice(n)

function winHelp() {
  return [
    'Perintah CMD Windows yang didukung di simulator:', '',
    ...Object.entries(CMD_HELP).map(([k, v]) => '  ' + pad(k, 11) + v),
    '', 'Semua perintah gaya RouterOS (ip address add, dhcp, wifi connect, export, help, dll.) tetap jalan.'
  ]
}

function ipconfig(c, all) {
  const { d } = c
  const i = primary(d)
  const { len } = splitAddr(i.addr || '')
  const out = ['Windows IP Configuration', '', `${ifLabel(d)}:`, '']
  if (all) {
    out.push(`   Description . . . . . . . . . . . : ${d.type}-adapter (simulasi)`)
    out.push(`   Physical Address. . . . . . . . . : ${winMac(macOf(d.id, i.name))}`)
    out.push(`   DHCP Enabled. . . . . . . . . . . : ${d.dhcpClient?.length ? 'Yes' : 'No'}`)
  }
  out.push('   Connection-specific DNS Suffix  . :')
  out.push(`   IPv4 Address. . . . . . . . . . . : ${i.addr || '(kosong)'}`)
  out.push(`   Subnet Mask . . . . . . . . . . . : ${i.addr ? maskOf(len) : '0.0.0.0'}`)
  out.push(`   Default Gateway . . . . . . . . . : ${gwOf(d) || '(kosong)'}`)
  out.push(`   DHCP Server . . . . . . . . . . . : ${d.dhcpServer || '(kosong)'}`)
  out.push(`   DHCPv4 IP Address Lease . . . . . : ${d.dhcpLease || '(statis)'}`)
  if (i.addr6) out.push(`   IPv6 Address. . . . . . . . . . . : ${i.addr6}`)
  out.push(`   DNS Servers . . . . . . . . . . . : ${d.dns || '(kosong)'}`)
  out.push(`   NetBIOS over TCP/IP. . . . . . . : ${String(d.name).toUpperCase()}`)
  if (all) {
    out.push('')
    out.push(`   Host Name . . . . . . . . . . . : ${d.name}`)
    out.push('   Primary Dns Suffix  . . . . . . . :')
    out.push('   Node Type . . . . . . . . . . . . : Hybrid')
    out.push(`   IP Routing Enabled . . . . . . . : ${d.routes?.length ? 'Yes' : 'No'}`)
    out.push('   WINS Proxy Enabled . . . . . . . : No')
    out.push(`   Adapter Name . . . . . . . . . . : ${i.name}`)
  }
  return { out }
}

function winPing(c) {
  const { net, d, t, q, api } = c
  const { count, size, target } = parsePingArgs(t.slice(1), q)
  if (!target) return { out: ['Ketik: ping [-n jumlah] [-l ukuran] <ip>'] }
  const rs = api.resolve(net, d, target)
  if (rs.err) return { out: [`Ping tidak dapat menemukan host ${target}.`, 'Periksa nama hostname, lalu coba lagi.'] }
  const r = rs.ip.includes(':') ? api.ping6(net, d.id, rs.ip) : api.ping(net, d.id, rs.ip, 'icmp', '')
  const ms = r.ok ? Math.max(1, r.hops.length) : 0
  const out = [`Pinging ${rs.ip} with ${size} bytes of data:`, '']
  for (let i = 0; i < count; i++) out.push(r.ok ? `Reply from ${rs.ip}: bytes=${size} time=${ms}ms TTL=${64 - r.hops.length}` : 'Request timed out.')
  out.push('')
  out.push(`Ping statistics for ${rs.ip}:`)
  out.push(`    Packets: Sent = ${count}, Received = ${r.ok ? count : 0}, Lost = ${r.ok ? 0 : count} (${r.ok ? 0 : 100}% loss)`)
  if (!r.ok) out.push('', r.err)
  return { out, anim: r.path, ok: r.ok, hops: r.hops }
}

function winTracert(c) {
  const { net, d, t, api } = c
  const target = t[1]
  if (!target) return { out: ['Ketik: tracert <ip>'] }
  const rs = api.resolve(net, d, target)
  if (rs.err) return { out: ['Ketik: tracert <ip>', `Tidak dapat me-resolve ${target}.`] }
  const r = rs.ip.includes(':') ? api.ping6(net, d.id, rs.ip) : api.ping(net, d.id, rs.ip)
  // tracert hanya butuh jalur pergi; balas-balik yang menentukan ok/tidak
  const last = net.devices[r.path.at(-1)]
  const reached = !!last && last.ifaces.some(i => (i.addr || i.addr6 || '').split('/')[0] === rs.ip)
  const out = [`Tracing route to ${rs.ip} over a maximum of 30 hops`, '']
  r.hops.forEach((h, i) => {
    const ms = Math.max(1, i + 1)
    out.push(`  ${pad(i + 1, 2)}${pad(ms + ' ms', 10)}${pad(ms + ' ms', 10)}${pad(ms + ' ms', 10)}  ${h}`)
  })
  out.push('')
  out.push(reached ? 'Trace complete.' : r.err)
  return { out, anim: r.path, ok: reached, hops: r.hops }
}

function winNslookup(c) {
  const { d, t, api } = c
  const name = t[1]
  if (!name) return { out: ['Ketik: nslookup <nama>'] }
  const rs = api.resolve(c.net, d, name)
  const server = t[2] || d.dns
  const out = []
  if (server) out.push('Server:  ' + server, 'Address:  ' + server)
  if (rs.err) return { out: [...out, '', `*** ${name} Non-existent domain`, `*** ${server || 'localhost'} can't find ${name}: Non-existent domain`] }
  out.push('', 'Non-authoritative answer:', 'Name:    ' + name, 'Address: ' + rs.ip)
  return { out }
}

function winNetstat(c) {
  const { net, d, t, api } = c
  if (t.slice(1).some(x => /^-(r|rn)$/i.test(x))) return winRoute({ ...c, t: ['route', 'print'] })
  const rows = []
  for (const i of d.ifaces) {
    if (!i.addr || i.disabled) continue
    const me = splitAddr(i.addr).ip
    for (const p of api.l2Peers(net, d.id, i.name)) {
      const pi = net.devices[p.dev]?.ifaces?.find(x => x.name === p.if)
      if (!pi?.addr) continue
      rows.push(`  TCP    ${pad(me + ':' + dportOf(d.id, i.name), 23)}${pad(splitAddr(pi.addr).ip + ':' + dportOf(p.dev, p.if), 23)}ESTABLISHED`)
    }
  }
  return {
    out: ['Active Connections', '', '  Proto  Local Address          Foreign Address        State', ...rows, '',
      '(simulasi: satu baris per tetangga L2 yang terjangkau; simulator tidak membuka soket)']
  }
}

function winArp(c) {
  const { net, d, t, api } = c
  const flag = (t[1] || '').toLowerCase()
  if (flag === '-d') {
    const ip = t[2]
    if (!ip) return { out: ['Ketik: arp -d <ip>'] }
    ;(d.arpBlocked ??= []).push(ip)
    return { out: [ip + ' dihapus dari tabel ARP'] }
  }
  if (flag && flag !== '-a') return { out: ['Ketik: arp -a'] }
  const list = arpEntries(net, d, api.l2Peers)
  const out = []
  d.ifaces.forEach((i, ix) => {
    if (!i.addr) return
    const rows = list.filter(x => x.iface === i.name)
    out.push(`Interface: ${splitAddr(i.addr).ip} --- 0x${ix}`)
    out.push('  Internet Address      Physical Address      Type')
    for (const x of rows) out.push(`  ${pad(x.ip, 21)}${pad(winMac(x.mac), 24)}dynamic`)
    if (!rows.length) out.push('  (belum ada entri ARP di interface ini)')
    out.push('')
  })
  return { out: out.length ? out : ['No ARP entries'] }
}

const dportOf = (devId, ifName) => {
  let h = 0
  const s = devId + ifName
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return 1024 + (h % 64000)
}

function winRoute(c) {
  const { d, t } = c
  const verb = (t[1] || 'print').toLowerCase()
  const rest = t.slice(2)
  if (verb === 'add') {
    const dest = rest[0] || '0.0.0.0'
    const mi = rest.findIndex(x => /^mask$/i.test(x) || /^mask=/i.test(x))
    const maskTok = mi < 0 ? '0.0.0.0' : (rest[mi].includes('=') ? rest[mi].split('=')[1] : rest[mi + 1])
    const len = lenOfMask(maskTok)
    const gw = rest.filter(x => /^[\d.]+$/.test(x) && x !== dest && x !== maskTok)[0]
    if (len == null) return { out: ['Rute tidak ditambah karena parameter salah.', 'Ketik: route add <tujuan> mask <masker> <gateway>'] }
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(gw || '')) return { out: ['Rute tidak ditambah karena parameter salah.', 'Butuh gateway IPv4.'] }
    d.routes = [...(d.routes || []).filter(x => x.dst !== `${dest}/${len}`), { dst: `${dest}/${len}`, gw }]
    return { out: ['Operasi Berhasil!'] }
  }
  if (verb === 'delete') {
    const dest = rest[0] || '0.0.0.0'
    const mi = rest.findIndex(x => /^mask$/i.test(x) || /^mask=/i.test(x))
    const len = mi < 0 ? (dest === '0.0.0.0' ? 0 : 32) : lenOfMask(rest[mi].includes('=') ? rest[mi].split('=')[1] : rest[mi + 1])
    const dst = `${dest}/${len == null ? 32 : len}`
    const before = (d.routes || []).length
    d.routes = (d.routes || []).filter(x => x.dst !== dst)
    return { out: [(d.routes || []).length === before ? 'Rute tidak ditemukan.' : 'Operasi Berhasil!'] }
  }
  const out = [RULE, 'Interface List', RULE, ...d.ifaces.map(i => ` 12...${pad(winMac(macOf(d.id, i.name)), 19)} ......0x1`), '', RULE, '', 'IPv4 Route Table', RULE, 'Active Routes:', 'Network Destination        Netmask          Gateway       Interface  Metric']
  for (const i of d.ifaces) {
    if (!i.addr) continue
    const { ip, len } = splitAddr(i.addr)
    out.push(`${pad(netOfMask(ip, len), 27)}${pad(maskOf(len), 17)}${pad('On-link', 16)}${pad(ip, 16)}281`)
  }
  for (const x of d.routes || []) {
    const { ip, len } = splitAddr(x.dst)
    out.push(`${pad(ip, 27)}${pad(maskOf(len), 17)}${pad(x.gw, 16)}${pad(splitAddr(primary(d).addr || '0.0.0.0/32').ip, 16)}${x.dst === '0.0.0.0/0' ? 1 : 20}`)
  }
  out.push('', 'Persistent Routes:', '  None', RULE, '')
  return { out }
}

function netOfMask(ip, len) {
  const n = ip.split('.').reduce((a, b) => a * 256 + +b, 0)
  const m = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0
  const x = (n & m) >>> 0
  return [24, 16, 8, 0].map(s => (x >>> s) & 255).join('.')
}

function winWlan(c) {
  const { net, d, api } = c
  if (d.type !== 'laptop') return { out: ['Perangkat ini tidak punya Wi-Fi.'] }
  return {
    out: [
      'There is one wireless interface on the computer:', '',
      'Name                   : Wi-Fi',
      'Description            : simulated wireless adapter',
      `GUID                   : {${d.id}}`,
      'Physical Address       : ' + winMac(macOf(d.id, 'wlan0')),
      'State                  : ' + (d.wifi ? 'connected' : 'disconnected'),
      ...(d.wifi ? ['   SSID                 : ' + d.wifi.ssid] : []),
      '', api.wifiStatus(net, d)
    ]
  }
}

function winWlanDisconnect(c) {
  const { d } = c
  if (d.type !== 'laptop') return { out: ['Perangkat ini tidak punya Wi-Fi.'] }
  if (!d.wifi) return { out: ['Tidak ada koneksi Wi-Fi aktif.'] }
  d.wifi = null
  return { out: ['Koneksi Wi-Fi terputus.'] }
}

function winWlanConnect(c) {
  const { d, q, t, api } = c
  if (d.type !== 'laptop') return { out: ['Perangkat ini tidak punya Wi-Fi.'] }
  const ssid = q.name || t[4]
  if (!ssid) return { out: ['Ketik: netsh wlan connect name=<ssid>'] }
  d.wifi = { ssid, pass: q.key ? String(q.key).replace(/^.*:/, '') : '' }
  return { out: [`Profile ${ssid} connected.`, api.wifiStatus(c.net, d)] }
}

// Cocokkan gaya Windows lebih dulu; null = perintah tidak dikenal gaya CMD.
export function hostCmd(api, net, d, t, q) {
  for (const rule of HOST_CMDS) {
    if (t.length < rule.w.length) continue
    if (!rule.w.every((w, i) => t[i].toLowerCase() === w)) continue
    return rule.fn({ net, d, t, q, api })
  }
  return null
}