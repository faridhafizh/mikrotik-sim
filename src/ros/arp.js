// Tabel ARP turunan L2: untuk tiap interface beralamat, tetangganya di domain L2 yang sama.
// Entri yang dihapus manual (arp remove / arp -d) disimpan di d.arpBlocked supaya hilang dari cetak.
import { macOf } from './mac.js'
import { splitAddr } from './num.js'

export function arpEntries(net, d, l2Peers) {
  const blocked = d.arpBlocked || []
  const out = []
  for (const i of d.ifaces || []) {
    if (!i.addr || i.disabled) continue
    for (const p of l2Peers(net, d.id, i.name)) {
      const pd = net.devices[p.dev]
      const pi = pd?.ifaces?.find(x => x.name === p.if)
      const ip = pi?.addr ? splitAddr(pi.addr).ip : null
      if (!ip || blocked.includes(ip)) continue
      out.push({ ip, iface: i.name, mac: macOf(p.dev, p.if), dev: p.dev, if: p.if, name: pd.name })
    }
  }
  return out.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }))
}

// Tetangga OSPF/RIP: router se-L2 yang sama-sama mengikutkan network untuk protokol tersebut
export function protoNeighbors(net, d, proto, l2Peers, inNet) {
  const nets = d[proto] || []
  if (!nets.length) return []
  const mine = (d.ifaces || []).filter(i => i.addr && nets.some(n => inNet(n, splitAddr(i.addr).ip)))
  const out = []
  for (const i of mine) {
    for (const p of l2Peers(net, d.id, i.name)) {
      const pd = net.devices[p.dev]
      if (!pd || pd.type !== 'router' || pd.id === d.id) continue
      const pi = pd.ifaces?.find(x => x.name === p.if)
      const theirNets = pd[proto] || []
      if (!theirNets.length || !pi?.addr) continue
      if (!mine.some(m => theirNets.some(n => inNet(n, splitAddr(pi.addr).ip)))) continue
      out.push({ id: pd.id, name: pd.name, addr: splitAddr(pi.addr).ip, iface: i.name, metric: proto === 'ospf' ? 10 : 1, state: 'Full' })
    }
  }
  return out
}