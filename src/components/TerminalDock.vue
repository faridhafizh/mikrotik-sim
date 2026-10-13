<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { Eraser, Copy, ChevronDown, ChevronUp, History, Terminal } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { TYPES, LABEL_OF, CMDS, kindOf, promptOf } from '../catalog'
import { classify } from '../fmt'

const net = useNet(), ui = useUi()
const cmd = ref(''), hi = ref(-1), inputEl = ref(null), out = ref(null)
const hist = ref([])
const HKEY = 'ml.hist'
const loadAll = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '{}') } catch { return {} } }
const loadHist = id => (loadAll()[id] || []).slice(0, 50)
const saveHist = (id, list) => { try { localStorage.setItem(HKEY, JSON.stringify({ ...loadAll(), [id]: list.slice(0, 50) })) } catch {} }
const wipeHist = id => { try { const a = loadAll(); delete a[id]; localStorage.setItem(HKEY, JSON.stringify(a)) } catch {} }

const dev = computed(() => net.devices[net.selected] || null)
const lines = computed(() => net.term[net.selected] || [])
const stats = computed(() => net.stats[net.selected] || { ping: [], speed: [] })
const spark = arr => arr.map((v, i) => `${(i / Math.max(1, arr.length - 1)) * 96},${20 - (v / Math.max(...arr, 1)) * 18}`).join(' ')
const t = computed(() => TYPES.find(x => x.id === dev.value?.type) || TYPES[0])
const LINE = { echo: 'text-accent font-semibold', head: 'text-muted font-semibold', hint: 'text-info', error: 'text-danger font-semibold', ok: 'text-ok font-semibold', dim: 'text-dim', '': 'text-fg' }

watch(() => net.selected, id => { if (id) { hist.value = loadHist(id); hi.value = -1 } }, { immediate: true })

async function submit() {
  const l = cmd.value
  cmd.value = ''
  if (l.trim()) { hist.value = [l, ...hist.value].slice(0, 50); saveHist(net.selected, hist.value) }
  hi.value = -1
  const p = net.run(l)
  await nextTick()
  if (out.value) out.value.scrollTop = out.value.scrollHeight
  await p
}
function key(e) {
  if (e.key === 'ArrowUp') { e.preventDefault(); prevHist() }
  else if (e.key === 'ArrowDown') { e.preventDefault(); nextHist() }
  else if (e.key === 'Tab' && !e.shiftKey && cmd.value.trim()) {
    e.preventDefault()
    complete()
  }
}
function prevHist() {
  if (!hist.value.length) return
  hi.value = Math.min(hist.value.length - 1, hi.value + 1)
  cmd.value = hist.value[hi.value] || ''
}
function nextHist() {
  hi.value = Math.max(-1, hi.value - 1)
  cmd.value = hist.value[hi.value] || ''
}
function complete() {
  const v = cmd.value.replace(/^\//, '')
  const m = CMDS[kindOf(dev.value)].filter(c => c.startsWith(v))
  if (m.length === 1) cmd.value = m[0]
  else if (m.length) (net.term[dev.value.id] ??= []).push(...m.map(x => '  ' + x))
}
const QUICK = {
  router: ['interface print', 'ip address print', 'ip route print', 'ip arp print', 'system resource print', 'ping ', 'export'],
  switch: ['interface print', 'vlan print', 'interface bridge stp print', 'system resource print', 'export'],
  host: ['ipconfig', 'ipconfig /all', 'ping ', 'tracert ', 'arp -a', 'route print', 'export']
}
const chips = computed(() => QUICK[kindOf(dev.value)] || [])
function insert(c) { cmd.value = c; inputEl.value?.focus() }
async function copy() {
  try { await navigator.clipboard.writeText(lines.value.join('\n')) }
  catch { ui.notify('Klipboard tidak tersedia di browser ini', 'error') }
}

let resizing = false
const onMove = e => { if (resizing) ui.setTermH(window.innerHeight - e.clientY) }
const onUp = () => { resizing = false }
function startResize() {
  resizing = true
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

watch(() => net.selected, async id => {
  if (!id) return
  await nextTick()
  inputEl.value?.focus()
}, { immediate: true })

watch(() => ui.focusTerm, async () => {
  await nextTick()
  inputEl.value?.focus()
})
</script>

<template>
  <section v-if="dev" class="shrink-0 flex flex-col bg-chrome border-t border-line overflow-hidden shadow-lg"
    :style="{ height: ui.termMin ? '44px' : ui.termH + 'px' }">
    <div class="h-1.5 shrink-0 cursor-row-resize bg-line/40 hover:bg-accent/60 transition-colors" title="Tarik untuk mengubah tinggi" @pointerdown.prevent="startResize"></div>
    <header class="shrink-0 flex items-center gap-2 px-3.5 h-[38px] border-b border-line bg-panel-2/50">
      <Terminal :size="15" class="text-accent" />
      <span class="text-[13px] font-semibold text-fg">
        <span class="hud-label text-accent font-bold">TERMINAL</span><span class="text-dim"> // </span>{{ dev.name }}
      </span>
      <span class="text-2xs text-muted bg-panel border border-line px-1.5 py-0.5 rounded-md font-mono">{{ LABEL_OF[dev.type] }}</span>

      <span class="ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-2xs hud-label font-medium"
        :class="net.packet ? 'border-accent bg-accent/15 text-accent' : 'border-ok/30 bg-ok/10 text-ok'">
        <span class="w-1.5 h-1.5 rounded-full" :class="net.packet ? 'bg-accent animate-pulse' : 'bg-ok'"></span>
        {{ net.packet ? 'TRANSMISI' : 'SIAP' }}
      </span>

      <div class="ml-auto flex items-center gap-1">
        <button class="flex items-center gap-1 px-2 py-1 rounded-md text-2xs text-muted border border-line/60 hover:bg-panel-2 hover:text-fg transition-colors" title="Bersihkan" aria-label="Bersihkan" @click="net.clearTerm(dev.id)">
          <Eraser :size="13" />Bersihkan
        </button>
        <button class="flex items-center gap-1 px-2 py-1 rounded-md text-2xs text-muted border border-line/60 hover:bg-panel-2 hover:text-fg transition-colors" title="Hapus riwayat perintah" aria-label="Hapus riwayat" @click="hist = []; wipeHist(net.selected)">
          <History :size="13" />Riwayat
        </button>
        <button class="flex items-center gap-1 px-2 py-1 rounded-md text-2xs text-muted border border-line/60 hover:bg-panel-2 hover:text-fg transition-colors" title="Salin" aria-label="Salin" @click="copy">
          <Copy :size="13" />Salin
        </button>
        <button class="p-1 rounded-md text-muted border border-line/60 hover:bg-panel-2 hover:text-fg transition-colors" :title="ui.termMin ? 'Perbesar terminal' : 'Perkecil terminal'" :aria-label="ui.termMin ? 'Perbesar terminal' : 'Perkecil terminal'" @click="ui.toggleTerm()">
          <component :is="ui.termMin ? ChevronUp : ChevronDown" :size="14" />
        </button>
      </div>
    </header>

    <div v-if="net.stats[net.selected]" class="shrink-0 border-b border-line px-3.5 py-1.2 flex items-center gap-4 bg-panel/30">
      <div v-if="stats.ping.length" class="flex items-center gap-2">
        <span class="text-2xs text-dim font-mono">ping</span>
        <svg width="96" height="18" aria-hidden="true">
          <polyline :points="spark(stats.ping)" fill="none" stroke="var(--color-accent)" stroke-width="1.5" />
        </svg>
        <span class="text-2xs text-muted font-mono">terakhir {{ stats.ping[stats.ping.length - 1] }}ms</span>
      </div>
      <div v-if="stats.speed.length" class="text-2xs text-muted font-mono">
        tx/rx terakhir: {{ stats.speed[stats.speed.length - 1].tx.toFixed(1) }}/{{ stats.speed[stats.speed.length - 1].rx.toFixed(1) }} Mbps
      </div>
    </div>

    <template v-if="!ui.termMin">
      <div ref="out" class="relative flex-1 overflow-y-auto px-3.5 py-2 font-mono text-[12.5px] leading-[1.55] whitespace-pre-wrap bg-chrome"
        role="log" aria-label="Keluaran terminal" aria-live="polite">
        <div v-if="!lines.length" class="text-dim italic">Belum ada perintah. Ketik help untuk daftar perintah.</div>
        <div v-for="(l, i) in lines" :key="i" :class="LINE[classify(l)] || 'text-fg'" v-text="l"></div>
        <div><span class="caret-blink inline-block w-[7px] h-[13px] align-middle bg-accent" aria-hidden="true"></span></div>
      </div>

      <div class="lg:hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-t border-line overflow-x-auto rail-scroll bg-panel-2/40">
        <button v-for="c in chips" :key="c" class="shrink-0 min-h-[30px] px-2.5 rounded-md border border-line font-mono text-2xs text-muted hover:bg-panel-2 hover:text-fg" @click="insert(c)">{{ c }}</button>
        <span class="flex-1" />
        <button class="shrink-0 min-h-[30px] min-w-[30px] rounded-md border border-line text-2xs text-muted hover:bg-panel-2 hover:text-fg" aria-label="Perintah sebelumnya" title="Perintah sebelumnya" @click="prevHist()">↑</button>
        <button class="shrink-0 min-h-[30px] min-w-[30px] rounded-md border border-line text-2xs text-muted hover:bg-panel-2 hover:text-fg" aria-label="Lengkapi perintah" title="Lengkapi perintah" @click="complete()">Tab</button>
      </div>

      <label class="shrink-0 flex items-center gap-2 px-3.5 pb-2 pt-1.5 border-t border-line bg-panel-2/30">
        <span class="font-mono text-[12.5px] font-semibold text-ok">{{ promptOf(dev) }}</span>
        <input ref="inputEl" v-model="cmd" data-term-input class="flex-1 bg-transparent outline-none font-mono text-base sm:text-[12.5px] text-fg"
          spellcheck="false" autocomplete="off" aria-label="Perintah" @keydown.enter.prevent="submit" @keydown="key" />
      </label>
    </template>
  </section>
</template>
