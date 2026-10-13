<script setup>
import { useUi } from '../stores/ui'
import { beep } from '../suitAudio'

const ui = useUi()

const MODES = [
  { id: 'power', label: 'Power' },
  { id: 'armor', label: 'Armor' },
  { id: 'cloak', label: 'Cloak' }
]

function pick(m) {
  ui.setSuit(m)
  beep('mode')
}
</script>

<template>
  <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Suit mode">
    <button
      v-for="m in MODES"
      :key="m.id"
      class="hex-clip glass hud-label px-2 py-1 border text-2xs shrink-0 transition-colors"
      :class="ui.suit === m.id
        ? 'border-accent text-accent suit-glow'
        : 'border-line text-muted hover:border-accent/50 hover:text-fg'"
      :aria-pressed="ui.suit === m.id"
      :title="'Suit mode: ' + m.label"
      :aria-label="'Suit mode: ' + m.label"
      @click="pick(m.id)"
    >{{ m.label }}</button>
  </div>
</template>
