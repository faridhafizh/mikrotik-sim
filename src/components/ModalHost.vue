<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useUi } from '../stores/ui'
import { HELP, FIDELITY } from '../help'
import ConfigModal from './ConfigModal.vue'
import LinkModal from './LinkModal.vue'
import FirewallFlowModal from './FirewallFlowModal.vue'

const ui = useUi()
const panel = ref(null)
const text = ref('')

watch(() => ui.modal, async m => {
  text.value = m?.kind === 'text' ? (m.value || '') : ''
  if (!m) return
  await nextTick()
  panel.value?.querySelector('input,button[data-primary]')?.focus()
}, { immediate: true })

function cancel() { ui.answer(ui.modal?.kind === 'text' ? null : (ui.modal?.kind === 'confirm' ? false : null)) }
function ok() { ui.answer(true) }
function save() { const v = text.value.trim(); if (v) ui.answer(v) }

function onKey(e) {
  if (!ui.modal) return
  if (e.key === 'Escape') { e.preventDefault(); cancel(); return }
  if (e.key !== 'Tab') return
  const els = panel.value?.querySelectorAll('input,button')
  if (!els?.length) return
  const first = els[0], last = els[els.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

const SHORTCUTS = [
  ['Ctrl+Z', 'Urungkan'], ['Ctrl+Shift+Z / Ctrl+Y', 'Ulangi'], ['+ / -', 'Perbesar / Perkecil'],
  ['0', 'Reset tampilan'], ['F', 'Muat seluruh topologi'], ['N', 'Alat catatan'], ['Tab', 'Melengkapi perintah'],
  ['↑ / ↓', 'Riwayat perintah'], ['Delete', 'Hapus perangkat terpilih'], ['Klik kanan', 'Menu perangkat'],
  ['Esc', 'Batal / tutup']
]
const GROUP = [['router', 'Router'], ['switch', 'Switch'], ['host', 'PC · Server · Laptop']]

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="ui.modal" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-xs" @click="cancel"></div>
    <div ref="panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"
      class="bg-chrome relative max-h-[calc(100dvh-2rem)] overflow-y-auto border border-line rounded-2xl shadow-2xl p-5"
      :class="ui.modal.kind === 'help' || ui.modal.kind === 'firewallFlow' ? 'w-[min(680px,calc(100vw-2rem))]' : 'w-[min(440px,calc(100vw-2rem))]'">

      <h2 id="modal-title" class="hud-label text-[15px] font-bold text-accent">{{ ui.modal.title }}</h2>
      <p v-if="ui.modal.body" class="mt-2 text-[13px] text-muted leading-relaxed">{{ ui.modal.body }}</p>

      <label v-if="ui.modal.kind === 'text'" class="block mt-4">
        <span class="text-2xs text-dim font-medium">{{ ui.modal.label }}</span>
        <input v-model="text" :maxlength="ui.modal.max" :placeholder="ui.modal.placeholder"
          class="mt-1 w-full bg-panel-2 border border-line rounded-md px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
          @keydown.enter.prevent="save" />
        <span v-if="ui.modal.error" class="block mt-1 text-[12px] text-danger">{{ ui.modal.error }}</span>
      </label>

      <ConfigModal v-else-if="ui.modal.kind === 'config'" />

      <LinkModal v-else-if="ui.modal.kind === 'link'" />

      <FirewallFlowModal v-else-if="ui.modal.kind === 'firewallFlow'" />

      <div v-if="ui.modal.kind === 'help'" class="mt-4 flex flex-col gap-4 text-[13px]">
        <section>
          <h3 class="hud-label text-2xs text-accent font-bold">Pintasan Keyboard</h3>
          <table class="mt-1.5 w-full border-collapse">
            <tbody>
              <tr v-for="[k, v] in SHORTCUTS" :key="k">
                <td class="py-1 pr-3 align-top"><kbd class="font-mono text-[11px] text-accent bg-panel-2 border border-line px-1.5 py-0.5 rounded">{{ k }}</kbd></td>
                <td class="py-1 text-muted">{{ v }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section>
          <h3 class="hud-label text-2xs text-accent font-bold">Perintah Per Tipe Perangkat</h3>
          <p class="mt-1 text-[12px] text-dim">Semua perintah diawali / opsional (contoh: ip address print = /ip address print). Di terminal yang sama, ketik <kbd class="font-mono text-accent">help &lt;topik&gt;</kbd>.</p>
          <div v-for="[g, label] in GROUP" :key="g" class="mt-2">
            <p class="text-[12px] font-semibold text-fg">{{ label }}</p>
            <ul class="mt-1 flex flex-col gap-1">
              <li v-for="h in HELP.filter(x => x.scope === g)" :key="h.cmd + h.desc" class="text-[12px]">
                <code class="font-mono text-[11px] text-muted">{{ h.cmd }}</code>
                <span class="ml-1.5 inline-block rounded-full px-1.5 py-px text-[9px] font-semibold align-middle"
                  :class="h.fidelity === 'asli' ? 'bg-ok/20 text-ok' : h.fidelity === 'mirip' ? 'bg-info/20 text-info' : 'bg-wifi/20 text-wifi'"
                  :title="FIDELITY[h.fidelity].desc">{{ FIDELITY[h.fidelity].tag }}</span>
                <span v-if="h.ros" class="ml-1 text-dim">(RouterOS: {{ h.ros }})</span>
                <p class="text-dim text-[11px]">{{ h.desc }}</p>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <div v-if="ui.modal.kind !== 'link'" class="mt-5 flex justify-end gap-2">
        <template v-if="ui.modal.kind === 'confirm'">
          <button class="px-3.5 py-1.5 rounded-md border border-line text-[13px] text-muted hover:bg-panel-2 hover:text-fg" @click="cancel">{{ ui.modal.cancel }}</button>
          <button class="px-3.5 py-1.5 rounded-md text-[13px] font-semibold" data-primary
            :class="ui.modal.danger ? 'bg-danger text-accent-fg' : 'bg-accent text-accent-fg'" @click="ok()">{{ ui.modal.confirm }}</button>
        </template>
        <template v-else-if="ui.modal.kind === 'text'">
          <button class="px-3.5 py-1.5 rounded-md border border-line text-[13px] text-muted hover:bg-panel-2 hover:text-fg" @click="cancel">Batal</button>
          <button class="px-3.5 py-1.5 rounded-md bg-accent text-accent-fg text-[13px] font-semibold disabled:opacity-40" data-primary
            :disabled="!text.trim()" @click="save">{{ ui.modal.confirm || 'Simpan' }}</button>
        </template>
        <button v-else class="px-3.5 py-1.5 rounded-md bg-accent text-accent-fg text-[13px] font-semibold hover:opacity-90 transition-opacity" data-primary @click="ui.answer(null)">Selesai</button>
      </div>
    </div>
  </div>
</template>
