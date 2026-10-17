<script setup>
import { Sun, Moon, Shield, Zap, EyeOff } from 'lucide-vue-next'
import { useUi } from '../stores/ui'
import { playSuitModeAudio } from '../suitAudio'

const ui = useUi()

function selectSuitMode(mode) {
  ui.setSuit(mode)
  playSuitModeAudio(mode)
  ui.notify(`NANOSUIT MODE: ${mode.toUpperCase()} ACTIVE`, 'info')
}
</script>

<template>
  <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Nanosuit & Theme">
    <!-- Nanosuit Tactical Suit Modes -->
    <button
      class="flex items-center gap-1 px-2 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.suit === 'armor' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-semibold' : 'border-line text-muted hover:text-fg'"
      title="MAXIMUM ARMOR"
      @click="selectSuitMode('armor')"
    >
      <Shield :size="12" />
      <span class="hud-label hidden sm:inline">ARMOR</span>
    </button>

    <button
      class="flex items-center gap-1 px-2 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.suit === 'power' ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-semibold' : 'border-line text-muted hover:text-fg'"
      title="MAXIMUM POWER"
      @click="selectSuitMode('power')"
    >
      <Zap :size="12" />
      <span class="hud-label hidden sm:inline">POWER</span>
    </button>

    <button
      class="flex items-center gap-1 px-2 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.suit === 'cloak' ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-semibold' : 'border-line text-muted hover:text-fg'"
      title="CLOAK ENGAGED"
      @click="selectSuitMode('cloak')"
    >
      <EyeOff :size="12" />
      <span class="hud-label hidden sm:inline">CLOAK</span>
    </button>

    <span class="w-px h-4 bg-line mx-0.5"></span>

    <!-- UI Theme Switcher -->
    <button
      class="flex items-center gap-1 px-1.5 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.theme === 'dark' ? 'bg-accent/15 border-accent text-accent' : 'border-line text-muted hover:text-fg'"
      title="Mode Gelap (NOC)"
      @click="ui.setTheme('dark')"
    >
      <Moon :size="12" />
    </button>

    <button
      class="flex items-center gap-1 px-1.5 py-1 text-2xs rounded-md border shrink-0 transition-colors"
      :class="ui.theme === 'light' ? 'bg-accent/15 border-accent text-accent' : 'border-line text-muted hover:text-fg'"
      title="Mode Terang (Resmi)"
      @click="ui.setTheme('light')"
    >
      <Sun :size="12" />
    </button>
  </div>
</template>
