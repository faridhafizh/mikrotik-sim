<script setup>
import { CircleCheck, TriangleAlert, Info, X } from 'lucide-vue-next'
import { useUi } from '../stores/ui'
const ui = useUi()
const ICON = { success: CircleCheck, error: TriangleAlert, info: Info }
const TONE = { success: 'text-ok', error: 'text-danger', info: 'text-fg' }
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
    <TransitionGroup name="toast">
      <div v-for="t in ui.toasts" :key="t.id" :role="t.kind === 'error' ? 'alert' : 'status'"
        class="bg-chrome border border-line rounded-xl shadow-xl px-3.5 py-2.5 text-[13px] flex items-start gap-2.5">
        <component :is="ICON[t.kind] || Info" :size="16" class="mt-0.5 shrink-0" :class="TONE[t.kind] || 'text-fg'" />
        <span class="flex-1 text-fg leading-snug"><span class="hud-label text-accent text-2xs font-semibold">&gt;&gt; SISTEM:</span> {{ t.text }}</span>
        <button class="shrink-0 text-dim hover:text-fg p-0.5" title="Tutup notifikasi" aria-label="Tutup notifikasi" @click="ui.dismiss(t.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .2s }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px) }
</style>
