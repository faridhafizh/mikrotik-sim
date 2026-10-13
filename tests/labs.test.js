import { describe, it, expect } from 'vitest'
import { exec } from '../src/engine.js'
import { LABS, runLab } from '../server/labs.js'

const canon = {
  lab1: [['R1', 'ip address add address=192.168.1.1/24 interface=ether1'], ['R1', 'ip address add address=192.168.2.1/24 interface=ether2'], ['PC1', 'ip 192.168.1.10/24 192.168.1.1'], ['PC2', 'ip 192.168.2.10/24 192.168.2.1']],
  lab2: [['PC1', 'ip 192.168.1.10/24 192.168.1.1'], ['R1', 'ip address add address=192.168.1.1/24 interface=ether1'], ['R1', 'ip address add address=10.0.0.1/24 interface=ether2'], ['R1', 'ip route add dst-address=0.0.0.0/0 gateway=10.0.0.2'], ['R1', 'ip firewall nat add chain=srcnat action=masquerade out-interface=ether2']],
  lab3: [['SW1', 'vlan access port=ether1 id=10'], ['SW1', 'vlan access port=ether2 id=10'], ['SW1', 'vlan access port=ether3 id=20']],
  lab4: [['R1', 'routing ospf network add network=192.168.1.0/24'], ['R1', 'routing ospf network add network=10.0.12.0/24'], ['R2', 'routing ospf network add network=10.0.12.0/24'], ['R2', 'routing ospf network add network=10.0.23.0/24'], ['R3', 'routing ospf network add network=10.0.23.0/24'], ['R3', 'routing ospf network add network=192.168.3.0/24']],
  lab5: [['R1', 'queue simple add name=q target=192.168.1.0/24 max-limit=2M/5M']],
  lab6: [['R1', 'interface wireless set wlan1 ssid=LabWiFi password=rahasia123 mode=ap-bridge'], ['R1', 'ip address add address=192.168.10.1/24 interface=wlan1'], ['R1', 'ip pool add name=p ranges=192.168.10.10-192.168.10.20'], ['R1', 'ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1'], ['R1', 'ip dhcp-server add name=d interface=wlan1 address-pool=p'], ['LT1', 'wifi connect ssid=LabWiFi password=rahasia123'], ['LT1', 'dhcp']],
  lab7: [['R1', 'routing rip network add network=192.168.1.0/24'], ['R1', 'routing rip network add network=10.0.12.0/24'], ['R2', 'routing rip network add network=10.0.12.0/24'], ['R2', 'routing rip network add network=10.0.23.0/24'], ['R3', 'routing rip network add network=10.0.23.0/24'], ['R3', 'routing rip network add network=192.168.3.0/24']],
  lab8: [['R1', 'ip firewall filter add chain=forward action=drop src-address=192.168.1.10/32 dst-address=10.0.0.10/32']],
  lab9: [['R1', 'ip dns static add name=web address=10.0.0.10'], ['PC1', 'ip dns set servers=192.168.1.1']],
  lab10: [['R1', 'interface vlan add name=vlan10 vlan-id=10 interface=ether1'], ['R1', 'interface vlan add name=vlan20 vlan-id=20 interface=ether1'], ['R1', 'ip address add address=192.168.10.1/24 interface=vlan10'], ['R1', 'ip address add address=192.168.20.1/24 interface=vlan20'], ['PC1', 'ip route add dst-address=0.0.0.0/0 gateway=192.168.10.1'], ['PC2', 'ip route add dst-address=0.0.0.0/0 gateway=192.168.10.1'], ['PC3', 'ip route add dst-address=0.0.0.0/0 gateway=192.168.20.1']],
  lab11: [['R1', 'ip firewall nat add chain=dstnat action=dst-nat to-addresses=10.0.0.10 protocol=tcp dst-port=80 to-ports=80 in-interface=ether1'], ['R1', 'ip firewall filter add chain=forward action=accept protocol=tcp dst-port=80'], ['R1', 'ip firewall filter add chain=forward action=drop protocol=icmp']],
  lab12: [['PC1', 'ipv6 address add address=2001:db8:1::1/64 interface=eth0'], ['R1', 'ipv6 address add address=2001:db8:1::2/64 interface=ether1'], ['R1', 'ipv6 address add address=2001:db8:2::1/64 interface=ether2'], ['PC2', 'ipv6 address add address=2001:db8:2::2/64 interface=eth0'], ['PC1', 'ipv6 route add dst-address=::/0 gateway=2001:db8:1::2'], ['PC2', 'ipv6 route add dst-address=::/0 gateway=2001:db8:2::1']],
}

describe('labs gagal dulu lalu lolos', () => {
  for (const lab of LABS) {
    it(`${lab.id} seed gagal, skrip kanonik lolos`, () => {
      const net = JSON.parse(JSON.stringify(lab.seed))
      expect(runLab(lab, net).every(r => r.ok)).toBe(false)
      for (const [name, line] of canon[lab.id] || []) {
        const d = Object.values(net.devices).find(x => x.name === name)
        exec(net, d, line)
      }
      const res = runLab(lab, net)
      expect(res.map(r => r.label + ':' + r.ok).join('\n')).toBe(res.map(r => r.label + ':true').join('\n'))
    })
  }
})
