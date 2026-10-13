<script setup>
import { Sun, Moon } from 'lucide-vue-next'
import { useUi } from '../stores/ui'

const ui = useUi()
</script>

<template>
  <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Tema Tampilan">
    <button
      class="flex items-center gap-1.5 px-2 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.theme === 'dark'
        ? 'bg-accent/15 border-accent text-accent font-semibold'
        : 'border-line text-muted hover:border-line-strong hover:text-fg'"
      :aria-pressed="ui.theme === 'dark'"
      title="Mode Gelap (NOC)"
      aria-label="Mode Gelap"
      @click="ui.setTheme('dark')"
    >
      <Moon :size="13" />
      <span class="hud-label">Gelap</span>
    </button>

    <button
      class="flex items-center gap-1.5 px-2 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.theme === 'light'
        ? 'bg-accent/15 border-accent text-accent font-semibold'
        : 'border-line text-muted hover:border-line-strong hover:text-fg'"
      :aria-pressed="ui.theme === 'light'"
      title="Mode Terang (Resmi)"
      aria-label="Mode Terang"
      @click="ui.setTheme('light')"
    >
      <Sun :size="13" />
      <span class="hud-label">Terang</span>
    </button>
  </div>
</template>
