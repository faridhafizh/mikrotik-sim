// Registry perintah RouterOS. Setiap entri { s: scope, w: kata kunci, fn } dicocokkan
// berurutan dengan token baris perintah (setara rantai if yang lama di engine.js).
// scope: 'router' | 'switch' | 'host' (pc/server/laptop).
// Helper jaringan (ping/trace/l2Peers/...) datang lewat `c.api` supaya modul ini
// tidak mengimpor engine.js (menghindari siklus import).
import { helpIndex, helpTopic } from '../help.js'
import { linkStatus, speedLabel } from '../linkmodel.js'
import { validIp, validIp6, validCidr, inNet, rate } from './netbits.js'
import { arpEntries, protoNeighbors } from './arp.js'
import { macOf } from './mac.js'
import { splitAddr, fmtTime, fmtDate, uptimeOf } from './num.js'
import { parsePingArgs } from './pingargs.js'

// ---------- helper bersama ----------
const r = (s, w, fn) => ({ s, w, fn })
const pad = (s, n) => String(s).padEnd(n)
const detailOf = t => t.includes('detail')
const countOnly = t => t.includes('count-only')
const typeOf = i => (i.members ? 'bridge' : i.vlan ? 'vlan' : i.name.startsWith('wlan') ? 'wlan' : i.kind === 'SFP' || i.kind === 'SFPP' ? 'sfp' : 'ether')
const isCable = i => !!i.kind
const netAddr = a => { const { ip, len } = splitAddr(a); const n = ip.split('.').reduce((z, b) => z * 256 + +b, 0); const m = len === 32 || len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0; const x = (n & m) >>> 0; return [24, 16, 8, 0].map(s => (x >>> s) & 255).join('.') }
const linkOf = (net, devId, ifName) => net.links.find(l => (l.a.dev === devId && l.a.if === ifName) || (l.b.dev === devId && l.b.if === ifName))
const START = Date.now()

const USERS0 = [{ name: 'admin', group: 'full' }]
// Pesanan default RouterOS; d.users === undefined berarti perangkat masih punya user bawaan.
export const usersOf = d => (Array.isArray(d.users) ? d.users : USERS0)
const usersCopy = d => usersOf(d).map(u => ({ ...u }))
const USER_GROUPS = ['full', 'read', 'write', 'policy', 'test']

const SERVICES = [['telnet', 23], ['ftp', 21], ['www', 80], ['ssh', 22], ['www-ssl', 443], ['api', 8728], ['winbox', 8291]]
const servicesOf = d => (d.services ??= SERVICES.map(([name, port]) => ({ name, port, disabled: name === 'telnet' || name === 'ftp' })))

export const logPush = (d, msg, topics = 'system,info') => {
  const l = (d.log ??= [])
  l.unshift({ ts: Date.now(), topics, msg })
  if (l.length > 50) l.pop()
}

// ---------- handler bersama (dipakai router & switch) ----------
function helpOut(c, scope) { return { out: c.t[1] ? helpTopic(scope, c.t.slice(1).join(' ')) : helpIndex(scope) } }

function ifacePrint(c, list) {
  const { d, net, api } = c
  const ifs = list || d.ifaces
  const blk = api.stpBlocked(net)
  if (detailOf(c.t)) {
    return {
      out: [
        '', 'Flags: X - disabled, R - running, D - dynamic',
        '#  NAME             TYPE     MAC-ADDRESS       STATUS            ADDRESS            COMMENT',
        ...ifs.map((i, k) => {
          const st = api.ifaceStatus(net, d, i.name) + (blk.has(`${d.id}:${i.name}`) ? ' (blocked)' : '')
          return `${k}  ${pad(i.name, 16)} ${pad(typeOf(i), 8)} ${pad(macOf(d.id, i.name), 18)} ${pad(st, 19)}${pad(i.addr || i.addr6 || '', 20)}${i.comment || ''}`
        })
      ]
    }
  }
  return { out: ifs.map((i, k) => `${k}  ${pad(i.name, 8)} ${api.ifaceStatus(net, d, i.name)}${blk.has(`${d.id}:${i.name}`) ? ' (blocked)' : ''}`) }
}

function ifEnable(c, disabled) {
  const { d, t, api } = c
  const names = t.slice(3).filter(x => !x.includes('='))
  const targets = names.length ? names.map(n => d.ifaces.find(x => x.name === n && isCable(x))) : d.ifaces.filter(isCable)
  if (targets.some(x => !x)) return api.bad('interface ethernet tidak ada')
  targets.forEach(i => { i.disabled = disabled })
  logPush(d, `interface ${targets.map(i => i.name).join(',')} ${disabled ? 'disabled' : 'enabled'}`)
  return { out: [] }
}

function ethMonitor(c) {
  const { d, net, t, api } = c
  const i = d.ifaces.find(x => x.name === t[3])
  if (!i || !isCable(i)) return api.bad('interface ethernet tidak ada')
  const lk = linkOf(net, d.id, i.name)
  const rateTxt = lk && linkStatus(net, lk).up ? speedLabel(linkStatus(net, lk).speed) : '-'
  return { out: [`${pad(i.name, 10)} status: ${api.ifaceStatus(net, d, i.name)}   line-rate: ${rateTxt}`, '(simulasi: satu snapshot, tanpa penghitung waktu nyata)'] }
}

function ethSet(c) {
  const { d, t, q, api } = c
  const i = d.ifaces.find(x => x.name === t[3] && isCable(x))
  if (!i) return api.bad('interface ethernet tidak ada')
  if (q.disabled !== undefined) {
    if (!['yes', 'no'].includes(q.disabled)) return api.bad('disabled harus yes|no')
    i.disabled = q.disabled === 'yes'
  }
  if (q.comment !== undefined) i.comment = String(q.comment).slice(0, 60)
  if (q.mtu !== undefined && /^\d+$/.test(q.mtu)) i.mtu = +q.mtu
  return { out: [] }
}

function vlanPrint(d) {
  return d.ifaces.map(i => { const cc = d.ports?.[i.name] || { mode: 'access', vlan: 1 }; return `${pad(i.name, 8)} ${cc.mode === 'access' ? 'access vlan ' + cc.vlan : 'trunk ' + (cc.vlans || []).join(',')}` })
}

function vlanSet(c, mode) {
  const { d, q, api } = c
  const P = (d.ports ??= {}), port = d.ifaces.find(i => i.name === q.port)
  if (!port) return api.bad('port tidak ada')
  if (mode === 'access') {
    if (!(+q.id > 0)) return api.bad('id= wajib (contoh: vlan access port=ether1 id=10)')
    P[port.name] = { mode: 'access', vlan: +q.id }
  } else {
    const ids = (q.ids || '').split(',').map(Number).filter(Boolean)
    if (!ids.length) return api.bad('ids= wajib (mis. 10,20)')
    P[port.name] = { mode: 'trunk', vlans: ids }
  }
  logPush(d, `${port.name} vlan ${mode}`)
  return { out: [] }
}

function stpPrint(c) {
  const b = [...c.api.stpBlocked(c.net)].filter(k => k.startsWith(c.d.id + ':')).map(k => k.split(':')[1])
  return { out: [`stp: ${c.d.stp || 'yes'}  blocked: ${b.length ? b.join(',') : '(tidak ada yang di-block)'}`] }
}

function identitySet(c) {
  const { d, q, api } = c
  if (!q.name) return api.bad('butuh name=<nama>')
  const old = d.name
  d.name = String(q.name).slice(0, 40)
  logPush(d, `identity changed from ${old} to ${d.name}`)
  return { out: [] }
}

function resourcePrint(c) {
  const { d, net } = c
  const cpu = Math.min(97, 4 + Object.keys(net.devices).length * 2 + net.links.length * 3)
  const mem = Math.max(16, 104 - Object.keys(net.devices).length * 3)
  return {
    out: [
      `       uptime: ${uptimeOf(Date.now() - START)}`,
      '      version: 7.16.2 (simulasi)',
      '         board: simulated device',
      '   factory-software: 7.16.2',
      '        cpu: ARM64',
      `     cpu-load: ${cpu}%`,
      `  free-memory: ${mem}.0MiB`,
      ' total-memory: 128.0MiB'
    ]
  }
}

function clockPrint(c) {
  return {
    out: [
      `time: ${c.d.clockTime || fmtTime(Date.now())}`,
      `date: ${c.d.clockDate || fmtDate(Date.now())}`,
      '(jam perangkat; set manual hanya menggeser tampilan, simulasi tidak memakai jam)'
    ]
  }
}

function clockSet(c) {
  const { d, q, api } = c
  const clockOk = v => {
    const p = v.split(':').map(Number)
    return p.length >= 2 && p.length <= 3 && p[0] <= 23 && p[1] <= 59 && (p[2] == null || p[2] <= 59)
  }
  if (q.time && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(q.time)) return api.bad('time harus HH:MM[:SS]')
  if (q.time && !clockOk(q.time)) return api.bad('time di luar rentang (00:00-23:59)')
  if (q.date && !/^\d{4}-\d{2}-\d{2}$/.test(q.date)) return api.bad('date harus YYYY-MM-DD')
  if (q.time) d.clockTime = q.time.length === 5 ? q.time + ':00' : q.time
  if (q.date) d.clockDate = q.date
  logPush(d, 'system clock adjusted')
  return { out: [] }
}

function reboot(c) {
  logPush(c.d, 'system reboot requested')
  return { out: ['per restarting...', 'Reboot selesai (simulasi: konfigurasi tetap, terminal direset)'], clear: true }
}

function logPrint(c) {
  const l = c.d.log || []
  return { out: ['#  TIME             TOPICS     MESSAGE', ...l.map((e, k) => `${k}  ${pad(fmtTime(e.ts), 16)} ${pad(e.topics, 10)} ${e.msg}`)] }
}

function servicePrint(c) {
  return { out: ['Flags: X - disabled', '#  NAME     PORT    ADDRESS      ACCEPTED', ...servicesOf(c.d).map((s, k) => `${k}  ${pad(s.name, 9)}${s.disabled ? 'X' : ' '} ${pad(s.port, 6)} 0.0.0.0/0`)] }
}

function serviceSet(c) {
  const { d, t, q, api } = c
  const s = servicesOf(d)[+t[3]]
  if (!s) return api.NOENTRY('service')
  if (q.disabled !== undefined) {
    if (!['yes', 'no'].includes(q.disabled)) return api.bad('disabled harus yes|no')
    s.disabled = q.disabled === 'yes'
  }
  if (q.port && /^\d+$/.test(q.port)) s.port = +q.port
  return { out: [] }
}

function serviceToggle(c, disabled) {
  const { d, t, api } = c
  const s = servicesOf(d)[+t[3]]
  if (!s) return api.NOENTRY('service')
  s.disabled = disabled
  return { out: [] }
}

function arpPrint(c) {
  const list = arpEntries(c.net, c.d, c.api.l2Peers)
  return { out: ['Flags: X - disabled, I - invalid, D - dynamic, C - complete', '#  ADDRESS         MAC-ADDRESS       INTERFACE      STATUS', ...list.map((x, k) => `${k}  ${pad(x.ip, 16)} ${pad(x.mac, 18)} ${pad(x.iface, 14)} DC`)] }
}

function dynNetAdd(c) {
  const { d, t, q, api } = c
  if (!validCidr(q.network || '')) return api.bad('butuh network=<net/len>')
  ;(d[t[1]] ??= []).push(q.network)
  logPush(d, `${t[1]} network ${q.network} added`)
  return { out: [] }
}

function dynNetPrint(c) {
  const list = c.d[c.t[1]] || []
  if (countOnly(c.t)) return { out: [`${list.length} network(s) found`] }
  return { out: list.length ? list.map((n, k) => `${k}  ${n}`) : ['(kosong)'] }
}

function dynNetRemove(c) {
  const { d, t, q, api } = c
  const arr = d[t[1]] || [], x = api.sel(arr, q, n => n)
  if (x == null) return api.NOENTRY('network')
  arr.splice(arr.indexOf(x), 1); return { out: [] }
}

function dynNeighbors(c, proto) {
  const list = protoNeighbors(c.net, c.d, proto, c.api.l2Peers, inNet)
  if (countOnly(c.t)) return { out: [`${list.length} neighbor(s) found`] }
  if (!list.length) return { out: ['(kosong)'] }
  if (proto === 'ospf') return { out: ['#  INSTANCE  ROUTER-ID        ADDRESS        STATE   DEAD-TIME', ...list.map((x, k) => `${k}  backbone   ${pad(x.addr, 16)} ${pad(x.addr, 15)} ${pad(x.state, 7)} 00:00:39`)] }
  return { out: ['#  ADDRESS        INTERFACE    STATE', ...list.map((x, k) => `${k}  ${pad(x.addr, 16)} ${pad(x.iface, 11)} ${x.state}`)] }
}

function queueRemove(c, which) {
  const { d, q, api } = c
  const arr = which === 'simple' ? d.queues : which === 'tree' ? d.qtrees : d.qtypes
  const x = api.sel(arr || [], q, z => z.name); if (!x) return api.NOENTRY('queue')
  arr.splice(arr.indexOf(x), 1); return { out: [] }
}

// ---------- ping / traceroute / bandwidth test (gaya RouterOS) ----------
export function pingOut(c, tool) {
  const { net, d, t, q, api } = c
  const { count, size, target } = parsePingArgs(t.slice(tool ? 2 : 1), q)
  if (!target) return api.bad('ping <ip|nama> [count=<n>] [size=<byte>]')
  const rs = api.resolve(net, d, target)
  if (rs.err) return { out: [rs.err] }
  if (q.interface && !d.ifaces.some(i => i.name === q.interface)) return api.bad('interface tidak ada')
  const r = rs.ip.includes(':') ? api.ping6(net, d.id, rs.ip) : api.ping(net, d.id, rs.ip, 'icmp', '')
  const ms = r.ok ? Math.max(1, r.hops.length) : 0
  const out = r.ok
    ? [...Array.from({ length: count }, (_, i) => `reply from ${rs.ip} seq=${i} size=${size} ttl=${64 - r.hops.length} time=${ms}ms`), `${count} packets transmitted, ${count} received, 0% packet loss`]
    : [...Array.from({ length: count }, () => 'timeout'), r.err, `${count} packets transmitted, 0 received, 100% packet loss`]
  return { out, anim: r.path, ok: r.ok, hops: r.hops }
}

export function traceOut(c, tool) {
  const { net, d, t, api } = c
  const target = t[tool ? 2 : 1]
  if (!target) return api.bad('traceroute <ip|nama>')
  const rs = api.resolve(net, d, target)
  if (rs.err) return { out: [rs.err] }
  const r = rs.ip.includes(':') ? api.ping6(net, d.id, rs.ip) : api.ping(net, d.id, rs.ip)
  const out = [`traceroute ke ${rs.ip}`, ...r.hops.map((h, i) => `${i + 1}  ${h}  ${i + 1}ms`)]
  if (!r.ok) out.push('* ' + r.err)
  return { out, anim: r.path, ok: r.ok, hops: r.hops }
}

export function btOut(c) {
  const { net, d, t, q, api } = c
  const ip = q.address || t[1]
  if (!ip) return api.bad('tool bandwidth-test address=<ip> [protocol=tcp|udp] [direction=transmit|receive|both] [duration=10s]')
  const rs = api.resolve(net, d, ip)
  if (rs.err) return { out: [rs.err] }
  const r = api.bw(net, d.id, rs.ip)
  if (!r.ok) return { out: [r.err || 'tujuan tidak terjangkau'] }
  const proto = (q.protocol || 'tcp').toUpperCase()
  const dir = (q.direction || 'both').toLowerCase()
  const duration = q.duration || '5s'
  const txVal = dir === 'receive' ? 0 : r.tx
  const rxVal = dir === 'transmit' ? 0 : r.rx
  const loss = proto === 'UDP' ? '0.1%' : '0.0%'
  const jitter = proto === 'UDP' ? '1.2ms' : '0.4ms'

  return {
    out: [
      `status: running bandwidth test to ${rs.ip} (${proto}, duration ${duration})`,
      `  tx-current: ${txVal.toFixed(1)} Mbps`,
      `  rx-current: ${rxVal.toFixed(1)} Mbps`,
      `  random-loss: ${loss}`,
      `  jitter: ${jitter}`
    ],
    anim: r.path,
    ok: true
  }
}

function dnsPrint(c) {
  const { d } = c
  return { out: [`         servers: ${d.dns || ''}`, `  allow-remote-requests: ${d.dnsRemote || 'yes'}`, '    dynamic-servers-per-domain: 2'] }
}

function dnsSet(c) {
  const { d, q, api } = c
  if (q.servers !== undefined) {
    if (q.servers && !q.servers.split(',').every(s => validIp(s))) return api.bad('servers=<ip> tidak valid')
    d.dns = q.servers || null
  }
  if (q['allow-remote-requests'] !== undefined) {
    if (!['yes', 'no'].includes(q['allow-remote-requests'])) return api.bad('allow-remote-requests harus yes|no')
    d.dnsRemote = q['allow-remote-requests']
  }
  return { out: [] }
}

// ---------- ROUTER ----------
const ROUTER_RULES = [
  r('router', ['help'], c => helpOut(c, 'router')),
  r('router', ['ping'], c => pingOut(c, false)),
  r('router', ['speedtest'], c => btOut(c)),
  r('router', ['traceroute'], c => traceOut(c, false)),
  r('router', ['tool', 'ping'], c => pingOut(c, true)),
  r('router', ['tool', 'traceroute'], c => traceOut(c, true)),
  r('router', ['tool', 'bandwidth-test'], c => btOut(c)),

  r('router', ['interface', 'print'], c => ifacePrint(c)),
  r('router', ['interface', 'ethernet', 'print'], c => ifacePrint(c, c.d.ifaces.filter(isCable))),
  r('router', ['interface', 'ethernet', 'monitor'], ethMonitor),
  r('router', ['interface', 'monitor-traffic'], c => {
    const { d, net, t, api } = c
    const i = d.ifaces.find(x => x.name === t[2])
    if (!i) return api.bad('interface tidak ada')
    return { out: [`${pad(i.name, 10)} status: ${api.ifaceStatus(net, d, i.name)}`, '(simulasi: satu snapshot, tanpa penghitung waktu nyata)'] }
  }),
  r('router', ['interface', 'ethernet', 'enable'], c => ifEnable(c, false)),
  r('router', ['interface', 'ethernet', 'disable'], c => ifEnable(c, true)),
  r('router', ['interface', 'ethernet', 'set'], ethSet),
  r('router', ['interface', 'ethernet', 'switch', 'print'], c => c.api.unsupported('chip switch pada bridge tidak dimodelkan')),
  r('router', ['interface', 'bridge', 'print'], c => {
    const bs = c.d.ifaces.filter(i => i.members)
    return { out: bs.length ? ['#  NAME    MAC-ADDRESS        MTU  STATE', ...bs.map((b, k) => `${k}  ${pad(b.name, 8)} ${pad(macOf(c.d.id, b.name), 18)} 1500 ${b.disabled ? 'disabled' : 'enabled'}`)] : ['(kosong)'] }
  }),
  r('router', ['interface', 'bridge', 'port', 'print'], c => {
    const rows = c.d.ifaces.flatMap(b => (b.members || []).map(m => `${b.name}/${m} ${b.disabled ? 'disabled' : 'enabled'}`))
    return { out: rows.length ? ['#  BRIDGE     PORT', ...rows] : ['(kosong)'] }
  }),
  r('router', ['interface', 'bridge', 'host', 'print'], c => c.api.unsupported('tabel MAC per bridge tidak dimodelkan')),
  r('router', ['interface', 'bridge', 'add'], c => {
    const { d, q, api } = c
    if (!q.name) return api.bad('butuh name=<x>')
    if (d.ifaces.some(i => i.name === q.name)) return api.bad('nama sudah dipakai')
    d.ifaces.push({ name: q.name, addr: null, members: [] }); return { out: [] }
  }),
  r('router', ['interface', 'bridge', 'port', 'add'], c => {
    const { d, q, api } = c
    const b = d.ifaces.find(i => i.name === q.bridge && i.members)
    if (!b || !d.ifaces.some(i => i.name === q.interface && !i.members && !i.parent)) return api.bad('bridge atau interface tidak ada')
    if (b.members.includes(q.interface)) return api.bad('interface sudah ada di bridge itu')
    b.members.push(q.interface); return { out: [] }
  }),
  r('router', ['interface', 'bridge', 'port', 'remove'], c => {
    const { d, q, api } = c
    const b = (d.ifaces || []).find(i => i.members && q.bridge ? i.name === q.bridge : i.members)
    const m = q.interface || q.port || Object.keys(q).filter(k => k !== 'numbers' && k !== 'bridge').map(k => q[k])[0]
    const arr = b?.members || [], idx = arr.indexOf(m ?? (q.numbers != null ? arr[+q.numbers] : undefined))
    if (idx < 0) return api.NOENTRY('member bridge')
    arr.splice(idx, 1); return { out: [] }
  }),
  r('router', ['interface', 'bridge', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.ifaces.filter(i => i.members), q, i => i.name); if (!x) return api.NOENTRY('bridge')
    if (x.members.length) return api.bad('bridge masih punya member; hapus port dulu')
    d.ifaces.splice(d.ifaces.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['interface', 'bridge', 'set'], c => {
    const { d, q, api } = c
    if (q.stp !== undefined) {
      if (!['yes', 'no'].includes(q.stp)) return api.bad('stp harus yes|no')
      d.stp = q.stp
    }
    return { out: [] }
  }),
  r('router', ['interface', 'bridge', 'stp', 'print'], stpPrint),
  r('router', ['interface', 'vlan', 'print'], c => ({ out: vlanPrint(c.d) })),
  r('router', ['interface', 'vlan', 'add'], c => {
    const { d, q, api } = c
    if (!q.name || !(+q['vlan-id'] > 0) || !d.ifaces.some(i => i.name === q.interface && !i.members && !i.parent)) return api.bad('butuh name= vlan-id= interface=<port fisik>')
    d.ifaces.push({ name: q.name, addr: null, vlan: +q['vlan-id'], parent: q.interface }); return { out: [] }
  }),
  r('router', ['interface', 'vlan', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.ifaces.filter(i => i.vlan), q, i => i.name); if (!x) return api.NOENTRY('vlan')
    d.ifaces.splice(d.ifaces.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['interface', 'wireless', 'set'], c => {
    const { d, t, q, api } = c
    if (t[3] !== 'wlan1') return api.bad('interface nirkabel hanya wlan1')
    const mode = q.mode || 'ap-bridge'
    if (!q.ssid) return api.bad('butuh ssid=<nama> [password=<min 8 karakter>] [mode=ap-bridge|station]')
    if (q.password && q.password.length < 8) return api.bad('WPA2 butuh password minimal 8 karakter')
    if (!['ap-bridge', 'station'].includes(mode)) return api.bad('mode harus ap-bridge|station')
    d.wlan = { ssid: q.ssid, pass: q.password || '', mode }
    logPush(d, `wireless wlan1 ssid=${q.ssid}`)
    return { out: [] }
  }),
  r('router', ['interface', 'wireless', 'print'], c => {
    const { d, net, api } = c
    return { out: [d.wlan ? `wlan1 ${d.wlan.mode || 'ap-bridge'} ssid=${d.wlan.ssid} ${d.wlan.pass ? 'wpa2' : 'open'} klien=${api.wifiLinks(net).filter(w => w.ap === d.id).length}` : 'wlan1 belum dikonfigurasi'] }
  }),
  r('router', ['interface', 'wireless', 'scan'], c => {
    const { d, net, api } = c
    const l = Object.values(net.devices).filter(a => a.type === 'router' && a.wlan && a.wlan.ssid !== d.wlan?.ssid && (a.wlan.mode === 'ap-bridge' || !a.wlan.mode) && api.dist(a, d) <= api.RANGE)
    return { out: l.length ? l.map(a => `${pad(a.wlan.ssid, 14)} ${Math.round(-35 - api.dist(a, d) * 0.25)} dBm ${a.wlan.pass ? 'wpa2' : 'open'}`) : ['tidak ada jaringan dalam jangkauan'] }
  }),

  r('router', ['ip', 'address', 'add'], c => {
    const { d, q, api } = c
    const i = d.ifaces.find(x => x.name === q.interface)
    if (!validCidr(q.address || '')) return api.bad('address tidak valid')
    if (!i) return api.bad('interface tidak ada')
    i.addr = q.address
    logPush(d, `ip address ${q.address} added on ${i.name}`)
    return { out: [] }
  }),
  r('router', ['ip', 'address', 'print'], c => {
    const list = c.d.ifaces.filter(i => i.addr)
    if (countOnly(c.t)) return { out: [`${list.length} address(es) found`] }
    if (detailOf(c.t)) return { out: ['', 'Flags: X - disabled, I - inactive, D - dynamic', '#  ADDRESS           INTERFACE       ACTUAL-INTERFACE', ...list.map((i, k) => `${k}  ${pad(i.addr, 17)} ${pad(i.name, 18)} ${i.name}`)] }
    return { out: ['#  ADDRESS           INTERFACE', ...list.map((i, k) => `${k}  ${pad(i.addr, 17)} ${i.name}`)] }
  }),
  r('router', ['ip', 'address', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.ifaces.filter(i => i.addr), q, i => i.name); if (!x) return api.NOENTRY('address')
    logPush(d, `ip address removed from ${x.name}`)
    x.addr = null; return { out: [] }
  }),
  r('router', ['ip', 'route', 'add'], c => {
    const { d, q, api } = c
    if (!validCidr(q['dst-address'] || '') || !validIp(q.gateway || '')) return api.bad('butuh dst-address=<net/len> gateway=<ip>')
    d.routes.push({ dst: q['dst-address'], gw: q.gateway })
    logPush(d, `route ${q['dst-address']} via ${q.gateway} added`)
    return { out: [] }
  }),
  r('router', ['ip', 'route', 'print'], c => {
    const { d, t, api } = c
    const rows = [
      ...d.ifaces.filter(i => i.addr).map(i => `DAC ${pad(netAddr(i.addr), 18)} ${i.name}`),
      ...d.routes.map(x => `S   ${pad(x.dst, 18)} ${x.gw}`),
      ...(api.converge(c.net), d.dyn || []).map(x => `${x.proto === 'ospf' ? 'O' : 'R'}   ${pad(x.dst, 18)} ${x.gw}  (${x.m})`)
    ]
    if (countOnly(t)) return { out: [`${rows.length} route(s) found`] }
    return { out: ['    DST-ADDRESS        GATEWAY', ...rows] }
  }),
  r('router', ['ip', 'route', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.routes, q, x => x.dst); if (!x) return api.NOENTRY('route')
    d.routes.splice(d.routes.indexOf(x), 1); return { out: [] }
  }),

  r('router', ['ip', 'arp', 'print'], arpPrint),
  r('router', ['ip', 'arp', 'remove'], c => {
    const { d, q, api } = c
    const n = api.sel(arpEntries(c.net, d, api.l2Peers), q, x => x.ip)
    if (!n) return api.NOENTRY('arp')
    ;(d.arpBlocked ??= []).push(n.ip)
    logPush(d, `arp entry ${n.ip} removed`)
    return { out: [] }
  }),
  r('router', ['ip', 'neighbor', 'print'], c => ({
    out: ['#  INTERFACE   ADDRESS         MAC-ADDRESS       IDENTITY', ...arpEntries(c.net, c.d, c.api.l2Peers).map((x, k) => `${k}  ${pad(x.iface, 11)} ${pad(x.ip, 16)} ${pad(x.mac, 18)} ${x.name}`)]
  })),
  r('router', ['ip', 'service', 'print'], servicePrint),
  r('router', ['ip', 'service', 'set'], serviceSet),
  r('router', ['ip', 'service', 'enable'], c => serviceToggle(c, false)),
  r('router', ['ip', 'service', 'disable'], c => serviceToggle(c, true)),
  r('router', ['ip', 'dns', 'print'], dnsPrint),
  r('router', ['ip', 'dns', 'set'], dnsSet),
  r('router', ['ip', 'dns', 'flush'], c => { c.d.dnsCache = []; return { out: [] } }),
  r('router', ['ip', 'dns', 'cache', 'print'], c => ({ out: (c.d.dnsCache || []).length ? c.d.dnsCache : ['(kosong)'] })),
  r('router', ['ip', 'dns', 'static', 'add'], c => {
    const { d, q, api } = c
    if (!q.name || !(validIp(q.address || '') || /^[\da-fA-F:]+$/.test(q.address || ''))) return api.bad('butuh name=<host> address=<ip>')
    if ((d.dnsStatic || []).some(e => e.name === q.name)) return api.bad('nama sudah ada')
;    (d.dnsStatic ??= []).push({ name: q.name, address: q.address }); return { out: [] }
  }),
  r('router', ['ip', 'dns', 'static', 'print'], c => ({ out: ['#  NAME             ADDRESS', ...(c.d.dnsStatic || []).map((e, k) => `${k}  ${pad(e.name, 16)} ${e.address}`)] })),
  r('router', ['ip', 'dns', 'static', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.dnsStatic || [], q, e => e.name); if (!x) return api.NOENTRY('dns static')
    d.dnsStatic.splice(d.dnsStatic.indexOf(x), 1); return { out: [] }
  }),

  r('router', ['ip', 'dhcp-client', 'add'], c => {
    const { d, q, api } = c
    const i = d.ifaces.find(x => x.name === q.interface && !x.members && !x.parent)
    if (!i) return api.bad('interface tidak ada')
    if ((d.dhcpClient || []).some(x => x.interface === i.name)) return api.bad('sudah ada client di interface ini')
;    (d.dhcpClient ??= []).push({ interface: i.name, ip: null }); return { out: [] }
  }),
  r('router', ['ip', 'dhcp-client', 'print'], c => ({ out: ['#  INTERFACE  ADDRESS', ...(c.d.dhcpClient || []).map((x, k) => `${k}  ${pad(x.interface, 10)} ${x.ip || '(belum bound)'}`)] })),
  r('router', ['ip', 'dhcp-client', 'renew'], c => {
    const { d, q, api } = c
    const list = d.dhcpClient || []
    const cl = q.interface ? list.find(x => x.interface === q.interface) : list[0]
    if (!cl) return api.bad("tidak ada dhcp-client (ip dhcp-client add interface=... dulu)")
    const res = api.dhcpOn(c.net, d, cl.interface)
    cl.ip = d.ifaces.find(i => i.name === cl.interface)?.addr || null
    return { out: [res] }
  }),
  r('router', ['ip', 'dhcp-client', 'release'], c => {
    const { d, q, api } = c
    const list = d.dhcpClient || []
    const cl = q.interface ? list.find(x => x.interface === q.interface) : list[0]
    if (!cl) return api.bad('tidak ada dhcp-client')
    const i = d.ifaces.find(x => x.name === cl.interface)
    if (cl.ip && i?.addr?.startsWith(cl.ip.split('/')[0] + '/')) i.addr = null
    d.routes = d.routes.filter(x => !x.dhcp)
    cl.ip = null
    return { out: ['dilepas'] }
  }),
  r('router', ['ip', 'dhcp-client', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.dhcpClient || [], q, cc => cc.interface); if (!x) return api.NOENTRY('dhcp-client')
    d.dhcpClient.splice(d.dhcpClient.indexOf(x), 1); return { out: [] }
  }),

  r('router', ['ip', 'pool', 'add'], c => {
    const { d, q, api } = c
    const [from, to] = (q.ranges || '').split('-')
    if (!q.name || !validIp(from) || !validIp(to)) return api.bad('butuh name=<x> ranges=<ip-awal>-<ip-akhir>')
    if ((d.pools || []).some(p => p.name === q.name)) return api.bad('nama pool sudah dipakai')
;    (d.pools ??= []).push({ name: q.name, from, to }); return { out: [] }
  }),
  r('router', ['ip', 'pool', 'print'], c => ({ out: ['#  NAME     RANGES', ...(c.d.pools || []).map((p, k) => `${k}  ${pad(p.name, 9)} ${p.from}-${p.to}`)] })),
  r('router', ['ip', 'pool', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.pools || [], q, p => p.name); if (!x) return api.NOENTRY('pool')
    d.pools.splice(d.pools.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['ip', 'dhcp-server', 'network', 'add'], c => {
    const { d, q, api } = c
    if (!validCidr(q.address || '')) return api.bad('butuh address=<net/len> [gateway=] [dns-server=]')
    if ((d.dhcpNets || []).some(n => n.address === q.address)) return api.bad('network sudah ada')
;    (d.dhcpNets ??= []).push({ address: q.address, gateway: q.gateway, dns: q['dns-server'] }); return { out: [] }
  }),
  r('router', ['ip', 'dhcp-server', 'network', 'print'], c => ({ out: ['#  ADDRESS        GATEWAY       DNS-SERVER', ...(c.d.dhcpNets || []).map((n, k) => `${k}  ${pad(n.address, 15)} ${pad(n.gateway || '', 13)} ${n.dns || ''}`)] })),
  r('router', ['ip', 'dhcp-server', 'network', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.dhcpNets || [], q, n => n.address); if (!x) return api.NOENTRY('network')
    d.dhcpNets.splice(d.dhcpNets.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['ip', 'dhcp-server', 'lease', 'print'], c => {
    const { d, t, net } = c
    const ls = d.leases || []
    if (countOnly(t)) return { out: [`${ls.length} lease(s) found`] }
    if (detailOf(t)) return { out: ['#  ADDRESS          MAC-ADDRESS       SERVER    STATUS', ...ls.map((l, k) => `${k}  ${pad(l.ip, 17)} ${pad(macOf(l.by, 'iface'), 18)} ${pad(d.name, 10)} waiting`)] }
    return { out: ['#  ADDRESS          CLIENT', ...ls.map((l, k) => `${k}  ${pad(l.ip, 16)} ${net.devices[l.by]?.name || '?'}`)] }
  }),
  r('router', ['ip', 'dhcp-server', 'lease', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.leases || [], q, l => l.ip); if (!x) return api.NOENTRY('lease')
    d.leases.splice(d.leases.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['ip', 'dhcp-server', 'add'], c => {
    const { d, q, api } = c
    if (!d.ifaces.some(i => i.name === q.interface) || !(d.pools || []).some(p => p.name === q['address-pool'])) return api.bad('interface atau address-pool tidak ada')
    if ((d.dhcp || []).some(x => x.name === q.name)) return api.bad('nama dhcp-server sudah dipakai')
;    (d.dhcp ??= []).push({ name: q.name, interface: q.interface, pool: q['address-pool'] }); return { out: [] }
  }),
  r('router', ['ip', 'dhcp-server', 'print'], c => ({ out: ['#  NAME   INTERFACE   ADDRESS-POOL', ...(c.d.dhcp || []).map((x, k) => `${k}  ${pad(x.name, 7)} ${pad(x.interface, 12)} ${x.pool}`)] })),
  r('router', ['ip', 'dhcp-server', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.dhcp || [], q, s => s.name); if (!x) return api.NOENTRY('dhcp-server')
    d.dhcp.splice(d.dhcp.indexOf(x), 1); return { out: [] }
  }),

  r('router', ['queue', 'simple', 'add'], c => {
    const { d, q, api } = c
    const [u, dn] = (q['max-limit'] || '').split('/').map(rate)
    if (!q.name || !validCidr(q.target || '') || !u || !dn) return api.bad('butuh name= target=<net/len> max-limit=<up>/<down> (contoh 2M/5M)')
    if ((d.queues || []).some(x => x.name === q.name)) return api.bad('nama queue sudah dipakai')
;    (d.queues ??= []).push({ name: q.name, target: q.target, up: u, down: dn }); return { out: [] }
  }),
  r('router', ['queue', 'simple', 'print'], c => ({ out: ['#  NAME     TARGET             MAX-LIMIT (up/down Mbps)', ...(c.d.queues || []).map((x, k) => `${k}  ${pad(x.name, 8)} ${pad(x.target, 18)} ${x.up}/${x.down}`)] })),
  r('router', ['queue', 'type', 'add'], c => {
    const { d, q, api } = c
    const rr = rate(q['pcq-rate'] || '')
    if (!q.name || q.kind !== 'pcq' || !rr || !['src-address', 'dst-address', 'both-addresses'].includes(q['pcq-classifier'])) return api.bad('butuh name= kind=pcq pcq-rate=<rate> pcq-classifier=src-address|dst-address|both-addresses')
    ;(d.qtypes ??= []).push({ name: q.name, rate: rr, classifier: q['pcq-classifier'] }); return { out: [] }
  }),
  r('router', ['queue', 'type', 'print'], c => ({ out: ['#  NAME     RATE (Mbps)  CLASSIFIER', ...(c.d.qtypes || []).map((x, k) => `${k}  ${pad(x.name, 8)} ${pad(x.rate, 12)} ${x.classifier}`)] })),
  r('router', ['queue', 'tree', 'add'], c => {
    const { d, q, api } = c
    const [u, dn] = (q['max-limit'] || '').split('/').map(rate)
    if (!q.name || q.parent !== 'global' || !u || !dn) return api.bad('butuh name= parent=global max-limit=<up>/<down>')
    if (q.queue && !(d.qtypes || []).some(x => x.name === q.queue)) return api.bad('queue type tidak ada')
    ;(d.qtrees ??= []).push({ name: q.name, up: u, down: dn, mark: q['packet-mark'] || '', queue: q.queue || '' }); return { out: [] }
  }),
  r('router', ['queue', 'tree', 'print'], c => ({ out: ['#  NAME     PARENT  MAX-LIMIT (up/down Mbps)  QUEUE', ...(c.d.qtrees || []).map((x, k) => `${k}  ${pad(x.name, 8)} global  ${x.up}/${x.down}  ${x.queue || '-'}`)] })),
  r('router', ['queue', 'simple', 'remove'], c => queueRemove(c, 'simple')),
  r('router', ['queue', 'tree', 'remove'], c => queueRemove(c, 'tree')),
  r('router', ['queue', 'type', 'remove'], c => queueRemove(c, 'type')),

  r('router', ['ip', 'firewall', 'address-list', 'add'], c => {
    const { d, q, api } = c
    if (!q.list || !(validCidr(q.address || '') || /^[\da-fA-F:]+$/.test(q.address || ''))) return api.bad('butuh list=<nama> address=<ip|net/len>')
;    (d.addrList ??= []).push({ list: q.list, address: q.address, timeout: q.timeout || '' }); return { out: [] }
  }),
  r('router', ['ip', 'firewall', 'address-list', 'print'], c => ({ out: ['#  LIST     ADDRESS        TIMEOUT', ...(c.d.addrList || []).map((x, k) => `${k}  ${pad(x.list, 9)} ${pad(x.address, 15)} ${x.timeout || 'static'}`)] })),
  r('router', ['ip', 'firewall', 'address-list', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.addrList || [], q, e => e.address); if (!x) return api.NOENTRY('address-list')
    d.addrList.splice(d.addrList.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['ip', 'firewall', 'filter', 'add'], c => {
    const { d, q, api } = c
    if (!['input', 'forward'].includes(q.chain) || !['accept', 'drop'].includes(q.action)) return api.bad('butuh chain=input|forward action=accept|drop')
    if (q.protocol && !['tcp', 'udp', 'icmp'].includes(q.protocol)) return api.bad('protocol harus tcp|udp|icmp')
    if (q['dst-port'] && (!/^\d+$/.test(q['dst-port']) || +q['dst-port'] < 1 || +q['dst-port'] > 65535)) return api.bad('dst-port 1-65535')
    ;(d.fw ??= []).push({ chain: q.chain, action: q.action, src: q['src-address'], dst: q['dst-address'], proto: q.protocol, dport: q['dst-port'] }); return { out: [] }
  }),
  r('router', ['ip', 'firewall', 'filter', 'print'], c => {
    const { d, t } = c
    if (countOnly(t)) return { out: [`${(d.fw || []).length} filter rule(s) found`] }
    return { out: ['#  CHAIN    ACTION  SRC               DST               PROTO DPORT', ...(d.fw || []).map((x, k) => `${k}  ${pad(x.chain, 8)} ${pad(x.action, 7)} ${pad(x.src || '-', 17)} ${pad(x.dst || '-', 17)} ${pad(x.proto || '-', 5)} ${x.dport || '-'}`)] }
  }),
  r('router', ['ip', 'firewall', 'filter', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.fw || [], q, x => x.chain); if (!x) return api.NOENTRY('filter')
    d.fw.splice(d.fw.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['ip', 'firewall', 'nat', 'add'], c => {
    const { d, q, api } = c
    if (q.chain === 'srcnat') {
      if (q.action !== 'masquerade' || !d.ifaces.some(i => i.name === q['out-interface'])) return api.bad('butuh chain=srcnat action=masquerade out-interface=<iface>')
      ;(d.nat ??= []).push({ chain: 'srcnat', action: 'masquerade', out: q['out-interface'] }); return { out: [] }
    }
    if (q.chain !== 'dstnat' || !['dst-nat', 'redirect'].includes(q.action)) return api.bad('butuh chain=srcnat|dstnat action=masquerade|dst-nat|redirect')
    if (q.action === 'dst-nat' && !validIp(q['to-addresses'] || '')) return api.bad('to-addresses harus IPv4 valid')
    if (q.action === 'redirect' && q['to-addresses'] && !validIp(q['to-addresses'])) return api.bad('to-addresses harus IPv4 valid')
    if (q['to-ports'] && (!/^\d+$/.test(q['to-ports']) || +q['to-ports'] < 1 || +q['to-ports'] > 65535)) return api.bad('to-ports 1-65535')
    if (q['dst-port'] && (!/^\d+$/.test(q['dst-port']) || +q['dst-port'] < 1 || +q['dst-port'] > 65535)) return api.bad('dst-port 1-65535')
    if (q.protocol && !['tcp', 'udp'].includes(q.protocol)) return api.bad('protocol harus tcp|udp')
    if (q['in-interface'] && !d.ifaces.some(i => i.name === q['in-interface'])) return api.bad('in-interface tidak ada')
    ;(d.nat ??= []).push({ chain: 'dstnat', action: q.action, redirect: q.action === 'redirect', toAddr: q.action === 'redirect' ? null : q['to-addresses'], toPort: q['to-ports'], proto: q.protocol, dport: q['dst-port'], inIface: q['in-interface'] }); return { out: [] }
  }),
  r('router', ['ip', 'firewall', 'nat', 'print'], c => ({
    out: ['#  CHAIN  ACTION      OUT/TO', ...(c.d.nat || []).map((n, k) => { const m = c.api.natNorm(n); return `${k}  ${pad(m.chain, 7)} ${pad(m.action, 11)} ${m.chain === 'srcnat' ? m.out : m.redirect ? 'redirect' : (m.toAddr || '-') + (m.toPort ? ':' + m.toPort : '')}` })]
  })),
  r('router', ['ip', 'firewall', 'nat', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.nat || [], q, n => n.out); if (!x) return api.NOENTRY('nat')
    d.nat.splice(d.nat.indexOf(x), 1); return { out: [] }
  }),
  r('router', ['ip', 'firewall', 'mangle', 'print'], c => ({ out: ['(kosong)'] })),
  r('router', ['ip', 'firewall', 'mangle', 'add'], c => c.api.unsupported('mangle/packet-mark belum dimodelkan')),
  r('router', ['ip', 'firewall', 'connection', 'print'], c => c.api.unsupported('tabel connection tracking belum dimodelkan')),

  r('router', ['routing', 'rip', 'network', 'add'], dynNetAdd),
  r('router', ['routing', 'ospf', 'network', 'add'], dynNetAdd),
  r('router', ['routing', 'rip', 'network', 'print'], dynNetPrint),
  r('router', ['routing', 'ospf', 'network', 'print'], dynNetPrint),
  r('router', ['routing', 'rip', 'network', 'remove'], dynNetRemove),
  r('router', ['routing', 'ospf', 'network', 'remove'], dynNetRemove),
  r('router', ['routing', 'rip', 'neighbor', 'print'], c => dynNeighbors(c, 'rip')),
  r('router', ['routing', 'ospf', 'neighbor', 'print'], c => dynNeighbors(c, 'ospf')),

  r('router', ['ipv6', 'address', 'add'], c => {
    const { d, q, api } = c
    const [a, l] = (q.address || '').split('/')
    if (!validIp6(a || '') || !(+l >= 0 && +l <= 128)) return api.bad('address IPv6 tidak valid (contoh 2001:db8::1/64)')
    const i = d.ifaces.find(x => x.name === q.interface)
    if (!i) return api.bad('interface tidak ada')
    i.addr6 = q.address; return { out: [] }
  }),
  r('router', ['ipv6', 'address', 'print'], c => ({ out: ['#  ADDRESS                              INTERFACE', ...c.d.ifaces.filter(i => i.addr6).map((i, k) => `${k}  ${pad(i.addr6, 36)} ${i.name}`)] })),
  r('router', ['ipv6', 'address', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(d.ifaces.filter(i => i.addr6), q, i => i.name); if (!x) return api.NOENTRY('address')
    x.addr6 = null; return { out: [] }
  }),
  r('router', ['ipv6', 'route', 'add'], c => {
    const { d, q, api } = c
    const [a, l] = (q['dst-address'] || '').split('/')
    if (!validIp6(a || '') || !(+l >= 0 && +l <= 128) || !validIp6(q.gateway || '')) return api.bad('gateway IPv6 tidak valid')
    ;(d.routes6 ??= []).push({ dst: q['dst-address'], gw: q.gateway }); return { out: [] }
  }),
  r('router', ['ipv6', 'route', 'print'], c => ({ out: ['#  DST                                GATEWAY', ...(c.d.routes6 || []).map((x, k) => `${k}  ${pad(x.dst, 34)} ${x.gw}`)] })),
  r('router', ['ipv6', 'route', 'remove'], c => {
    const { d, q, api } = c
    const x = api.sel(c.d.routes6 || [], q, x => x.dst); if (!x) return api.NOENTRY('route')
    c.d.routes6.splice(c.d.routes6.indexOf(x), 1); return { out: [] }
  }),

  r('router', ['system', 'identity', 'set'], identitySet),
  r('router', ['system', 'identity', 'print'], c => ({ out: [`  name: ${c.d.name}`] })),
  r('router', ['system', 'resource', 'print'], resourcePrint),
  r('router', ['system', 'clock', 'print'], clockPrint),
  r('router', ['system', 'clock', 'set'], clockSet),
  r('router', ['system', 'reboot'], reboot),
  r('router', ['system', 'package', 'print'], c => c.api.unsupported('paket RouterOS belum dimodelkan')),
  r('router', ['user', 'print'], c => ({ out: ['Flags: X - disabled', '#  NAME     GROUP    ADDRESS', ...usersOf(c.d).map((u, k) => `${k}  ${pad(u.name, 9)} ${pad(u.group, 8)} 0.0.0.0/0`)] })),
  r('router', ['user', 'add'], c => {
    const { d, q, api } = c
    const name = q.name || q.user
    if (!name || !/^[\w.-]{1,40}$/.test(name)) return api.bad('butuh name=<nama> (huruf/angka/.-, maks 40)')
    const group = q.group || 'read'
    if (!USER_GROUPS.includes(group)) return api.bad('group harus ' + USER_GROUPS.join('|'))
    if (usersOf(d).some(u => u.name === name)) return api.bad('user sudah ada')
;    d.users = [...usersCopy(d), { name, group }]
    logPush(d, `user ${name} added`)
    return { out: [] }
  }),
  r('router', ['user', 'set'], c => {
    const { d, q, api } = c
    const list = usersCopy(d)
    const u = list.find(x => x.name === (q.name || q.user))
    if (!u) return api.NOENTRY('user')
    if (q.group) {
      if (!USER_GROUPS.includes(q.group)) return api.bad('group harus ' + USER_GROUPS.join('|'))
      u.group = q.group
    }
    d.users = list
    return { out: [] }
  }),
  r('router', ['user', 'remove'], c => {
    const { d, q, api } = c
    const list = usersOf(d)
    const u = q.numbers != null ? list[+q.numbers] : list.find(x => x.name === (q.name || q.user))
    if (!u) return api.NOENTRY('user')
    d.users = list.filter(x => x.name !== u.name)
    logPush(d, `user ${u.name} removed`)
    return { out: [] }
  }),
  r('router', ['log', 'print'], logPrint),
  r('router', ['log', 'info'], c => c.api.unsupported('filter level butuh log real-time; pakai log print')),
  r('router', ['caps', 'man', 'print'], c => c.api.unsupported('CAPsMAN belum dimodelkan')),
  r('router', ['certificate', 'print'], c => c.api.unsupported('sertifikat belum dimodelkan'))
]

// ---------- SWITCH ----------
const SWITCH_RULES = [
  r('switch', ['help'], c => helpOut(c, 'switch')),
  r('switch', ['vlan', 'access'], c => vlanSet(c, 'access')),
  r('switch', ['vlan', 'trunk'], c => vlanSet(c, 'trunk')),
  r('switch', ['vlan', 'remove'], c => {
    const { d, q, api } = c
    if (!d.ifaces.some(i => i.name === q.port)) return api.bad('port tidak ada')
    delete d.ports[q.port]; return { out: [] }
  }),
  r('switch', ['vlan', 'print'], c => ({ out: vlanPrint(c.d) })),
  r('switch', ['interface', 'print'], c => ifacePrint(c)),
  r('switch', ['interface', 'ethernet', 'print'], c => ifacePrint(c, c.d.ifaces.filter(isCable))),
  r('switch', ['interface', 'ethernet', 'monitor'], ethMonitor),
  r('switch', ['interface', 'ethernet', 'enable'], c => ifEnable(c, false)),
  r('switch', ['interface', 'ethernet', 'disable'], c => ifEnable(c, true)),
  r('switch', ['interface', 'ethernet', 'set'], ethSet),
  r('switch', ['interface', 'bridge', 'set'], c => {
    const { d, q, api } = c
    if (q.stp !== undefined) {
      if (!['yes', 'no'].includes(q.stp)) return api.bad('stp harus yes|no')
      d.stp = q.stp
    }
    return { out: [] }
  }),
  r('switch', ['interface', 'bridge', 'stp', 'print'], stpPrint),
  r('switch', ['interface', 'bridge', 'vlan', 'add'], c => {
    const { d, q, api } = c
    const p = d.ifaces.find(i => i.name === q.interface)
    if (!p || !(+q['vlan-ids'] > 0)) return api.bad('butuh vlan-ids=<id> interface=<iface>')
    ;(d.ports ??= {})[p.name] = { mode: 'access', vlan: +q['vlan-ids'] }; return { out: [] }
  }),
  r('switch', ['interface', 'bridge', 'vlan', 'print'], c => ({ out: vlanPrint(c.d) })),
  r('switch', ['interface', 'bridge', 'print'], c => ({ out: ['(kosong)'] })),
  r('switch', ['interface', 'bridge', 'port', 'print'], c => ({ out: ['(kosong)'] })),
  r('switch', ['interface', 'bridge', 'host', 'print'], c => c.api.unsupported('tabel MAC per bridge tidak dimodelkan')),
  r('switch', ['system', 'identity', 'set'], identitySet),
  r('switch', ['system', 'identity', 'print'], c => ({ out: [`  name: ${c.d.name}`] })),
  r('switch', ['system', 'resource', 'print'], resourcePrint),
  r('switch', ['system', 'clock', 'print'], clockPrint),
  r('switch', ['system', 'clock', 'set'], clockSet),
  r('switch', ['system', 'reboot'], reboot),
  r('switch', ['user', 'print'], c => ({ out: ['Flags: X - disabled', '#  NAME     GROUP    ADDRESS', ...usersOf(c.d).map((u, k) => `${k}  ${pad(u.name, 9)} ${pad(u.group, 8)} 0.0.0.0/0`)] })),
  r('switch', ['log', 'print'], logPrint)
]

// ---------- HOST: shim RouterOS lama (tetap jalan sebagai cadangan) ----------
const HOST_RULES = [
  r('host', ['help'], c => helpOut(c, 'host')),
  r('host', ['speedtest'], c => btOut(c)),
  r('host', ['tool', 'bandwidth-test'], c => btOut(c)),
  r('host', ['wifi'], c => {
    const { net, d, t, q, api } = c
    if (d.type !== 'laptop') return { out: ['perangkat ini tidak punya Wi-Fi'] }
    if (c.is('wifi', 'scan')) {
      const l = Object.values(net.devices).filter(a => a.type === 'router' && a.wlan && (a.wlan.mode === 'ap-bridge' || !a.wlan.mode) && api.dist(a, d) <= api.RANGE)
      return { out: l.length ? l.map(a => `${pad(a.wlan.ssid, 14)} ${Math.round(-35 - api.dist(a, d) * 0.25)} dBm ${a.wlan.pass ? 'wpa2' : 'open'}`) : ['tidak ada jaringan dalam jangkauan'] }
    }
    if (c.is('wifi', 'connect')) {
      if (!q.ssid) return { out: ['wifi connect ssid=<nama> [password=<kata sandi>]'] }
      d.wifi = { ssid: q.ssid, pass: q.password || '' }
    }
    return { out: [api.wifiStatus(net, d)] }
  }),
  r('host', ['dhcp'], c => ({ out: [c.api.dhcp(c.net, c.d)] })),
  r('host', ['traceroute'], c => traceOut(c, false)),
  r('host', ['nslookup'], c => {
    const rr = c.api.resolve(c.net, c.d, c.t[1])
    return { out: [rr.err || `${c.t[1]} -> ${rr.ip}`] }
  }),
  r('host', [], c => (c.is('ip') && validCidr(c.t[1]) ? quickIp(c) : null)),
  r('host', ['ipconfig'], c => ({ out: [`IP      : ${c.d.ifaces[0].addr || '-'}`, `Gateway : ${c.d.routes[0]?.gw || '-'}`, `DNS     : ${c.d.dns || '-'}`] })),
  r('host', ['ip', 'address', 'add'], c => {
    if (!validCidr(c.q.address || '')) return c.api.bad('address tidak valid')
    c.d.ifaces[0].addr = c.q.address; return { out: [] }
  }),
  r('host', ['ip', 'address', 'print'], c => ({ out: ['#  ADDRESS           INTERFACE', `0  ${pad(c.d.ifaces[0].addr || '-', 17)} ${c.d.ifaces[0].name}`] })),
  r('host', ['ip', 'route', 'add'], c => {
    if (!validIp(c.q.gateway || '')) return c.api.bad('butuh dst-address=<net/len> gateway=<ip>')
    c.d.routes = [{ dst: c.q['dst-address'] || '0.0.0.0/0', gw: c.q.gateway }]; return { out: [] }
  }),
  r('host', ['ip', 'route', 'print'], c => ({ out: c.d.routes.length ? c.d.routes.map(x => `${x.dst} via ${x.gw}`) : ['(kosong)'] })),
  r('host', ['ip', 'dns', 'set'], c => {
    if (!validIp(c.q.servers || '')) return c.api.bad('servers=<ip> tidak valid')
    c.d.dns = c.q.servers; return { out: [] }
  }),
  r('host', ['ip', 'address', 'remove'], c => { c.d.ifaces[0].addr = null; return { out: [] } }),
  r('host', ['ip', 'route', 'remove'], c => { c.d.routes = []; return { out: [] } }),
  r('host', ['ip', 'dns', 'remove'], c => { c.d.dns = null; return { out: [] } }),
  r('host', ['ipv6', 'address', 'add'], c => {
    const [a, l] = (c.q.address || '').split('/')
    if (!validIp6(a || '') || !(+l >= 0 && +l <= 128) || !c.d.ifaces.some(i => i.name === c.q.interface)) return c.api.bad('address IPv6 tidak valid (contoh 2001:db8::1/64)')
    c.d.ifaces.find(i => i.name === c.q.interface).addr6 = c.q.address; return { out: [] }
  }),
  r('host', ['ipv6', 'address', 'print'], c => ({ out: ['#  ADDRESS                              INTERFACE', ...c.d.ifaces.filter(i => i.addr6).map((i, k) => `${k}  ${pad(i.addr6, 36)} ${i.name}`)] })),
  r('host', ['ipv6', 'address', 'remove'], c => {
    const list = c.d.ifaces.filter(i => i.addr6), x = c.api.sel(list, c.q, i => i.name); if (!x) return c.api.NOENTRY('address')
    x.addr6 = null; return { out: [] }
  }),
  r('host', ['ipv6', 'route', 'add'], c => {
    const [a, l] = (c.q['dst-address'] || '').split('/')
    if (!validIp6(a || '') || !(+l >= 0 && +l <= 128) || !validIp6(c.q.gateway || '')) return c.api.bad('gateway IPv6 tidak valid')
    ;(c.d.routes6 ??= []).push({ dst: c.q['dst-address'], gw: c.q.gateway }); return { out: [] }
  }),
  r('host', ['ipv6', 'route', 'print'], c => ({ out: ['#  DST                                GATEWAY', ...(c.d.routes6 || []).map((x, k) => `${k}  ${pad(x.dst, 34)} ${x.gw}`)] })),
  r('host', ['ipv6', 'route', 'remove'], c => {
    const x = c.api.sel(c.d.routes6 || [], c.q, x => x.dst); if (!x) return c.api.NOENTRY('route')
    c.d.routes6.splice(c.d.routes6.indexOf(x), 1); return { out: [] }
  })
]

function quickIp(c) {
  const { d, t } = c
  d.ifaces[0].addr = t[1]
  d.routes = validIp(t[2] || '') ? [{ dst: '0.0.0.0/0', gw: t[2] }] : []
  d.dns = validIp(t[3] || '') ? t[3] : null
  return { out: ['ok'] }
}

// ---------- dispatch ----------
export const RULES = [...ROUTER_RULES, ...SWITCH_RULES, ...HOST_RULES]

export const FALLBACK = {
  router: c => ({ out: [`bad command name ${c.t[0]}`, "ketik 'help' untuk daftar perintah"] }),
  switch: () => ({ out: ["ketik 'help' untuk daftar perintah (mis. help vlan)"] }),
  host: () => ({ out: ["ketik 'help' untuk daftar perintah (mis. help ip, help wifi)"] })
}
