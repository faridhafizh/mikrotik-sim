// MAC simulasi: stabil dari id perangkat + nama interface.
// Bukan alamat perangkat keras nyata — hanya untuk kolom MAC di arp/interface print.
import { hex } from './num.js'

export const macOf = (devId, ifName) => {
  const s = String(devId || '') + '|' + String(ifName || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ['02', hex(h & 255, 2), hex((h >>> 8) & 255, 2), hex((h >>> 16) & 255, 2), hex((h >>> 24) & 255, 2), hex(h % 251, 2)].join(':')
}
