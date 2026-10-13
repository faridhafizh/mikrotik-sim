<script setup>
import { trunc } from '../fmt'

const props = defineProps({
  note: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})
defineEmits(['move', 'resize', 'select', 'context', 'delete'])
</script>

<template>
  <g :transform="`translate(${note.x},${note.y})`" tabindex="0" role="button"
    :aria-label="'Catatan ' + (note.title || 'tanpa judul')"
    @keydown.enter.prevent="$emit('select')" @keydown.delete.prevent="$emit('delete')"
    @contextmenu.prevent.stop="$emit('context', $event)">
    <rect :width="note.w" :height="note.h" rx="10" :stroke="selected ? 'var(--suit-accent)' : note.color" stroke-width="2" :fill="note.color" fill-opacity="0.12"
      @pointerdown.stop="$emit('move', $event)" />
    <text x="12" y="24" font-size="13" font-weight="700" fill="var(--color-fg)" stroke="var(--color-canvas)" stroke-width="3" paint-order="stroke"
      @pointerdown.stop="$emit('move', $event)">{{ trunc(note.title, 28) }}</text>
    <rect :x="note.w - 12" :y="note.h - 12" width="12" height="12" rx="3" :fill="note.color" data-handle style="cursor:nwse-resize"
      @pointerdown.stop="$emit('resize', $event)" />
  </g>
</template>
