// Model tunggal kabel + port: jenis port, tipe kabel, profil generik per device.
// Dipakai bersama oleh store net.js, templates.js, server/labs.js, engine.js, dan kanvas.
// Nama SFPP dipakai sebagai key (bukan 'SFP+') agar aman sebagai prop JSON.

export const PORT_KINDS = {
  FE: { label: 'FastEthernet', medium: 'copper', speed: 100 },
  GBE: { label: 'Gigabit', medium: 'copper', speed: 1000 },
  SFP: { label: 'SFP 1G', medium: 'fiber', speed: 1000 },
  SFPP: { label: 'SFP+ 10G', medium: 'fiber', speed: 10000 }
}

export const CABLE_TYPES = {
  cat5e: { label: 'UTP Cat5e', short: 'Cat5e', medium: 'copper', max: 100 },
  cat6: { label: 'UTP Cat6', short: 'Cat6', medium: 'copper', max: 1000 },
  fiber1g: { label: 'Fiber SFP 1G', short: 'Fiber1G', medium: 'fiber', max: 1000 },
  fiber10g: { label: 'Fiber SFP+ 10G', short: 'Fiber10G', medium: 'fiber', max: 10000 }
}

const rep = (n, k) => Array.from({ length: n }, () => k)

export const PROFILES = [
  { id: 'router-gbe', type: 'router', label: 'Router 5× GbE', ports: rep(5, 'GBE') },
  { id: 'router-fe', type: 'router', label: 'Router 5× FE', ports: rep(5, 'FE') },
  { id: 'router-gbe-sfp', type: 'router', label: 'Router 4× GbE + SFP', ports: [...rep(4, 'GBE'), 'SFP'] },
  { id: 'switch-gbe', type: 'switch', label: 'Switch 8× GbE', ports: rep(8, 'GBE') },
  { id: 'switch-fe', type: 'switch', label: 'Switch 8× FE', ports: rep(8, 'FE') },
  { id: 'switch-gbe-sfp', type: 'switch', label: 'Switch 8× GbE + 2× SFP+', ports: [...rep(8, 'GBE'), 'SFPP', 'SFPP'] },
  { id: 'pc-gbe', type: 'pc', label: 'PC 1× GbE', ports: ['GBE'] },
  { id: 'pc-fe', type: 'pc', label: 'PC 1× FE', ports: ['FE'] },
  { id: 'server-gbe', type: 'server', label: 'Server 1× GbE', ports: ['GBE'] },
  { id: 'server-fe', type: 'server', label: 'Server 1× FE', ports: ['FE'] },
  { id: 'server-sfp', type: 'server', label: 'Server 1× SFP', ports: ['SFP'] },
  { id: 'server-sfpp', type: 'server', label: 'Server 1× SFP+', ports: ['SFPP'] }
]

export const DEFAULT_PROFILE = { router: 'router-gbe', switch: 'switch-gbe', pc: 'pc-gbe', server: 'server-gbe' }

export const isCableKind = k => Object.prototype.hasOwnProperty.call(PORT_KINDS, k)
export const isCableType = c => Object.prototype.hasOwnProperty.call(CABLE_TYPES, c)

export const profilesFor = type => PROFILES.filter(p => p.type === type)
export const defaultProfileFor = type => DEFAULT_PROFILE[type] || null
export const profileById = id => PROFILES.find(p => p.id === id) || null

// Nama iface: router/switch copper -> etherN berurutan; fiber -> sfpN.
// pc/server: satu port copper -> eth0, port fiber -> sfp1.
export function buildIfaces(profileId) {
  const p = profileById(profileId)
  if (!p) return []
  const host = p.type === 'pc' || p.type === 'server'
  let c = 0, f = 0
  const out = p.ports.map(kind => {
    const fiber = PORT_KINDS[kind].medium === 'fiber'
    if (fiber) return { name: 'sfp' + (++f), addr: null, kind }
    return { name: (host ? 'eth' : 'ether') + (host ? c++ : ++c), addr: null, kind }
  })
  if (p.type === 'router') out.push({ name: 'wlan1', addr: null })
  return out
}

// Kind port kabel; iface wlan/vlan/bridge tanpa kind -> null.
export function portKind(dev, ifName) {
  const i = dev?.ifaces?.find(x => x.name === ifName)
  return i && isCableKind(i.kind) ? i.kind : null
}

// Port kabel yang belum dipakai link mana pun (dua arah).
export function freePorts(dev, links, devId) {
  if (!dev) return []
  return (dev.ifaces || []).filter(i => i.kind && !links.some(l => (l.a.dev === devId && l.a.if === i.name) || (l.b.dev === devId && l.b.if === i.name)))
}

export function defaultCableFor(kindA, kindB) {
  const a = PORT_KINDS[kindA], b = PORT_KINDS[kindB]
  if (!a || !b) return 'cat6'
  if (a.medium === 'copper' && b.medium === 'copper') return 'cat6'
  if (a.medium === 'fiber' && b.medium === 'fiber') return (kindA === 'SFPP' || kindB === 'SFPP') ? 'fiber10g' : 'fiber1g'
  return 'cat6'
}

// iface tanpa kind (data lama) dianggap GBE; link tanpa cable dianggap cat6 → tetap UP seperti dulu.
// Port yang di-disable lewat `interface ethernet disable` dianggap DOWN seperti medium mismatch.
export function linkStatus(net, link) {
  const dev = id => net?.devices?.[id]
  const kA = portKind(dev(link.a.dev), link.a.if) || 'GBE'
  const kB = portKind(dev(link.b.dev), link.b.if) || 'GBE'
  const ck = isCableType(link.cable) ? link.cable : 'cat6'
  const ma = PORT_KINDS[kA].medium, mb = PORT_KINDS[kB].medium, mc = CABLE_TYPES[ck].medium
  const off = side => !!dev(side.dev)?.ifaces?.find(i => i.name === side.if)?.disabled
  if (off(link.a) || off(link.b)) return { up: false, speed: 0, reason: 'port disabled' }
  const up = ma === mb && mb === mc
  return {
    up,
    speed: up ? Math.min(PORT_KINDS[kA].speed, PORT_KINDS[kB].speed, CABLE_TYPES[ck].max) : 0,
    reason: up ? '' : `medium mismatch: ${ma}/${mb}/${mc}`
  }
}

export const speedLabel = speed => speed >= 10000 ? '10G' : speed >= 1000 ? '1G' : '100M'

// Migrasi bawaan data lama: device tanpa profil -> default se-type; iface kabel tanpa kind -> GBE;
// link tanpa cable -> cat6. Laptop tanpa profil. Dipakai restore() dan importData().
export function migrateTopo(t) {
  if (!t || typeof t !== 'object' || !t.devices) return t
  for (const d of Object.values(t.devices)) {
    if (!d || typeof d !== 'object' || d.type === 'laptop') continue
    if (!profileById(d.profileId)) d.profileId = defaultProfileFor(d.type)
    for (const i of d.ifaces || []) {
      if (!i || typeof i !== 'object' || typeof i.name !== 'string') continue
      if (i.name.startsWith('wlan') || i.vlan || i.members) continue
      if (!isCableKind(i.kind)) i.kind = 'GBE'
    }
  }
  for (const l of t.links || []) {
    if (!l || typeof l !== 'object') continue
    if (!isCableType(l.cable)) l.cable = 'cat6'
  }
  return t
}
