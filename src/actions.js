import { useUi } from './stores/ui'
import { useNet } from './stores/net'

// Alur dialog perangkat yang dipakai bersama oleh ContextMenu, DeviceInspector, dan kanvas.
export async function confirmRemove(id) {
  const ui = useUi(), net = useNet(), d = net.devices[id]
  if (!d) return false
  const body = 'Perangkat ' + d.name + ' beserta semua kabelnya akan dihapus. Tindakan ini dapat diurungkan dengan Ctrl+Z.'
  if (!await ui.ask({ title: 'Hapus perangkat?', body, confirm: 'Hapus' })) return false
  net.remove(id)
  return true
}

export async function renameDevice(id) {
  const ui = useUi(), net = useNet(), d = net.devices[id]
  if (!d) return
  let value = d.name, error = ''
  for (;;) {
    const name = await ui.askText({ title: 'Ubah nama perangkat', label: 'Nama perangkat', value, max: 40, error })
    if (name === null) return
    value = name
    error = !name.trim()
      ? 'Nama tidak boleh kosong'
      : (Object.values(net.devices).some(x => x.id !== id && x.name === name) ? 'Nama sudah dipakai perangkat lain' : '')
    if (!error) { net.rename(id, name); return }
  }
}

export async function confirmRemoveNote(id) {
  const ui = useUi(), net = useNet(), d = net.notes[id]
  if (!d) return false
  const body = 'Catatan "' + (d.title || 'tanpa judul') + '" akan dihapus. Tindakan ini dapat diurungkan dengan Ctrl+Z.'
  if (!await ui.ask({ title: 'Hapus catatan?', body, confirm: 'Hapus' })) return false
  net.removeNote(id)
  return true
}

export async function renameNote(id) {
  const ui = useUi(), net = useNet(), d = net.notes[id]
  if (!d) return
  const title = await ui.askText({ title: 'Ubah judul catatan', label: 'Judul', value: d.title, max: 60 })
  if (title === null) return
  net.renameNote(id, title)
}

export function openTerminal(id) {
  const ui = useUi(), net = useNet()
  net.selected = id
  ui.focusTerminal()
}

export function openConfig(id) {
  const ui = useUi(), net = useNet()
  const d = net.devices[id]
  if (!d) return
  net.selected = id
  ui.openModal({ kind: 'config', title: 'Konfigurasi ' + d.name, devId: id })
}
