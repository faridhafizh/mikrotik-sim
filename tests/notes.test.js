import { describe, it, expect } from 'vitest'
import { validateTopo } from '../src/stores/net.js'

const base = () => ({ devices: {}, links: [] })
const note = () => ({ id: 'z1', title: 'Ruang Server', x: 0, y: 0, w: 200, h: 120, color: '#ffbf47' })

describe('validateTopo notes', () => {
  it('menerima topologi dengan note valid', () => {
    expect(validateTopo({ ...base(), notes: { z1: note() } })).toBe(true)
  })
  it('judul 61 karakter ditolak', () => {
    const z = { ...note(), title: 'x'.repeat(61) }
    expect(validateTopo({ ...base(), notes: { z1: z } })).toBe(false)
  })
  it('warna di luar palet ditolak', () => {
    const z = { ...note(), color: '#ff0000' }
    expect(validateTopo({ ...base(), notes: { z1: z } })).toBe(false)
  })
  it('31 note ditolak', () => {
    const notes = {}
    for (let i = 1; i <= 31; i++) notes['z' + i] = { ...note(), id: 'z' + i }
    expect(validateTopo({ ...base(), notes })).toBe(false)
  })
  it('topologi lama tanpa notes tetap valid', () => {
    expect(validateTopo(base())).toBe(true)
  })
})
