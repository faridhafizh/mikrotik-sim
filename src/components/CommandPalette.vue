<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { useGuide } from '../stores/guide'
import { CMDS, kindOf } from '../catalog'
import { isSafeCmd } from '../guide'

const net = useNet(), ui = useUi(), guide = useGuide()
const q = ref(''), hi = ref(0), inputEl = ref(null)
const guided = computed(() => guide.mode === 'guided')

const dev = computed(() => net.devices[net.selected] || null)
const items = computed(() => {
  const out = []
  if (dev.value) for (const c of CMDS[kindOf(dev.value)]) {
    if (guided.value && !isSafeCmd(c)) continue
    out.push({ kind: 'cmd', label: c, sub: dev.value.name, run: () => net.run(c) })
  }
  for (const d of Object.values(net.devices)) out.push({ kind: 'dev', label: `Lompat: ${d.name}`, sub: d.ifaces.find(i => i.addr)?.addr || '', run: () => { net.selected = d.id; ui.focusTerminal() } })
  for (const l of net.labs) out.push({ kind: 'lab', label: `Lab: ${l.title}`, sub: '', run: () => net.seedLab(l) })
  const s = q.value.trim().toLowerCase()
  return s ? out.filter(x => x.label.toLowerCase().includes(s) || (x.sub || '').toLowerCase().includes(s)) : out
})
watch(() => ui.paletteOpen, async v => { if (v) { q.value = ''; hi.value = 0; await nextTick(); inputEl.value?.focus() } })
watch(q, () => { hi.value = 0 })
function close() { ui.paletteOpen = false }
function run(i) { const it = items.value[i]; if (!it) return; close(); it.run() }
function key(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); hi.value = Math.min(items.value.length - 1, hi.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); hi.value = Math.max(0, hi.value - 1) }
  else if (e.key === 'Enter') { e.preventDefault(); run(hi.value) }
  else if (e.key === 'Escape') { e.stopPropagation(); close() }
}
</script>

<template>
  <div v-if="ui.paletteOpen" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs grid place-items-start pt-24" @click.self="close()">
    <div class="bg-chrome w-[min(560px,92vw)] border border-line rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Palet perintah">
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-panel-2/40">
        <span class="hud-label text-2xs font-bold text-accent">PALET PERINTAH SISTEM</span>
        <span class="ml-auto text-2xs text-dim">↑↓ pilih · ↵ jalankan · esc tutup</span>
      </div>
      <input ref="inputEl" v-model="q" placeholder="Ketik perintah, nama perangkat, atau lab…" class="w-full bg-transparent outline-none px-4 py-3 font-mono text-base sm:text-[13px] text-fg border-b border-line" aria-label="Perintah palette" @keydown="key" />
      <p v-if="guided" class="px-4 py-1.5 text-2xs text-dim border-b border-line bg-panel-2/20">
        Mode pemula: perintah lanjutan disembunyikan. Ganti ke mode Ahli di bilah atas untuk melihat semuanya.
      </p>
      <ul class="max-h-[320px] overflow-y-auto py-1">
        <li v-for="(it, i) in items" :key="it.kind + it.label" :class="'px-4 py-2 text-[13px] cursor-pointer flex items-center gap-2 transition-colors ' + (i === hi ? 'bg-panel-2 text-fg font-medium' : 'text-muted hover:text-fg')" @mouseenter="hi = i" @click="run(i)">
          <span class="flex-1 font-mono">{{ it.label }}</span>
          <span class="text-2xs text-dim font-mono">{{ it.sub }}</span>
        </li>
        <li v-if="!items.length" class="px-4 py-3 text-[12px] text-dim">Tidak ada hasil.</li>
      </ul>
    </div>
  </div>
</template>
