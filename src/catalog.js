import RouterIcon from './components/icons/RouterIcon.vue'
import SwitchIcon from './components/icons/SwitchIcon.vue'
import PcIcon from './components/icons/PcIcon.vue'
import ServerIcon from './components/icons/ServerIcon.vue'
import LaptopIcon from './components/icons/LaptopIcon.vue'

export const TYPES = [
  { id: 'router', label: 'Router', color: 'var(--color-info)', Icon: RouterIcon },
  { id: 'switch', label: 'Switch', color: 'var(--color-ok)', Icon: SwitchIcon },
  { id: 'pc', label: 'PC', color: 'var(--color-fg)', Icon: PcIcon },
  { id: 'server', label: 'Server', color: 'var(--color-accent)', Icon: ServerIcon },
  { id: 'laptop', label: 'Laptop Wi-Fi', color: 'var(--color-wifi)', Icon: LaptopIcon }
]

export const CMDS = {
  router: ['help', 'help ip', 'help dhcp', 'help queue', 'help wireless', 'help interface', 'export', 'ip address add address= interface=', 'ip address print', 'ip address print detail', 'ip address remove interface=', 'ip route add dst-address= gateway=', 'ip route print', 'ip route print count-only', 'ip route remove dst-address=', 'ip arp print', 'ip arp remove numbers=', 'ip neighbor print', 'ip service print', 'ip dns print', 'ip dns set servers=', 'interface print', 'interface print detail', 'interface ethernet print', 'interface ethernet monitor ether', 'interface ethernet disable ether', 'interface ethernet enable ether', 'interface ethernet set ether1 comment=', 'interface bridge add name=', 'interface bridge print', 'interface bridge port add bridge= interface=', 'interface bridge port remove bridge= interface=', 'interface bridge remove name=', 'interface bridge set stp=', 'interface bridge stp print', 'interface vlan add name= vlan-id= interface=', 'interface vlan remove name=', 'interface vlan print', 'routing rip network add network=', 'routing ospf network add network=', 'routing ospf neighbor print', 'routing rip neighbor print', 'ip pool add name= ranges=', 'ip pool print', 'ip dhcp-server add name= interface= address-pool=', 'ip dhcp-server network add address= gateway= dns-server=', 'ip dhcp-server lease print', 'ip dhcp-server print', 'ip dhcp-client add interface=', 'ip dhcp-client print', 'ip dhcp-client renew', 'ip dhcp-client release', 'ip dns static add name= address=', 'ip dns static print', 'ip firewall filter add chain=forward action=drop', 'ip firewall filter print', 'ip firewall address-list add list= address=', 'ip firewall address-list print', 'ip firewall nat add chain=srcnat action=masquerade out-interface=', 'ip firewall nat add chain=dstnat action=dst-nat to-addresses=', 'ipv6 address add address= interface=', 'ipv6 address print', 'ipv6 route add dst-address= gateway=', 'ipv6 route print', 'system identity set name=', 'system identity print', 'system resource print', 'system clock print', 'system reboot', 'user print', 'user add name= group=', 'user remove name=', 'log print', 'ping ', 'ping count=', 'tool ping ', 'traceroute ', 'tool traceroute ', 'interface wireless set wlan1 ssid= password= mode=ap-bridge', 'interface wireless print', 'queue simple add name= target= max-limit=2M/5M', 'queue simple print', 'queue tree add name= parent=global max-limit=2M/5M', 'queue tree print', 'queue type add name=pcq-down kind=pcq pcq-rate=5M pcq-classifier=dst-address', 'queue type print', 'tool bandwidth-test address=', 'speedtest '],
  switch: ['help', 'help vlan', 'export', 'vlan access port= id=', 'vlan trunk port= ids=', 'vlan remove port=ether1', 'vlan print', 'interface print', 'interface print detail', 'interface ethernet print', 'interface ethernet disable ether', 'interface ethernet enable ether', 'interface bridge vlan add vlan-ids= interface=', 'interface bridge set stp=yes', 'interface bridge stp print', 'system identity set name=', 'system identity print', 'system resource print', 'system clock print', 'log print'],
  host: ['help', 'help ip', 'help wifi', 'export', 'ipconfig', 'ipconfig /all', 'ipconfig /renew', 'ping ', 'ping -n ', 'tracert ', 'nslookup ', 'netstat', 'netstat -r', 'arp -a', 'route print', 'route add 0.0.0.0 mask 0.0.0.0 ', 'hostname', 'getmac', 'systeminfo', 'netsh wlan show interfaces', 'netsh wlan connect name=', 'cls', 'echo ', 'ip address add address= interface=', 'ip address print', 'ip address remove', 'ip route add dst-address= gateway=', 'ip route print', 'ip route remove', 'ip dns set servers=', 'ip dns remove', 'ip ', 'dhcp', 'traceroute ', 'speedtest ', 'ipv6 address add address= interface=', 'ipv6 route add dst-address= gateway=', 'wifi scan', 'wifi connect ssid= password=', 'wifi status']
}

export const CMDS_HOST_TYPES = ['pc', 'server', 'laptop']

export const kindOf = d => d.type === 'router' ? 'router' : d.type === 'switch' ? 'switch' : 'host'
export const promptOf = d => d.type === 'router' ? `[admin@${d.name}] > ` : d.type === 'switch' ? `${d.name}# ` : `${d.name}> `
export const LABEL_OF = { router: 'Router', switch: 'Switch', pc: 'PC', server: 'Server', laptop: 'Laptop' }
