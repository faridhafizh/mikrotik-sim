<script setup>
import { MousePointer2, Cable, Trash2, CircleQuestionMark, LayoutTemplate, StickyNote } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { TYPES } from '../catalog'

const net = useNet(), ui = useUi()
const TOOLS = [
  { id: 'select', label: 'Pilih', Icon: MousePointer2 },
  { id: 'link', label: 'Hubungkan', Icon: Cable, title: 'Klik dua perangkat untuk menghubungkan' },
  { id: 'remove', label: 'Hapus perangkat', Icon: Trash2, danger: true },
  { id: 'note', label: 'Catatan', Icon: StickyNote, title: 'Tarik kotak di kanvas kosong untuk anotasi' }
]
function tool(t) {
  if (t.id === 'remove' && !net.selected) return
  net.from = null
  net.tool = t.id
  if (t.id === 'note') { net.selected = null; net.selectedNote = null }
}
function help() { ui.openModal({ kind: 'help', title: 'Bantuan & pintasan' }) }
const item = 'flex flex-col items-center justify-center gap-1 w-[62px] lg:w-full px-1.5 py-1.5 hex-clip glass border text-2xs shrink-0'
</script>

<template>
  <nav class="shrink-0 flex flex-row lg:flex-col gap-2 p-2 bg-chrome border-b lg:border-b-0 lg:border-r border-line overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:min-h-0 rail-scroll h-14 lg:h-auto w-full lg:w-[76px]"
    aria-label="Perangkat dan alat">
    <span class="hud-label text-dim shrink-0 self-center lg:self-start px-1">DEPLOY</span>

    <button v-for="t in TYPES" :key="t.id" :class="item + ' border-line text-muted hover:bg-panel-2! hover:text-fg'"
      draggable="true" :aria-label="'Tambah ' + t.label" :title="'Tarik ke kanvas atau klik untuk menambah ' + t.label"
      :data-guide="t.id === 'router' ? 'add' : undefined"
      @dragstart="e => e.dataTransfer.setData('t', t.id)"
      @click="net.add(t.id, 200 + Math.random() * 400, 120 + Math.random() * 200)">
      <component :is="t.Icon" :size="20" :color="t.color" />
      <span class="hidden lg:inline text-[11px] leading-tight text-center">{{ t.label }}</span>
    </button>

    <span class="w-px lg:w-full h-8 lg:h-px bg-line shrink-0" aria-hidden="true"></span>

    <span class="hud-label text-dim shrink-0 self-center lg:self-start px-1">TACTICS</span>

    <button v-for="t in TOOLS" :key="t.id" :class="[item, t.danger ? 'text-danger' : 'text-muted', net.tool === t.id ? 'border-accent suit-glow' : 'border-line hover:bg-panel-2! hover:text-fg']"
      :aria-pressed="t.id === 'remove' ? undefined : net.tool === t.id" :disabled="t.id === 'remove' && !net.selected"
      :aria-label="t.label" :data-guide="t.id === 'link' ? 'link' : undefined" :title="t.title || t.label" @click="tool(t)">
      <component :is="t.Icon" :size="20" />
      <span class="hidden lg:inline text-[11px] leading-tight text-center">{{ t.label }}</span>
    </button>

    <button :class="item + ' border-line text-muted hover:bg-panel-2! hover:text-fg'" aria-label="Template topologi" title="Template topologi" @click="ui.openMenu({ x: 76, y: window.innerHeight - 260, devId: null, templates: true })">
      <LayoutTemplate :size="20" />
      <span class="hidden lg:inline text-[11px]">Template</span>
    </button>

    <button :class="item + ' border-line text-muted hover:bg-panel-2! hover:text-fg lg:mt-auto'" aria-label="Bantuan" title="Bantuan" @click="help">
      <CircleQuestionMark :size="20" />
      <span class="hidden lg:inline text-[11px]">Bantuan</span>
    </button>
  </nav>
</template>
