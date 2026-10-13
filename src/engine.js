// Mesin jaringan: IP, routing statis, L2 (switch), ping, dan orkestrasi CLI.
// Perintah CLI sendiri tinggal di src/ros/registry.js (RouterOS) dan src/ros/hostcmd.js (CMD Windows).
import { linkStatus, speedLabel } from './linkmodel.js'
import { n2, toIp, parse, inNet, netOf, validIp, validIp6, parse6, inNet6, validCidr, rate, kv, tokenize, quoteVal } from './ros/netbits.js'
import { RULES, FALLBACK, logPush, usersOf } from './ros/registry.js'
import { hostCmd } from './ros/hostcmd.js'

// Helper IP tetap diekspor dari sini supaya pemanggil lama (ConfigModal, tests) tidak berubah.
export { validIp, validCidr, validIp6, parse6, inNet6 }
export { logPush, usersOf }

const owns6 = (d, ip) => d.ifaces.some(i => i.addr6 && parse6(i.addr6).ip === ip)
const addr6Ip = i => (i && i.addr6 ? parse6(i.addr6).ip : null)
const owns = (d, ip) => d.ifaces.some(i => i.addr && parse(i.addr).ip === ip)

function lookup(d, ip) {
  let best = null
  const take = (len, ad, iface, nh) => { if (!best || len > best.len || (len === best.len && ad < best.ad)) best = { len, ad, iface, nh } }
  for (const i of d.ifaces) if (i.addr && inNet(i.addr, ip)) take(parse(i.addr).len, 0, i.name, ip)
  for (const r of [...d.routes.map(x => ({ ...x, ad: 1 })), ...(d.dyn || [])]) {
    if (!inNet(r.dst, ip)) continue
    const c = d.ifaces.find(i => i.addr && inNet(i.addr, r.gw))
    if (c) take(parse(r.dst).len, r.ad, c.name, r.gw)
  }
  return best
}

const peerOf = (net, d, p) => { for (const l of net.links) { if (l.a.dev === d && l.a.if === p) return l.b; if (l.b.dev === d && l.b.if === p) return l.a } }
const portCfg = (sw, p) => sw.ports?.[p] || { mode: 'access', vlan: 1 }

// Status tiga-state untuk `interface print`: 'disabled' | 'no link' (tidak tercolok) | 'no link (mismatch)' | 'running <rate>'
export const ifaceStatus = (net, d, name) => {
  const iface = d.ifaces.find(i => i.name === name)
  if (iface?.disabled) return 'disabled'
  const lk = net.links.find(l => (l.a.dev === d.id && l.a.if === name) || (l.b.dev === d.id && l.b.if === name))
  if (!lk) return 'no link'
  const st = linkStatus(net, lk)
  return st.up ? `running ${speedLabel(st.speed)}` : 'no link (mismatch)'
}

// Link hidup = tercolok, kedua ujung tidak di-disable, dan medium cocok
export const linkLive = (net, l) => !!l && linkStatus(net, l).up

// Endpoint L2 yang terjangkau dari (dev, iface): switch VLAN (access/trunk), bridge router, subinterface VLAN
export function l2Peers(net, devId, ifn) {
  const src = net.devices[devId].ifaces.find(i => i.name === ifn)
  const out = [], seen = new Set()
  const q = (src.members || [src.parent || ifn]).map(port => ({ dev: devId, port, tag: src.vlan ?? null }))
  while (q.length) {
    const { dev, port, tag } = q.shift()
    const k = dev + port + tag
    if (seen.has(k)) continue
    seen.add(k)
    for (const p of peersOf(net, dev, port)) {
    const pd = net.devices[p.dev]
    if (pd.type === 'switch') {
      const c = portCfg(pd, p.if)
      if (c.mode === 'access' && tag != null) continue
      const v = c.mode === 'access' ? c.vlan : (tag ?? 1)
      if (c.mode === 'trunk' && v !== 1 && !c.vlans.includes(v)) continue
      for (const x of pd.ifaces) {
        if (x.name === p.if) continue
        const e = portCfg(pd, x.name)
        if (e.mode === 'access' && e.vlan === v) q.push({ dev: pd.id, port: x.name, tag: null })
        else if (e.mode === 'trunk' && (v === 1 || e.vlans.includes(v))) q.push({ dev: pd.id, port: x.name, tag: v === 1 ? null : v })
      }
    } else if (tag != null) {
      const sub = pd.ifaces.find(i => i.parent === p.if && i.vlan === tag)
      if (sub) out.push({ dev: pd.id, if: sub.name })
    } else {
      const br = pd.ifaces.find(i => i.members?.includes(p.if))
      if (br) { out.push({ dev: pd.id, if: br.name }); br.members.filter(m => m !== p.if).forEach(m => q.push({ dev: pd.id, port: m, tag: null })) }
      else {
        out.push({ dev: pd.id, if: p.if })
        // AP nirkabel menjembatani semua kliennya dalam satu domain L2
        if (pd.type === 'router' && p.if === 'wlan1' && pd.wlan?.ssid && (pd.wlan.mode === 'ap-bridge' || !pd.wlan.mode)) {
          for (const w of wifiLinks(net).filter(w => w.ap === pd.id)) out.push({ dev: w.cl, if: net.devices[w.cl].type === 'router' ? 'wlan1' : 'wlan0' })
        }
      }
    }
    }
  }
  return out.filter(p => !(p.dev === devId && p.if === ifn))
}

const RANGE = 240
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
// Asosiasi Wi-Fi: laptop + router station terhubung ke AP ber-SSID/password sama dalam jangkauan
export function wifiLinks(net) {
  const aps = Object.values(net.devices).filter(d => d.type === 'router' && d.wlan?.ssid && (d.wlan.mode === 'ap-bridge' || !d.wlan.mode))
  const out = []
  const clients = Object.values(net.devices).filter(d => (d.type === 'laptop' && d.wifi) || (d.type === 'router' && d.wlan?.mode === 'station' && d.wlan?.ssid))
  for (const c of clients) {
    const cred = c.type === 'laptop' ? c.wifi : c.wlan
    if (c.type === 'router' && c.wlan.mode !== 'station') continue
    const ap = aps.filter(a => a.id !== c.id && a.wlan.ssid === cred.ssid && a.wlan.pass === cred.pass && dist(a, c) <= RANGE).sort((a, b) => dist(a, c) - dist(b, c))[0]
    if (ap) out.push({ ap: ap.id, cl: c.id, dbm: Math.round(-35 - dist(ap, c) * 0.25) })
  }
  return out
}
// RSTP sederhana: switch / router ber-bridge yang loop fisiknya redundant di-block
const isL2 = d => d.type === 'switch' || (d.type === 'router' && d.ifaces.some(i => i.members?.length))
const stpOn = d => (d.stp ?? 'yes') !== 'no'
export function stpBlocked(net) {
  const blocked = new Set()
  const on = Object.values(net.devices).filter(d => isL2(d) && stpOn(d))
  if (!on.length) return blocked
  const ids = new Set(on.map(d => d.id))
  const seen = new Set(), q = [], disc = new Map()
  for (const root of on.map(d => d.id).sort()) {
    if (seen.has(root)) continue
    seen.add(root); q.push(root)
    while (q.length) {
      const u = q.shift()
      for (const l of net.links) {
        let v = null, uif = null, vif = null
        if (l.a.dev === u) { v = l.b.dev; uif = l.a.if; vif = l.b.if }
        else if (l.b.dev === u) { v = l.a.dev; uif = l.b.if; vif = l.a.if }
        else continue
        if (!ids.has(v)) continue
        // port yang di-disable atau medium-nya tidak cocok bukan bagian topologi aktif
        if (!linkLive(net, l)) continue
        const key = `${l.a.dev}:${l.a.if}-${l.b.dev}:${l.b.if}`
        if (!seen.has(v)) { seen.add(v); q.push(v); disc.set(v, key) }
        else if (disc.get(u) !== key && disc.get(v) !== key) { blocked.add(`${u}:${uif}`); blocked.add(`${v}:${vif}`) }
      }
    }
  }
  return blocked
}
function peersOf(net, d, p) {
  if (p === 'wlan0') return wifiLinks(net).filter(w => w.cl === d).map(w => ({ dev: w.ap, if: 'wlan1' }))
  if (p === 'wlan1' && net.devices[d].type === 'router') {
    const me = net.devices[d]
    if (me.wlan?.mode === 'station') return wifiLinks(net).filter(w => w.cl === d).map(w => ({ dev: w.ap, if: 'wlan1' }))
    return wifiLinks(net).filter(w => w.ap === d).map(w => ({ dev: w.cl, if: net.devices[w.cl].type === 'router' ? 'wlan1' : 'wlan0' }))
  }
  const o = peerOf(net, d, p)
  const lk = net.links.find(l => (l.a.dev === d && l.a.if === p) || (l.b.dev === d && l.b.if === p))
  const out = o && linkLive(net, lk) ? [o] : []
  const blk = stpBlocked(net)
  return out.filter(b => {
    const A = net.devices[d], B = net.devices[b.dev]
    if (!isL2(A) || !isL2(B)) return true
    // tanpa STP di kedua ujung, loop fisik bocor: link L2-L2 di-poison (demo storm)
    if (A.stp === 'no' && B.stp === 'no') return false
    return !blk.has(`${d}:${p}`) && !blk.has(`${b.dev}:${b.if}`)
  })
}
function wifiStatus(net, c) {
  if (!c.wifi) return 'tidak terhubung ke Wi-Fi'
  const w = wifiLinks(net).find(x => x.cl === c.id)
  if (w) return `terhubung ke ${c.wifi.ssid} (${w.dbm} dBm)`
  const aps = Object.values(net.devices).filter(a => a.type === 'router' && a.wlan?.ssid === c.wifi.ssid)
  if (!aps.length) return `SSID ${c.wifi.ssid} tidak ditemukan`
  if (!aps.some(a => dist(a, c) <= RANGE)) return 'di luar jangkauan: dekatkan laptop ke AP'
  return 'autentikasi gagal: password salah'
}
// Uji bandwidth: kapasitas 100 Mbps, dibatasi simple queue + queue tree di router yang dilewati dan laju Wi-Fi
export function bw(net, srcId, dstIp) {
  const r = ping(net, srcId, dstIp, 'tcp', '80')
  if (!r.ok) return r
  const sIp = srcOf(net.devices[srcId], dstIp), dst = r.path[r.hops.length], mids = r.path.slice(1, r.hops.length)
  const wl = wifiLinks(net).filter(w => w.cl === srcId || w.cl === dst).map(w => (w.dbm > -55 ? 150 : w.dbm > -65 ? 72 : 24))
  // kapasitas medium kabel: min(speed) semua link UP di r.path antar hop; path tanpa link kabel -> 100
  const linkCap = () => {
    let c = Infinity, found = false
    for (let i = 0; i + 1 < r.path.length; i++) {
      const u = r.path[i], v = r.path[i + 1]
      const lk = net.links.find(l => (l.a.dev === u && l.b.dev === v) || (l.b.dev === u && l.a.dev === v))
      if (!lk) continue
      const st = linkStatus(net, lk)
      if (linkLive(net, lk)) { c = Math.min(c, st.speed); found = true }
    }
    return found ? c : 100
  }
  const cap = (a, b, dir) => {
    let c = Math.min(linkCap(), ...wl)
    for (const id of mids) {
      for (const q of net.devices[id].queues || []) c = Math.min(c, inNet(q.target, a) ? q.up : inNet(q.target, b) ? q.down : 1e9)
      // tree tanpa mangle = match-all; PCQ rate = cap per arah
      for (const q of net.devices[id].qtrees || []) {
        c = Math.min(c, dir === 'tx' ? q.up : q.down)
        const t = (net.devices[id].qtypes || []).find(x => x.name === q.queue)
        if (t) c = Math.min(c, t.rate)
      }
    }
    return c
  }
  return { ok: true, path: r.path, tx: cap(sIp, dstIp, 'tx'), rx: cap(dstIp, sIp, 'rx') }
}

// RIP (metric = jumlah hop, maks 15, AD 120) dan OSPF (cost 10/link, AD 110) -> d.dyn
export function converge(net) {
  const rs = Object.values(net.devices).filter(d => d.type === 'router')
  rs.forEach(r => { r.dyn = [] })
  for (const [proto, ad, w] of [['rip', 120, 1], ['ospf', 110, 10]]) {
    const on = rs.filter(r => (r[proto] || []).length)
    const act = (r, i) => i.addr && r[proto].some(n => inNet(n, parse(i.addr).ip))
    const adj = new Map(on.map(r => [r.id, []]))
    for (const a of on) for (const ia of a.ifaces.filter(i => act(a, i))) for (const p of l2Peers(net, a.id, ia.name)) {
      const b = net.devices[p.dev], ib = b.ifaces.find(i => i.name === p.if)
      if (b.type === 'router' && adj.has(b.id) && act(b, ib) && inNet(ia.addr, parse(ib.addr).ip)) adj.get(a.id).push({ id: b.id, nh: parse(ib.addr).ip })
    }
    for (const r of on) {
      const dist = { [r.id]: 0 }, first = {}, todo = [r.id]
      while (todo.length) {
        const u = todo.shift()
        for (const e of adj.get(u)) {
          const nd = dist[u] + w
          if (nd < (dist[e.id] ?? 1e9) && (proto !== 'rip' || nd <= 15)) { dist[e.id] = nd; first[e.id] = u === r.id ? e.nh : first[u]; todo.push(e.id) }
        }
      }
      for (const x of on) if (x !== r && dist[x.id] != null) for (const i of x.ifaces.filter(i => act(x, i))) {
        const dst = netOf(i.addr)
        if (r.ifaces.some(j => j.addr && netOf(j.addr) === dst)) continue
        const old = r.dyn.find(e => e.dst === dst && e.proto === proto)
        if (old && old.m <= dist[x.id]) continue
        if (old) r.dyn.splice(r.dyn.indexOf(old), 1)
        r.dyn.push({ dst, gw: first[x.id], ad, m: dist[x.id], proto })
      }
    }
  }
}

const srcOf = (d, ip) => { const r = lookup(d, ip), i = r && d.ifaces.find(x => x.name === r.iface); return i ? parse(i.addr).ip : null }
// Forwarding IPv6: connected addr6 + routes6 (termasuk default ::/0); firewall/NAT/queue diabaikan
function lookup6(d, ip) {
  let best = null
  const take = (len, ad, iface, nh) => { if (!best || len > best.len || (len === best.len && ad < best.ad)) best = { len, ad, iface, nh } }
  for (const i of d.ifaces) if (i.addr6 && inNet6(i.addr6, ip)) take(parse6(i.addr6).len, 0, i.name, ip)
  for (const r of d.routes6 || []) {
    if (!inNet6(r.dst, ip)) continue
    const c = d.ifaces.find(i => i.addr6 && inNet6(i.addr6, r.gw))
    if (c) take(parse6(r.dst).len, 1, c.name, r.gw)
  }
  return best
}
const src6Of = (d, ip) => { const r = lookup6(d, ip), i = r && d.ifaces.find(x => x.name === r.iface); return i ? addr6Ip(i) : null }
function trace6(net, srcId, dstIp, srcIp) {
  const path = [srcId], hops = []
  const fail = err => ({ ok: false, path, hops, err })
  let cur = net.devices[srcId], s = srcIp
  for (let ttl = 0; ttl < 16; ttl++) {
    if (owns6(cur, dstIp)) return { ok: true, path, hops }
    const r = lookup6(cur, dstIp)
    if (!r) return fail(`${cur.name}: no route to host`)
    const via = l2Peers(net, cur.id, r.iface)
    const nxt = via.find(p => addr6Ip(net.devices[p.dev].ifaces.find(i => i.name === p.if)) === r.nh)
    if (!nxt) return fail(`${cur.name}: host unreachable (ARP failed)`)
    hops.push(r.nh); cur = net.devices[nxt.dev]; path.push(cur.id)
  }
  return fail('TTL exceeded')
}
export function ping6(net, srcId, dstIp) {
  const src = net.devices[srcId]
  if (owns6(src, dstIp)) return { ok: true, path: [srcId], hops: [] }
  const s0 = src6Of(src, dstIp)
  if (!s0) return { ok: false, path: [srcId], hops: [], err: `${src.name}: no route to host` }
  const f = trace6(net, srcId, dstIp, s0)
  if (!f.ok) return f
  const b = trace6(net, f.path.at(-1), s0, dstIp)
  if (!b.ok) return { ok: false, path: f.path, hops: f.hops, err: `reply hilang: ${b.err}` }
  return { ok: true, path: [...f.path, ...b.path.slice(1)], hops: f.hops }
}
const hit = (r, s, d, proto, dport) => (!r.src || inNet(r.src, s)) && (!r.dst || inNet(r.dst, d)) && (!r.proto || r.proto === proto) && (!r.dport || String(r.dport) === String(dport || ''))
const drops = (d, chain, s, dst, proto, dport) => (d.fw || []).find(r => r.chain === chain && hit(r, s, dst, proto, dport))?.action === 'drop'
// NAT: entri srcnat lama { out } dinormalisasi saat baca
const natNorm = n => n.chain ? n : { chain: 'srcnat', action: 'masquerade', out: n.out }
const curToIp = (d, ifname) => { const i = d.ifaces.find(x => x.name === ifname && x.addr) || d.ifaces.find(x => x.addr); return i ? parse(i.addr).ip : null }

// Telusuri paket hop-by-hop: dstnat, firewall (input/forward), srcnat masquerade
function trace(net, srcId, dstIp, srcIp, nat = true, proto = 'icmp', dport = '') {
  const path = [srcId], hops = [], xlat = []
  const fail = err => ({ ok: false, path, hops, xlat, err })
  let cur = net.devices[srcId], s = srcIp, ingress = null
  for (let ttl = 0; ttl < 16; ttl++) {
    const dr = (cur.nat || []).map(natNorm).find(n => n.chain === 'dstnat' &&
      (!n.proto || n.proto === proto) && (!n.dport || String(n.dport) === String(dport)) &&
      (!n.inIface || n.inIface === ingress) && (!n.dst || inNet(n.dst, dstIp)))
    if (dr) {
      const to = dr.redirect ? curToIp(cur, ingress) : dr.toAddr
      if (to) { dstIp = to; xlat.push({ dev: cur.id, to: to + (dr.toPort ? ':' + dr.toPort : '') }) }
    }
    if (owns(cur, dstIp)) {
      if (cur.id !== srcId && drops(cur, 'input', s, dstIp, proto, dport)) return fail(`${cur.name}: firewall input drop`)
      return { ok: true, path, hops, xlat }
    }
    const r = lookup(cur, dstIp)
    if (!r) return fail(`${cur.name}: no route to host`)
    if (cur.id !== srcId) {
      if (drops(cur, 'forward', s, dstIp, proto, dport)) return fail(`${cur.name}: firewall forward drop`)
      if (nat && (cur.nat || []).map(natNorm).some(n => n.chain === 'srcnat' && n.out === r.iface)) {
        const o = parse(cur.ifaces.find(i => i.name === r.iface).addr).ip
        xlat.push({ dev: cur.id, to: o }); s = o
      }
    }
    const via = l2Peers(net, cur.id, r.iface)
    const nxt = via.find(p => net.devices[p.dev].ifaces.find(i => i.name === p.if)?.addr?.startsWith(r.nh + '/'))
    if (!nxt) return fail(`${cur.name}: host ${r.nh} unreachable (ARP failed)`)
    ingress = via.find(p => p.dev === nxt.dev)?.if || null
    hops.push(r.nh); cur = net.devices[nxt.dev]; path.push(cur.id)
  }
  return fail('TTL exceeded')
}

// Ping = jalur pergi + jalur pulang (balasan di-NAT balik lewat router yang sama)
export function ping(net, srcId, dstIp, proto = 'icmp', dport = '') {
  converge(net)
  const src = net.devices[srcId]
  if (owns(src, dstIp)) return { ok: true, path: [srcId], hops: [] }
  const s0 = srcOf(src, dstIp)
  if (!s0) return { ok: false, path: [srcId], hops: [], err: `${src.name}: no route to host` }
  const f = trace(net, srcId, dstIp, s0, true, proto, dport)
  if (!f.ok) return f
  let cur = f.path.at(-1)
  const path = [...f.path]
  for (const t of [...f.xlat].reverse().map(x => String(x.to).split(':')[0]).concat(s0)) {
    const b = trace(net, cur, t, dstIp, false, proto, dport)
    if (!b.ok) return { ok: false, path, hops: f.hops, err: `reply hilang: ${b.err}` }
    path.push(...b.path.slice(1)); cur = b.path.at(-1)
  }
  return { ok: true, path, hops: f.hops }
}

// DHCP client pada router: sewa IP dari server DHCP di segmen L2 yang sama.
// Rute bawaan dari DHCP ditandai { dhcp: true } agar release hanya menghapus
// rute/IP hasil DHCP, bukan konfigurasi statis.
function dhcpOn(net, d, ifname) {
  const iface = d.ifaces.find(i => i.name === ifname)
  if (!iface) return 'dhcp: interface tidak ada'
  for (const p of l2Peers(net, d.id, ifname)) {
    const r = net.devices[p.dev]
    const sv = (r.dhcp || []).find(x => x.interface === p.if)
    if (!sv) continue
    const pool = (r.pools || []).find(x => x.name === sv.pool)
    const nw = pool && (r.dhcpNets || []).find(x => inNet(x.address, pool.from))
    if (!nw) return 'dhcp: pool atau network di server belum lengkap'
    const ls = (r.leases ??= [])
    let l = ls.find(x => x.by === d.id)
    for (let n = n2(pool.from); !l && n <= n2(pool.to); n++) if (!ls.some(x => x.ip === toIp(n))) { l = { ip: toIp(n), by: d.id }; ls.push(l) }
    if (!l) return 'dhcp: pool habis'
    iface.addr = `${l.ip}/${parse(nw.address).len}`
    d.routes = validIp(nw.gateway || '') ? [{ dst: '0.0.0.0/0', gw: nw.gateway, dhcp: true }] : d.routes.filter(x => !x.dhcp)
    d.dns = nw.dns || null
    return `bound ${iface.addr} gw ${nw.gateway || '-'} dns ${d.dns || '-'}`
  }
  return 'dhcp: tidak ada server DHCP di segmen ini'
}
const dhcp = (net, pc) => dhcpOn(net, pc, pc.ifaces[0].name)

function resolve(net, d, name) {
  if (validIp(name || '') || validIp6(name || '') || (name || '').includes(':')) return { ip: name }
  let tab = d
  if (d.type !== 'router') {
    if (d.dns && d.dns.includes(':')) {
      tab = Object.values(net.devices).find(x => owns6(x, d.dns)) || null
    } else {
      const sip = d.dns && srcOf(d, d.dns), t = sip && trace(net, d.id, d.dns, sip)
      tab = t && t.ok ? net.devices[t.path.at(-1)] : null
    }
  }
  const e = tab && (tab.dnsStatic || []).find(x => x.name === name)
  return e ? { ip: e.address } : { err: `dns: tidak bisa resolve ${name}` }
}

export function resolveDns(net, d, name) { return resolve(net, d, name) }

// Pilih satu entri untuk remove: numbers=<indeks dari print> atau key=<nilai> (name/dst-address/dst/address/ip/interface/chain)
function sel(list, q, getter) {
  if (q.numbers != null && q.numbers !== '') { const n = +q.numbers; return Number.isInteger(n) && n >= 0 && n < list.length ? list[n] : null }
  const k = Object.keys(q).find(k => k !== 'numbers')
  return k ? list.find(x => String(getter(x)) === String(q[k])) || null : null
}
const NOENTRY = what => ({ out: [`failure: tidak ada entri ${what} yang cocok (pakai numbers= / nama)`] })
const unsupported = what => ({ ok: false, out: ['failure: ' + what] })

// Cetak konfigurasi perangkat sebagai skrip yang dapat dijalankan ulang
function exportOf(net, d) {
  const L = [`# ${d.name} (${d.type})`, `system identity set name=${d.name}`]
  if (d.type === 'switch') {
    for (const i of d.ifaces) {
      const c = portCfg(d, i.name)
      L.push(c.mode === 'access' ? `vlan access port=${i.name} id=${c.vlan}` : `vlan trunk port=${i.name} ids=${(c.vlans || []).join(',')}`)
      if (i.disabled || i.comment) L.push(`interface ethernet set ${i.name} disabled=${i.disabled ? 'yes' : 'no'}${i.comment ? ' comment=' + quoteVal(i.comment) : ''}`)
    }
    if ((d.stp || 'yes') !== 'yes') L.push('interface bridge set stp=no')
    if (d.clockDate || d.clockTime) L.push(`system clock set${d.clockDate ? ' date=' + d.clockDate : ''}${d.clockTime ? ' time=' + d.clockTime : ''}`)
    return L
  }
  if (['pc', 'server', 'laptop'].includes(d.type)) {
    if (d.ifaces[0].addr) L.push(`ip address add address=${d.ifaces[0].addr} interface=${d.ifaces[0].name}`)
    if (d.ifaces[0].addr6) L.push(`ipv6 address add address=${d.ifaces[0].addr6} interface=${d.ifaces[0].name}`)
    for (const r of d.routes) L.push(`ip route add dst-address=${r.dst} gateway=${r.gw}`)
    for (const r of d.routes6 || []) L.push(`ipv6 route add dst-address=${r.dst} gateway=${r.gw}`)
    if (d.dns) L.push(`ip dns set servers=${d.dns}`)
    if (d.wifi) L.push(`wifi connect ssid=${d.wifi.ssid} password=${d.wifi.pass}`)
    return L
  }
  for (const i of d.ifaces) {
    if (i.addr) L.push(`ip address add address=${i.addr} interface=${i.name}`)
    if (i.addr6) L.push(`ipv6 address add address=${i.addr6} interface=${i.name}`)
    if (i.vlan) L.push(`interface vlan add name=${i.name} vlan-id=${i.vlan} interface=${i.parent}`)
    if (i.members) L.push(`interface bridge add name=${i.name}`)
  }
  for (const i of d.ifaces) if (i.members) for (const m of i.members) L.push(`interface bridge port add bridge=${i.name} interface=${m}`)
  for (const i of d.ifaces) if (i.kind && (i.disabled || i.comment)) L.push(`interface ethernet set ${i.name} disabled=${i.disabled ? 'yes' : 'no'}${i.comment ? ' comment=' + quoteVal(i.comment) : ''}`)
  for (const r of d.routes) L.push(`ip route add dst-address=${r.dst} gateway=${r.gw}`)
  for (const r of d.routes6 || []) L.push(`ipv6 route add dst-address=${r.dst} gateway=${r.gw}`)
  if (d.dns) L.push(`ip dns set servers=${d.dns}`)
  if (d.dnsRemote && d.dnsRemote !== 'yes') L.push(`ip dns set allow-remote-requests=${d.dnsRemote}`)
  for (const n of d.rip || []) L.push(`routing rip network add network=${n}`)
  for (const n of d.ospf || []) L.push(`routing ospf network add network=${n}`)
  for (const p of d.pools || []) L.push(`ip pool add name=${p.name} ranges=${p.from}-${p.to}`)
  for (const n of d.dhcpNets || []) L.push(`ip dhcp-server network add address=${n.address}${n.gateway ? ' gateway=' + n.gateway : ''}${n.dns ? ' dns-server=' + n.dns : ''}`)
  for (const s of d.dhcp || []) L.push(`ip dhcp-server add name=${s.name} interface=${s.interface} address-pool=${s.pool}`)
  for (const e of d.dnsStatic || []) L.push(`ip dns static add name=${e.name} address=${e.address}`)
  for (const a of d.addrList || []) L.push(`ip firewall address-list add list=${a.list} address=${a.address}${a.timeout ? ' timeout=' + a.timeout : ''}`)
  if (d.wlan) L.push(`interface wireless set wlan1 ssid=${d.wlan.ssid} password=${d.wlan.pass} mode=${d.wlan.mode || 'ap-bridge'}`)
  for (const q of d.queues || []) L.push(`queue simple add name=${q.name} target=${q.target} max-limit=${q.up}M/${q.down}M`)
  for (const q of d.qtypes || []) L.push(`queue type add name=${q.name} kind=pcq pcq-rate=${q.rate}M pcq-classifier=${q.classifier}`)
  for (const q of d.qtrees || []) L.push(`queue tree add name=${q.name} parent=global max-limit=${q.up}M/${q.down}M${q.queue ? ' queue=' + q.queue : ''}`)
  for (const r of d.fw || []) L.push(`ip firewall filter add chain=${r.chain} action=${r.action}${r.src ? ' src-address=' + r.src : ''}${r.dst ? ' dst-address=' + r.dst : ''}${r.proto ? ' protocol=' + r.proto : ''}${r.dport ? ' dst-port=' + r.dport : ''}`)
  for (const n0 of d.nat || []) { const n = natNorm(n0); L.push(n.chain === 'srcnat' ? `ip firewall nat add chain=srcnat action=masquerade out-interface=${n.out}` : `ip firewall nat add chain=dstnat action=${n.action}${n.redirect ? '' : ' to-addresses=' + n.toAddr}${n.toPort ? ' to-ports=' + n.toPort : ''}${n.proto ? ' protocol=' + n.proto : ''}${n.dport ? ' dst-port=' + n.dport : ''}${n.inIface ? ' in-interface=' + n.inIface : ''}`) }
  for (const c of d.dhcpClient || []) L.push(`ip dhcp-client add interface=${c.interface}`)
  if (d.clockDate || d.clockTime) L.push(`system clock set${d.clockDate ? ' date=' + d.clockDate : ''}${d.clockTime ? ' time=' + d.clockTime : ''}`)
  for (const u of usersOf(d)) if (u.name !== 'admin') L.push(`user add name=${u.name} group=${u.group}`)
  if (!usersOf(d).some(u => u.name === 'admin')) L.push('user remove name=admin')
return L
}

// Bantu yang diteruskan ke registry/hostcmd. Registry tidak mengimpor engine
// supaya tidak ada siklus import; semua kebutuhan lewat objek ini.
const START = Date.now()

const API = {
  sel, NOENTRY, unsupported,
  bad: m => ({ ok: false, out: ['failure: ' + m] }),
  resolve, ping, ping6, bw, wifiLinks, stpBlocked, converge,
  linkStatus, linkLive, ifaceStatus, exportOf, wifiStatus, dhcpOn, dhcp,
  portCfg, natNorm, l2Peers, dist, RANGE, START
}

const scopeOf = d => (d.type === 'router' ? 'router' : d.type === 'switch' ? 'switch' : 'host')

export function exec(net, d, line) {
  const t = tokenize(line)
  if (!t.length) return { out: [] }
  const scope = scopeOf(d)
  const q = kv(t)
  const ctx = { net, d, t, q, scope, is: (...w) => w.every((x, i) => t[i] === x), api: API }
  if (t[0] === 'export') return { out: exportOf(net, d) }
  // CMD Windows dicoba lebih dulu untuk host, baru shim RouterOS
  if (scope === 'host') {
    const r = hostCmd(API, net, d, t, q)
    if (r) return r
  }
  for (const rule of RULES) {
    if (rule.s !== scope) continue
    if (!ctx.is(...rule.w)) continue
    const out = rule.fn(ctx)
    if (out) return out
  }
  return FALLBACK[scope](ctx)
}

