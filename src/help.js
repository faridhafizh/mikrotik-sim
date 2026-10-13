// Katalog bantuan terminal: satu-satunya sumber data untuk dialog Bantuan,
// perintah `help` di terminal, dan tab-completion. Setiap entri menandai
// seberapa mirip sintaksnya dengan RouterOS asli.
export const FIDELITY = {
  asli: { tag: 'ASLI', desc: 'sintaks sama dengan RouterOS' },
  mirip: { tag: 'MIRIP', desc: 'mirip RouterOS, struktur disederhanakan' },
  sim: { tag: 'SIM', desc: 'khusus simulator (tidak ada di RouterOS)' }
}

export const HELP = [
  // Router
  { scope: 'router', group: 'Alamat IP', cmd: 'ip address add address=<cidr> interface=<iface>', example: 'ip address add address=192.168.1.1/24 interface=ether1', fidelity: 'asli', desc: 'Beri alamat IP ke interface router.' },
  { scope: 'router', group: 'Alamat IP', cmd: 'ip address print', fidelity: 'asli', desc: 'Lihat semua alamat IP.' },
  { scope: 'router', group: 'Routing', cmd: 'ip route add dst-address=<net/len> gateway=<ip>', example: 'ip route add dst-address=0.0.0.0/0 gateway=10.0.0.2', fidelity: 'asli', desc: 'Tambah rute statis, dst-address=0.0.0.0/0 untuk default.' },
  { scope: 'router', group: 'Routing', cmd: 'ip route print', fidelity: 'asli', desc: 'Lihat rute statis + rute dinamis (R/O).' },
  { scope: 'router', group: 'Routing', cmd: 'routing ospf network add network=<net/len>', example: 'routing ospf network add network=192.168.1.0/24', fidelity: 'asli', desc: 'Ikutkan jaringan ke OSPF (cost 10/link, AD 110).' },
  { scope: 'router', group: 'Routing', cmd: 'routing rip network add network=<net/len>', fidelity: 'asli', desc: 'Ikutkan jaringan ke RIP (maks 15 hop, AD 120).' },
  { scope: 'router', group: 'DHCP', cmd: 'ip pool add name=<nama> ranges=<ipAwal>-<ipAkhir>', example: 'ip pool add name=pool1 ranges=192.168.1.10-192.168.1.50', fidelity: 'asli', desc: 'Buat pool alamat untuk klien DHCP.' },
  { scope: 'router', group: 'DHCP', cmd: 'ip dhcp-server add name=<nama> interface=<iface> address-pool=<pool>', fidelity: 'asli', desc: 'Nyalakan server DHCP di sebuah interface.' },
  { scope: 'router', group: 'DHCP', cmd: 'ip dhcp-server network add address=<net/len> gateway=<ip> dns-server=<ip>', fidelity: 'asli', desc: 'Tentukan gateway & DNS yang dibagikan ke klien.' },
  { scope: 'router', group: 'DHCP', cmd: 'ip dhcp-server lease print', fidelity: 'asli', desc: 'Lihat klien yang sudah mendapat IP.' },
  { scope: 'router', group: 'DNS', cmd: 'ip dns static add name=<host> address=<ip>', example: 'ip dns static add name=web.lan address=10.0.0.10', fidelity: 'asli', desc: 'Catatan DNS statis agar nama bisa di-ping.' },
  { scope: 'router', group: 'DNS', cmd: 'ip dns static print', fidelity: 'asli', desc: 'Lihat catatan DNS statis.' },
  { scope: 'router', group: 'Wireless', cmd: 'interface wireless set wlan1 ssid=<nama> password=<sandi> mode=ap-bridge|station', fidelity: 'asli', desc: 'mode=ap-bridge memancarkan Wi-Fi, mode=station jadi klien AP.' },
  { scope: 'router', group: 'Wireless', cmd: 'interface wireless print', fidelity: 'asli', desc: 'Lihat status Wi-Fi dan jumlah klien.' },
  { scope: 'router', group: 'Queue', cmd: 'queue simple add name=<nama> target=<net/len> max-limit=<up>/<down>', example: 'queue simple add name=q1 target=192.168.1.0/24 max-limit=2M/5M', fidelity: 'asli', desc: 'Batasi bandwidth upload/download (contoh 2M/5M).' },
  { scope: 'router', group: 'Queue', cmd: 'queue tree add name=<nama> parent=global max-limit=<up>/<down> [queue=<pcq>]', fidelity: 'mirip', desc: 'Batas arah (hanya parent global). Tambah queue= untuk PCQ.' },
  { scope: 'router', group: 'Queue', cmd: 'queue type add name=<nama> kind=pcq pcq-rate=<rate> pcq-classifier=<src|dst|both>', fidelity: 'asli', desc: 'PCQ membagi bandwidth adil per klien.' },
  { scope: 'router', group: 'Queue', cmd: 'queue simple print | queue tree print | queue type print', fidelity: 'asli', desc: 'Lihat daftar queue.' },
  { scope: 'router', group: 'Firewall/NAT', cmd: 'ip firewall filter add chain=input|forward action=accept|drop [src-address=] [dst-address=] [protocol=tcp|udp|icmp] [dst-port=]', fidelity: 'asli', desc: 'Aturan firewall; chain=input = ke router, chain=forward = lewat router.' },
  { scope: 'router', group: 'Firewall/NAT', cmd: 'ip firewall nat add chain=srcnat action=masquerade out-interface=<iface>', fidelity: 'asli', desc: 'NAT keluar (masquerade) ke internet.' },
  { scope: 'router', group: 'Firewall/NAT', cmd: 'ip firewall nat add chain=dstnat action=dst-nat to-addresses=<ip> [to-ports=] [protocol=tcp|udp] [dst-port=] [in-interface=]', example: 'ip firewall nat add chain=dstnat action=dst-nat to-addresses=10.0.0.10 protocol=tcp dst-port=80 to-ports=80', fidelity: 'asli', desc: 'Port-forward ke server internal. action=redirect meneruskan ke IP router sendiri.' },
  { scope: 'router', group: 'IPv6', cmd: 'ipv6 address add address=<cidr6> interface=<iface>', example: 'ipv6 address add address=2001:db8:1::1/64 interface=ether1', fidelity: 'sim', ros: '/ipv6 address add', desc: 'Set alamat IPv6 di interface.' },
  { scope: 'router', group: 'IPv6', cmd: 'ipv6 route add dst-address=<cidr6|::/0> gateway=<ip6>', example: 'ipv6 route add dst-address=::/0 gateway=2001:db8:1::2', fidelity: 'sim', ros: '/ipv6 route add', desc: 'Rute statis IPv6; ::/0 = default.' },
  { scope: 'router', group: 'IPv6', cmd: 'ping <ip6|nama> | traceroute <ip6|nama>', example: 'ping 2001:db8:2::2', fidelity: 'sim', desc: 'Jalankan ping/traceroute IPv6 (alamat mengandung :).' },
  { scope: 'router', group: 'Bridge/VLAN', cmd: 'interface bridge add name=<nama>', fidelity: 'asli', desc: 'Buat bridge untuk menggabung beberapa port.' },
  { scope: 'router', group: 'Bridge/VLAN', cmd: 'interface bridge port add bridge=<nama> interface=<iface>', fidelity: 'asli', desc: 'Masukkan interface ke bridge.' },
  { scope: 'router', group: 'Bridge/VLAN', cmd: 'interface vlan add name=<nama> vlan-id=<id> interface=<iface>', fidelity: 'asli', desc: 'Subinterface VLAN pada port fisik.' },
  { scope: 'router', group: 'Lain', cmd: 'interface print', fidelity: 'asli', desc: 'Daftar interface + status kabel (running/no link).' },
  { scope: 'router', group: 'Lain', cmd: 'system identity set name=<nama>', fidelity: 'asli', desc: 'Ubah nama perangkat.' },
  { scope: 'router', group: 'Lain', cmd: 'ping <ip|nama>', fidelity: 'asli', desc: 'Uji konektivitas (4 paket).' },
  { scope: 'router', group: 'Lain', cmd: 'traceroute <ip|nama>', fidelity: 'asli', desc: 'Jejak hop menuju tujuan.' },
  { scope: 'router', group: 'Lain', cmd: 'tool bandwidth-test address=<ip>', fidelity: 'asli', desc: 'Uji kecepatan (tx/rx Mbps). Bisa juga ketik: speedtest <ip>.' },
  { scope: 'router', group: 'Hapus entri', cmd: 'ip address remove numbers=<n> | interface=<iface>', fidelity: 'asli', desc: 'Hapus alamat IP dari interface.' },
  { scope: 'router', group: 'Hapus entri', cmd: 'ip route remove numbers=<n> | dst-address=<net/len>', fidelity: 'asli', desc: 'Hapus rute statis (index dari ip route print).' },
  { scope: 'router', group: 'Hapus entri', cmd: 'ip pool remove name= / ip dhcp-server remove name= / ip dhcp-server network remove address= / ip dns static remove name= / queue simple remove name= / ip firewall filter remove numbers= / ip firewall nat remove numbers=', fidelity: 'asli', desc: 'Hapus entri sesuai nama/address/interface/chain, atau numbers=<n>.' },
  { scope: 'router', group: 'DHCP client', cmd: 'ip dhcp-client add interface=<iface>', fidelity: 'asli', desc: 'Pasang client DHCP di interface (pinjam IP dari server di segmen yang sama).' },
  { scope: 'router', group: 'DHCP client', cmd: 'ip dhcp-client print | renew | release | remove', fidelity: 'asli', desc: 'Lihat/perbarui/lepaskan/hapus sewa DHCP client.' },
  { scope: 'router', group: 'Ekspor', cmd: 'export', fidelity: 'asli', desc: 'Cetak seluruh konfigurasi perangkat sebagai skrip siap tempel.' },
  { scope: 'router', group: 'Interface', cmd: 'interface print [detail] | interface ethernet print', example: 'interface print detail', fidelity: 'asli', desc: 'Daftar interface: status running/no link/disabled, MAC simulasi, dan komentar (detail).' },
  { scope: 'router', group: 'Interface', cmd: 'interface ethernet disable|enable [<iface>...]', example: 'interface ethernet disable ether2', fidelity: 'asli', desc: 'Matikan/nyalakan port. Port disabled membuat link DOWN seperti Dicatat pada kabel.' },
  { scope: 'router', group: 'Interface', cmd: 'interface ethernet set <iface> [disabled=yes|no] [comment=<teks>]', example: 'interface ethernet set ether1 comment=uplink ISP', fidelity: 'asli', desc: 'Ubah status dan komentar port.' },
  { scope: 'router', group: 'Interface', cmd: 'interface ethernet monitor <iface> | interface monitor-traffic <iface>', fidelity: 'mirip', desc: 'Status satu port + line-rate. Simulator hanya bisa satu snapshot, tidak ada penghitung waktu nyata.' },
  { scope: 'router', group: 'Interface', cmd: 'interface bridge print | interface bridge port print | interface vlan print', fidelity: 'asli', desc: 'Daftar bridge, portnya, dan subinterface VLAN.' },
  { scope: 'router', group: 'Interface', cmd: 'interface wireless scan', fidelity: 'sim', ros: '/interface wireless scan', desc: 'Pindai AP lain di sekitar perangkat.' },
  { scope: 'router', group: 'ARP/Neighbor', cmd: 'ip arp print | ip arp remove numbers=<n>|address=<ip>', fidelity: 'asli', desc: 'Tabel ARP dari tetangga L2 yang terjangkau; remove menyembunyikan entri.' },
  { scope: 'router', group: 'ARP/Neighbor', cmd: 'ip neighbor print', fidelity: 'asli', ros: '/ip/neighbor print', desc: 'Tabel ARP versi RouterOS 7 (tambah kolom identitas).' },
  { scope: 'router', group: 'DNS', cmd: 'ip dns print | ip dns set servers=<ip,...> | ip dns flush', example: 'ip dns set servers=8.8.8.8,1.1.1.1', fidelity: 'asli', desc: 'Lihat/ubah server DNS perangkat dan flush cache.' },
  { scope: 'router', group: 'Layanan', cmd: 'ip service print | ip service set <n> disabled=yes|no', example: 'ip service set 2 disabled=yes', fidelity: 'asli', desc: 'Daftar layanan bawaan (www, ssh, api, winbox, dst.) dan statusnya.' },
  { scope: 'router', group: 'Sistem', cmd: 'system resource print', fidelity: 'asli', desc: 'Uptime, versi, cpu-load, dan memori (angka simulasi).' },
  { scope: 'router', group: 'Sistem', cmd: 'system clock print | system clock set date=<YYYY-MM-DD> time=<HH:MM:SS>', fidelity: 'asli', desc: 'Jam perangkat. Set hanya menggeser tampilan; simulasi tidak memakai jam.' },
  { scope: 'router', group: 'Sistem', cmd: 'system reboot', fidelity: 'asli', desc: 'Simulasi restart: konfigurasi tetap, terminal direset, entri log ditambah.' },
  { scope: 'router', group: 'Sistem', cmd: 'user print | user add name=<n> group=full|read|write | user remove name=<n>', example: 'user add name=operator group=read', fidelity: 'asli', desc: 'Kelola user lokal perangkat (default: admin/full).' },
  { scope: 'router', group: 'Log', cmd: 'log print', fidelity: 'asli', desc: '50 entri log terakhir (perubahan identity, interface, route, user, DHCP).' },
  { scope: 'router', group: 'Firewall/NAT', cmd: 'ip firewall address-list add list=<n> address=<ip|net/len> | print | remove', example: 'ip firewall address-list add list=blokir address=10.0.0.5', fidelity: 'asli', desc: 'Daftar alamat untuk filter/NAT (disimpan, belum dipakai mengetuk paket).' },
  { scope: 'router', group: 'Firewall/NAT', cmd: 'ip firewall mangle print/add | ip firewall connection print', fidelity: 'asli', desc: 'Sintaks dikenali; print kosong karena simulator tidak memodelkan mangle/connection tracking.' },
  { scope: 'router', group: 'Routing', cmd: 'routing ospf neighbor print | routing rip neighbor print', fidelity: 'asli', desc: 'Tetangga dinamis yang-formed adjacency Full (metric 10 OSPF / 1 RIP).' },
  { scope: 'router', group: 'DHCP', cmd: 'ip dhcp-server lease print [detail] | ip pool print | ip dhcp-server print | ip dhcp-server network print', fidelity: 'asli', desc: 'Tabel pool, network, server DHCP, dan lease yang clients.' },
  { scope: 'router', group: 'Tes', cmd: 'tool ping <ip> [count=<n>] [size=<byte>] | tool traceroute <ip>', example: 'tool ping 10.0.0.10 count=5 size=32', fidelity: 'asli', desc: 'Alias RouterOS dari ping/traceroute; count dan size bisa diatur.' },
  { scope: 'router', group: 'Lain', cmd: 'ip route print count-only | ip address print count-only | ip firewall filter print count-only', fidelity: 'asli', desc: 'Jumlah entri saja, tanpa tabel.' },
  // Switch
  { scope: 'switch', group: 'VLAN', cmd: 'vlan access port=<iface> id=<vlan>', example: 'vlan access port=ether1 id=10', fidelity: 'mirip', ros: '/interface bridge port + /interface bridge vlan', desc: 'Port mode access di satu VLAN (PVID).' },
  { scope: 'switch', group: 'VLAN', cmd: 'vlan trunk port=<iface> ids=10,20', fidelity: 'mirip', ros: '/interface bridge vlan tagged=', desc: 'Port trunk membawa beberapa VLAN.' },
  { scope: 'switch', group: 'VLAN', cmd: 'vlan remove port=<iface>', fidelity: 'mirip', desc: 'Kembalikan port ke access VLAN 1.' },
  { scope: 'switch', group: 'VLAN', cmd: 'vlan print', fidelity: 'mirip', desc: 'Lihat konfigurasi VLAN tiap port.' },
  { scope: 'switch', group: 'VLAN', cmd: 'interface bridge vlan add vlan-ids=<id> interface=<iface>', fidelity: 'asli', desc: 'Bentuk RouterOS untuk vlan access (satu VLAN).' },
  { scope: 'switch', group: 'VLAN', cmd: 'interface bridge set stp=yes|no', example: 'interface bridge set stp=yes', fidelity: 'mirip', ros: '/interface bridge set stp=yes', desc: 'RSTP sederhana: port redundant pada loop di-block otomatis bila stp=yes.' },
  { scope: 'switch', group: 'VLAN', cmd: 'interface bridge stp print', fidelity: 'mirip', desc: 'Lihat status STP dan port yang sedang di-block.' },
  { scope: 'switch', group: 'Lain', cmd: 'interface print', fidelity: 'asli', desc: 'Daftar port + status kabel.' },
  { scope: 'switch', group: 'Lain', cmd: 'system identity set name=<nama>', fidelity: 'asli', desc: 'Ubah nama perangkat.' },
  { scope: 'switch', group: 'Lain', cmd: 'interface print [detail] | interface ethernet print', fidelity: 'asli', desc: 'Daftar port + status (running/no link/disabled) dan MAC simulasi.' },
  { scope: 'switch', group: 'Lain', cmd: 'interface ethernet disable|enable [<port>...] | interface ethernet set <port> comment=<teks>', example: 'interface ethernet disable ether5', fidelity: 'asli', desc: 'Matikan/nyalakan port switch. Port disabled tidak ikut STP.' },
  { scope: 'switch', group: 'Lain', cmd: 'system identity print | system resource print | system clock print | log print', fidelity: 'asli', desc: 'Informasi sistem switch (angka simulasi) dan log perubahan.' },
  { scope: 'switch', group: 'Hapus entri', cmd: 'vlan remove port=<iface>', fidelity: 'mirip', desc: 'Kembalikan port ke access VLAN 1.' },
  { scope: 'switch', group: 'Ekspor', cmd: 'export', fidelity: 'asli', desc: 'Cetak konfigurasi VLAN per port sebagai skrip.' },
  // Host (PC/Server/Laptop)
  { scope: 'host', group: 'Windows CMD', cmd: 'ipconfig [/all] [/renew] [/release]', example: 'ipconfig /all', fidelity: 'mirip', ros: 'netsh interface ip show config', desc: 'Konfigurasi IP gaya Windows. /all menambah MAC, DHCP, adapter; /renew dan /release menawar ulang DHCP.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'ping [-n <jumlah>] [-l <ukuran>] <ip>', example: 'ping -n 4 10.0.0.10', fidelity: 'mirip', ros: 'ping (cmd.exe)', desc: 'Ping gaya Windows; jumlah dan ukuran paket bisa diatur.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'tracert <ip>', example: 'tracert 10.0.0.10', fidelity: 'mirip', ros: 'tracert (cmd.exe)', desc: 'Jejak hop gaya Windows. Hanya perlu jalur pergi, balas balik tidak wajib.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'nslookup <nama> [server]', example: 'nslookup web 192.168.1.1', fidelity: 'mirip', desc: 'Resolusi nama gaya Windows lengkap dengan blok Server/Address.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'arp -a | arp -d <ip>', fidelity: 'mirip', ros: 'arp (cmd.exe)', desc: 'Tabel ARP gaya Windows per interface; -d menyembunyikan entri.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'route print | route add <tujuan> mask <masker> <gateway> | route delete <tujuan>', example: 'route add 0.0.0.0 mask 0.0.0.0 192.168.1.1', fidelity: 'mirip', ros: 'route print (cmd.exe)', desc: 'Tabel rute aktif gaya Windows plus tambah/hapus rute (masker desimal).' },
  { scope: 'host', group: 'Windows CMD', cmd: 'netstat [-a|-n|-r]', fidelity: 'mirip', ros: 'netstat (cmd.exe)', desc: 'Tetangga L2 sebagai "Active Connections"; -r sama dengan route print.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'getmac | hostname | systeminfo | ver | whoami', fidelity: 'mirip', desc: 'Info adapter MAC, nama host, rincian sistem, versi, dan user aktif.' },
  { scope: 'host', group: 'Windows CMD', cmd: 'netsh wlan show interfaces | netsh wlan connect name=<ssid> | netsh wlan disconnect', example: 'netsh wlan connect name=LabWiFi', fidelity: 'mirip', desc: 'Kelola Wi-Fi laptop gaya Windows (padanan wifi scan/connect/status).' },
  { scope: 'host', group: 'Windows CMD', cmd: 'cls | clear | echo <teks> | ?', fidelity: 'mirip', desc: 'Bersihkan layar, cetak teks, atau tampilkan daftar perintah CMD.' },
  { scope: 'host', group: 'Konfigurasi IP', cmd: 'ip address add address=<cidr> interface=<iface>', example: 'ip address add address=192.168.1.10/24 interface=eth0', fidelity: 'asli', desc: 'Set IP statis (interface eth0, wlan0).' },
  { scope: 'host', group: 'Konfigurasi IP', cmd: 'ip route add dst-address=0.0.0.0/0 gateway=<ip>', fidelity: 'asli', desc: 'Set gateway default.' },
  { scope: 'host', group: 'Konfigurasi IP', cmd: 'ip dns set servers=<ip>', fidelity: 'asli', desc: 'Set DNS server.' },
  { scope: 'host', group: 'Konfigurasi IP', cmd: 'ip <addr/len> [gw] [dns]', example: 'ip 192.168.1.10/24 192.168.1.1 8.8.8.8', fidelity: 'sim', desc: 'Cara cepat satu-baris (jalan pintas simulator; di RouterOS pakai 3 perintah di atas).' },
  { scope: 'host', group: 'Konfigurasi IP', cmd: 'dhcp', fidelity: 'sim', ros: '/ip dhcp-client renew', desc: 'Minta IP dari DHCP server di segmen ini.' },
  { scope: 'host', group: 'IPv6', cmd: 'ipv6 address add address=<cidr6> interface=<eth0|wlan0>', example: 'ipv6 address add address=2001:db8:1::1/64 interface=eth0', fidelity: 'sim', ros: '/ipv6 address add', desc: 'Set alamat IPv6.' },
  { scope: 'host', group: 'IPv6', cmd: 'ipv6 route add dst-address=<cidr6|::/0> gateway=<ip6>', example: 'ipv6 route add dst-address=::/0 gateway=2001:db8:1::1', fidelity: 'sim', ros: '/ipv6 route add', desc: 'Rute statis IPv6; ::/0 = default.' },
  { scope: 'host', group: 'IPv6', cmd: 'ping <ip6|nama> | traceroute <ip6|nama>', example: 'ping 2001:db8::2', fidelity: 'sim', desc: 'Ping/traceroute IPv6 (alamat mengandung :).' },
  { scope: 'host', group: 'Konfigurasi IP', cmd: 'ipconfig', fidelity: 'sim', desc: 'Lihat konfigurasi IP saat ini (alias: ip address print).' },
  { scope: 'host', group: 'Wi-Fi (laptop)', cmd: 'wifi scan', fidelity: 'sim', ros: '/interface wireless scan', desc: 'Pindai jaringan sekitar.' },
  { scope: 'host', group: 'Wi-Fi (laptop)', cmd: 'wifi connect ssid=<nama> password=<sandi>', fidelity: 'sim', ros: '/interface wireless connect', desc: 'Hubungkan ke AP dengan SSID & password sama.' },
  { scope: 'host', group: 'Wi-Fi (laptop)', cmd: 'wifi status', fidelity: 'sim', desc: 'Lihat status koneksi Wi-Fi.' },
  { scope: 'host', group: 'Tes', cmd: 'ping <ip|nama>', fidelity: 'asli', desc: 'Uji konektivitas.' },
  { scope: 'host', group: 'Tes', cmd: 'traceroute <ip|nama>', fidelity: 'asli', desc: 'Jejak hop.' },
  { scope: 'host', group: 'Tes', cmd: 'nslookup <nama>', fidelity: 'asli', desc: 'Resolusi nama ke IP.' },
  { scope: 'host', group: 'Tes', cmd: 'speedtest <ip>', fidelity: 'sim', ros: '/tool bandwidth-test', desc: 'Uji kecepatan tx/rx.' },
  { scope: 'host', group: 'Hapus entri', cmd: 'ip address remove | ip route remove | ip dns remove', fidelity: 'sim', desc: 'Kosongkan alamat/gateway/DNS konfigurasi saat ini.' },
  { scope: 'host', group: 'Ekspor', cmd: 'export', fidelity: 'asli', desc: 'Cetak konfigurasi host sebagai skrip.' }
]

const GROUPS_ORDER = []
for (const h of HELP) if (!GROUPS_ORDER.includes(h.group)) GROUPS_ORDER.push(h.group)

export function helpIndex(scope) {
  const rows = HELP.filter(h => h.scope === scope)
  const out = [`Perintah untuk perangkat ini. Ketik 'help <topik>' (mis. help dhcp) untuk detail.`, '']
  for (const g of GROUPS_ORDER) {
    const items = rows.filter(h => h.group === g)
    if (!items.length) continue
    out.push(g + ':', ...items.map(h => `  ${h.cmd.split(' ').slice(0, 3).join(' ').replace(/[=<|].*/, '').trim()}  — ${h.desc.split('.')[0]}`), '')
  }
  out.push("Topik: " + [...new Set(rows.map(h => h.group.toLowerCase()))].join(', '))
  return out
}

export function helpTopic(scope, q) {
  const qq = (q || '').toLowerCase().trim()
  const hit = HELP.filter(h => (h.scope === scope || h.scope === 'all') &&
    (h.group.toLowerCase() === qq || h.group.toLowerCase().startsWith(qq) || h.group.toLowerCase().includes(qq) || h.cmd.toLowerCase().includes(qq)))
  if (!hit.length) {
    const other = HELP.filter(h => h.scope !== scope && (h.group.toLowerCase().includes(qq) || h.cmd.toLowerCase().includes(qq)))
    if (other.length) return [`'${q}' ada di perangkat lain (${[...new Set(other.map(h => h.scope))].join(', ')}). Coba di perangkat jenis itu.`]
    return [`Topik '${q}' tidak ditemukan. Ketik 'help' untuk daftar topik.`]
  }
  const out = []
  for (const h of hit) {
    out.push(`${h.cmd}  [${FIDELITY[h.fidelity].tag}]`, `  ${h.desc}`)
    if (h.example) out.push(`  contoh: ${h.example}`)
    if (h.ros) out.push(`  RouterOS: ${h.ros}`)
    out.push('')
  }
  return out
}
