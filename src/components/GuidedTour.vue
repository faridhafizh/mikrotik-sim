<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-vue-next'
import { useGuide } from '../stores/guide'
import { useUi } from '../stores/ui'

const guide = useGuide(), ui = useUi()
const step = computed(() => guide.steps[guide.step] || {})
const rect = ref(null)

function place() {
  const el = step.value.anchor ? document.querySelector(`[data-guide="${step.value.anchor}"]`) : null
  if (step.value.anchor === 'terminal') ui.sideOpen = true   // tombol terminal ada di panel
  if (!el) { rect.value = null; return }
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  const r = el.getBoundingClientRect()
  rect.value = { x: r.x, y: r.y, w: r.width, h: r.height }
}

let ro = null
function listen(on) {
  ro?.disconnect(); ro = null
  if (on) {
    ro = new ResizeObserver(place); ro.observe(document.body)
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place)
  } else {
    window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place)
    rect.value = null
  }
}
watch(() => [guide.tourOpen, guide.step], ([open]) => { if (open) place(); listen(open) }, { immediate: true })
onUnmounted(() => listen(false))
</script>

<template>
  <div v-if="guide.tourOpen" class="fixed inset-0 z-40 pointer-events-none" aria-live="polite">
    <div class="absolute inset-0 bg-black/40" />
    <div v-if="rect" class="absolute rounded-ctl border-2 border-accent pointer-events-none transition-all"
      :style="{ left: rect.x - 6 + 'px', top: rect.y - 6 + 'px', width: rect.w + 12 + 'px', height: rect.h + 12 + 'px' }" />
    <div class="absolute inset-x-0 bottom-0 lg:inset-x-auto lg:right-4 lg:bottom-4 lg:w-90 p-3 pointer-events-auto">
      <div class="glass hex-clip border border-line rounded-panel shadow-panel p-4 flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <GraduationCap :size="16" class="text-accent shrink-0" />
          <b class="hud-label text-[13px] text-accent">Mode pemula — langkah {{ guide.step + 1 }}/{{ guide.steps.length }}</b>
          <button class="ml-auto p-1 rounded-ctl text-muted hover:bg-panel-2" aria-label="Tutup tur" title="Tutup tur" @click="guide.finish()"><X :size="15" /></button>
        </div>
        <p class="text-[13px] font-semibold">{{ step.title }}</p>
        <p class="text-[12px] text-muted leading-relaxed">{{ step.body }}</p>
        <div class="flex items-center gap-2">
          <button class="hex-clip flex items-center gap-1 px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2 disabled:opacity-40" :disabled="!guide.step" @click="guide.prev()">
            <ChevronLeft :size="13" />Kembali
          </button>
          <span class="flex gap-1 mx-auto" aria-hidden="true">
            <span v-for="(s, i) in guide.steps" :key="s.id" class="w-1.5 h-1.5 rounded-pill" :class="i <= guide.step ? 'bg-accent' : 'bg-line'" />
          </span>
          <button class="hex-clip flex items-center gap-1 px-2.5 py-1 rounded-ctl bg-accent text-accent-fg text-2xs font-semibold" @click="guide.next()">
            {{ guide.step === guide.steps.length - 1 ? 'Selesai' : 'Lanjut' }}<ChevronRight :size="13" />
          </button>
        </div>
        <button class="self-start text-2xs text-dim hover:text-muted" @click="ui.seenWelcome()">Lewati, jangan tampilkan lagi</button>
      </div>
    </div>
  </div>
</template>
