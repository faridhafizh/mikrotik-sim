// Template topologi lokal: build() mengembalikan { devices, links } plausibel, tanpa IP
import { buildIfaces, defaultProfileFor } from './linkmodel.js'
const mk = (id, type, name, x, y) => {
  const profileId = defaultProfileFor(type)
  const d = {
    id, type, name, x, y, routes: [], routes6: [], dns6: null,
    ifaces: profileId ? buildIfaces(profileId) : [{ name: 'wlan0', addr: null }]
  }
  if (profileId) d.profileId = profileId
  if (type === 'switch') d.stp = 'yes'
  return d
}
const L = (a, ai, b, bi, cable = 'cat6') => ({ a: { dev: a, if: ai }, b: { dev: b, if: bi }, cable })
const topo = (devs, links) => ({ devices: Object.fromEntries(devs.map(d => [d.id, d])), links })

export const TEMPLATES = [
  {
    id: 'star', title: 'Star', desc: '1 router + 4 PC terkabel',
    build: () => topo([mk('t1', 'router', 'R1', 360, 240), mk('t2', 'pc', 'PC1', 160, 120), mk('t3', 'pc', 'PC2', 560, 120), mk('t4', 'pc', 'PC3', 160, 360), mk('t5', 'pc', 'PC4', 560, 360)],
      [L('t2', 'eth0', 't1', 'ether1'), L('t3', 'eth0', 't1', 'ether2'), L('t4', 'eth0', 't1', 'ether3'), L('t5', 'eth0', 't1', 'ether4')])
  },
  {
    id: 'chain3', title: 'Chain 3 router', desc: 'PC-R1-R2-R3-PC tanpa IP',
    build: () => topo([mk('t1', 'pc', 'PC1', 80, 240), mk('t2', 'router', 'R1', 250, 240), mk('t3', 'router', 'R2', 450, 240), mk('t4', 'router', 'R3', 650, 240), mk('t5', 'pc', 'PC2', 820, 240)],
      [L('t1', 'eth0', 't2', 'ether1'), L('t2', 'ether2', 't3', 'ether1'), L('t3', 'ether2', 't4', 'ether1'), L('t4', 'ether2', 't5', 'eth0')])
  },
  {
    id: 'vlan-starter', title: 'VLAN starter', desc: 'SW + 3 PC + 1 router, kabel saja',
    build: () => topo([mk('t1', 'switch', 'SW1', 360, 240), mk('t2', 'pc', 'PC1', 180, 110), mk('t3', 'pc', 'PC2', 360, 110), mk('t4', 'pc', 'PC3', 540, 110), mk('t5', 'router', 'R1', 360, 400)],
      [L('t2', 'eth0', 't1', 'ether1'), L('t3', 'eth0', 't1', 'ether2'), L('t4', 'eth0', 't1', 'ether3'), L('t1', 'ether4', 't5', 'ether1')])
  }
]
