import { describe, it, expect } from 'vitest'
import { classify, relTime, trunc, ERROR_PREFIXES } from '../src/fmt.js'

describe('classify', () => {
  it('echo: baris yang diketik pengguna', () => {
    expect(classify('> ip address print')).toBe('echo')
  })
  it('head: header tabel dari engine', () => {
    expect(classify('#  ADDRESS           INTERFACE')).toBe('head')
    expect(classify('    DST-ADDRESS        GATEWAY')).toBe('head')
  })
  it('hint: petunjuk sintaks', () => {
    expect(classify('perintah: vlan access port=ether1 id=10 | vlan print')).toBe('hint')
  })
  it('error: kegagalan engine', () => {
    for (const l of [
      'failure: port tidak ada',
      'bad command name foo (line 1 column 1)',
      'dns: tidak bisa resolve lab.local',
      'dhcp: pool habis',
      'tidak terhubung ke Wi-Fi',
      'di luar jangkauan: dekatkan laptop ke AP',
      'autentikasi gagal: password salah',
      'wlan1 belum dikonfigurasi',
      '4 sent, 0 received, 100% loss',
      '* tujuan tidak terjangkau'
    ]) expect(classify(l), l).toBe('error')
  })
  it('ok: hasil sukses', () => {
    for (const l of ['reply from 192.168.1.2 seq=0 ttl=64 time=1ms', '4 sent, 4 received, 0% loss', 'tx: 2.0 Mbps', 'ok', '0  ether1   running']) expect(classify(l), l).toBe('ok')
  })
  it('dim: tautan mati', () => {
    expect(classify('1  ether2   no link')).toBe('dim')
  })
  it('netral: baris informasi tanpa status', () => {
    expect(classify('traceroute ke 10.0.0.10')).toBe('')
    expect(classify('wlan1 ssid=LabWiFi wpa2 klien=1')).toBe('')
  })
  it('daftar prefix error tidak kosong dan semuanya terklasifikasi error', () => {
    expect(ERROR_PREFIXES.length).toBeGreaterThan(0)
    for (const p of ERROR_PREFIXES) expect(classify(p + 'x'), p).toBe('error')
  })
})

describe('relTime', () => {
  const t = Date.parse('2026-10-07T10:00:00Z')
  it('menit / jam / hari', () => {
    expect(relTime('2026-10-07 10:00:00', Date.parse('2026-10-07T10:05:00Z'))).toBe('5 menit lalu')
    expect(relTime('2026-10-07 10:00:00', Date.parse('2026-10-07T12:00:00Z'))).toBe('2 jam lalu')
    expect(relTime('2026-10-07 10:00:00', Date.parse('2026-10-10T10:00:00Z'))).toBe('3 hari lalu')
  })
  it('kurang dari satu menit', () => { expect(relTime('2026-10-07 10:00:00', Date.parse('2026-10-07T10:00:30Z'))).toBe('baru saja') })
  it('stempel waktu tak terparse', () => { expect(relTime('bukan-tanggal', t)).toBe(''); expect(relTime(null, t)).toBe('') })
})

describe('trunc', () => {
  it('memotong ke panjang maksimum dengan elipsis', () => { expect(trunc('PC-Kantor-Lantai-2', 14)).toBe('PC-Kantor-Lan…') })
  it('tidak mengubah string pendek', () => { expect(trunc('R1', 14)).toBe('R1') })
})
