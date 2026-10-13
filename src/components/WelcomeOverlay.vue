<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useUi } from '../stores/ui'
import { useGuide } from '../stores/guide'

const ui = useUi(), guide = useGuide()

const LINES = [
  'NANOSUIT 2.0 // ONLINE',
  'NEURAL LINK … OK',
  'TACTICAL NETWORK … OK'
]

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
const shown = ref(reduced ? LINES.length : 0)
let timers = []

onMounted(() => {
  if (reduced) return
  // Staged reveal over ~1.6s: line i appears at i * ~520ms, last line + visor-in ≈ 1.6s.
  LINES.forEach((_, i) => {
    timers.push(setTimeout(() => { shown.value = i + 1 }, i * 520))
  })
})
onBeforeUnmount(() => { timers.forEach(clearTimeout); timers = [] })

function initiate() { ui.markBooted(); guide.reopen() }
function skip() { ui.markBooted(); guide.finish() }
</script>

<template>
  <div v-if="ui.welcome" class="fixed inset-0 z-40 bg-canvas/95 backdrop-blur-sm grid place-items-center p-4 scanlines">
    <div class="relative w-[min(600px,calc(100vw-2rem))]">
      <!-- corner brackets (outside hex-clip so they aren't clipped) -->
      <span class="pointer-events-none absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent opacity-70 z-10" />
      <span class="pointer-events-none absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent opacity-70 z-10" />
      <span class="pointer-events-none absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent opacity-70 z-10" />
      <span class="pointer-events-none absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent opacity-70 z-10" />

      <div class="glass hex-clip border border-accent/35 p-6 shadow-panel">
      <div class="flex items-center justify-between">
        <span class="hud-label text-[11px] text-dim">BOOT SEQUENCE</span>
        <span class="hud-label text-[11px] text-accent">v2.0</span>
      </div>

      <div class="mt-4 min-h-[84px] flex flex-col gap-2">
        <p
          v-for="line in LINES.slice(0, shown)"
          :key="line"
          class="visor-in hud-label text-[13px] text-fg flex items-center gap-2"
        >
          <span class="text-accent">&gt;</span>{{ line }}
        </p>
      </div>

      <div class="mt-2 h-1.5 bg-panel-2 border border-line overflow-hidden">
        <div class="h-full bg-accent boot-bar" :style="reduced ? { width: '100%' } : undefined" />
      </div>

      <div class="mt-6 flex items-center gap-4">
        <button
          class="hex-clip px-4 py-2 bg-accent text-accent-fg hud-label text-[12px] font-bold hover:opacity-90 transition-opacity"
          @click="initiate"
        >Initiate deployment</button>
        <button
          class="hud-label text-[11px] text-muted hover:text-accent underline-offset-4 hover:underline transition-colors"
          @click="skip"
        >Skip</button>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes boot-bar {
  from { width: 0 }
  to { width: 100% }
}
.boot-bar {
  width: 0;
  animation: boot-bar 1.6s ease-out forwards;
}
@media (prefers-reduced-motion: reduce) {
  .boot-bar { animation: none; width: 100% }
}
</style>
