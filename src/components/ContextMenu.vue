<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { Terminal, SquarePen, Trash2, SlidersHorizontal, ArrowUpToLine, ArrowDownToLine } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { TEMPLATES } from '../templates.js'
import { confirmRemove, renameDevice, openTerminal, openConfig, confirmRemoveNote, renameNote } from '../actions'
import { NOTE_COLORS } from '../zoom'

const ui = useUi()
const el = ref(null)

const pos = () => ({ left: Math.min(ui.menu?.x ?? 0, window.innerWidth - 220) + 'px', top: Math.min(ui.menu?.y ?? 0, window.innerHeight - 150) + 'px' })

watch(() => ui.menu, async m => {
  if (!m) return
  await nextTick()
  el.value?.querySelector('button')?.focus()
})

function close() { ui.closeMenu() }
function onDown(e) { if (el.value && !el.value.contains(e.target)) close() }

onMounted(() => {
  window.addEventListener('pointerdown', onDown)
  window.addEventListener('keydown', esc)
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', onDown)
  window.removeEventListener('keydown', esc)
})
function esc(e) { if (e.key === 'Escape' && ui.menu) { e.preventDefault(); close() } }

watch(() => ui.zoom, close)
watch(() => ui.pan, close, { deep: true })

async function rename() {
  const id = ui.menu.devId
  close()
  await renameDevice(id)
}
function terminal() { const id = ui.menu.devId; close(); openTerminal(id) }
function config() { const id = ui.menu.devId; close(); openConfig(id) }
async function del() {
  const id = ui.menu.devId
  close()
  await confirmRemove(id)
}
const net = useNet()
function applyTemplate(tid) { close(); net.applyTemplate(tid) }
const curNote = computed(() => net.notes[ui.menu?.noteId])
async function noteRename() { const id = ui.menu.noteId; close(); await renameNote(id) }
function noteColor(c) { net.setNoteColor(ui.menu.noteId, c) }
function noteFront() { net.noteToFront(ui.menu.noteId) }
function noteBack() { net.noteToBack(ui.menu.noteId) }
async function noteDel() { const id = ui.menu.noteId; close(); await confirmRemoveNote(id) }
</script>

<template>
  <div v-if="ui.menu" ref="el" role="menu" aria-label="Menu opsi"
    class="bg-chrome border border-line rounded-xl shadow-xl fixed z-50 w-[200px] py-1" :style="pos()">
    <template v-if="ui.menu.templates">
      <button v-for="t in TEMPLATES" :key="t.id" role="menuitem" class="w-full flex flex-col items-start gap-0.5 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="applyTemplate(t.id)">
        <b class="text-[12px] font-semibold">{{ t.title }}</b>
        <span class="text-2xs text-muted">{{ t.desc }}</span>
      </button>
    </template>
    <template v-else-if="ui.menu.noteId">
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="noteRename">
        <SquarePen :size="15" class="text-muted" />Ubah judul…
      </button>
      <div class="flex items-center gap-1.5 px-3 py-1.5 border-y border-line/40 my-1">
        <button v-for="c in NOTE_COLORS" :key="c" class="w-[18px] h-[18px] rounded-full border-2" :aria-label="c"
          :style="{ background: c, borderColor: curNote && curNote.color === c ? '#fff' : 'rgba(255,255,255,.25)' }"
          @click="noteColor(c)"></button>
      </div>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="noteFront">
        <ArrowUpToLine :size="15" class="text-muted" />Pindah ke depan
      </button>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="noteBack">
        <ArrowDownToLine :size="15" class="text-muted" />Pindah ke belakang
      </button>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-danger hover:bg-danger/10 transition-colors font-medium" @click="noteDel">
        <Trash2 :size="15" />Hapus catatan
      </button>
    </template>
    <template v-else>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="config">
        <SlidersHorizontal :size="15" class="text-muted" />Konfigurasi
      </button>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="terminal">
        <Terminal :size="15" class="text-muted" />Buka terminal
      </button>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-panel-2 transition-colors" @click="rename">
        <SquarePen :size="15" class="text-muted" />Ubah nama…
      </button>
      <button role="menuitem" class="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-danger hover:bg-danger/10 transition-colors font-medium" @click="del">
        <Trash2 :size="15" />Hapus perangkat
      </button>
    </template>
  </div>
</template>
