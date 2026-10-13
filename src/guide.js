// Konten mode pemula: tur singkat + daftar perintah aman.
// Dipakai bersama oleh GuidedTour.vue, CommandPalette.vue, dan DeviceInspector.vue.

export const GUIDE_STEPS = [
  { id: 'add', title: 'Tambah perangkat', body: 'Klik ikon Router, Switch, atau PC di rail kiri untuk menambahkannya ke kanvas. Di ponsel, rail jadi bar horizontal yang bisa digeser.', anchor: 'add' },
  { id: 'link', title: 'Hubungkan kabel', body: 'Pilih alat Hubungkan, lalu klik dua perangkat. Dialog akan menanyakan port dan jenis kabel — biarkan default bila ragu.', anchor: 'link' },
  { id: 'ip', title: 'Beri alamat IP', body: 'Pilih perangkat, klik Buka terminal. Contoh aman: /ip address add address=192.168.1.1/24 interface=ether1', anchor: 'terminal' },
  { id: 'ping', title: 'Uji koneksi', body: 'Ketik /ping 192.168.1.10 dari satu perangkat. Paket akan meluncur di kanvas bila jalur nyambung.', anchor: 'terminal' },
  { id: 'lab', title: 'Kerjakan lab', body: 'Buka panel Lab untuk latihan bertahap. Panel menampilkan langkah, petunjuk, dan pemeriksaan otomatis.', anchor: null }
]

// Perintah aman: hanya lihat (print/help) atau langkah dasar (IP, ping, dhcp-client).
// Perintah lanjutan (bridge, vlan, rip, ospf, queue, firewall) sengaja disembunyikan di mode pemula.
const SAFE = new Set([
  'help', 'help ip', 'help dhcp', 'help wireless', 'help vlan', 'help wifi',
  'ip address add address= interface=', 'ip address print', 'ip address remove interface=',
  'ip route add dst-address= gateway=', 'ip route print', 'ip route remove dst-address=',
  'dhcp', 'ipconfig', 'interface print', 'ping ', 'traceroute ', 'export',
  'ip dhcp-client add interface=', 'ip dhcp-client print', 'ip dhcp-client renew', 'ip dhcp-client release',
  'wifi scan', 'wifi connect ssid= password=', 'wifi status', 'nslookup ',
  'system identity set name='
])

// true bila perintah boleh tampil di mode pemula (palet perintah).
// Entri berakhir spasi (mis. 'ping ') cocok juga sebagai prefiks: 'ping 10.0.0.1'.
export function isSafeCmd(cmd) {
  const c = String(cmd || '').replace(/^\//, '').trim()
  if (SAFE.has(c)) return true
  for (const s of SAFE) if (s.endsWith(' ') && c.startsWith(s)) return true
  return false
}
