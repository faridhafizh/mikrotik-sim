<script setup>
import { computed } from 'vue'
import { Wifi } from 'lucide-vue-next'
import { TYPES, LABEL_OF } from '../catalog'
import { ifaceUp } from '../graph'
import { trunc } from '../fmt'

const props = defineProps({
  dev: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  linking: { type: Boolean, default: false },
  links: { type: Array, default: () => [] },
  wifiCount: { type: Number, default: 0 }
})
defineEmits(['select', 'context', 'delete'])

const t = computed(() => TYPES.find(x => x.id === props.dev.type) || TYPES[0])
const stroke = computed(() => props.selected ? 'var(--suit-accent)' : props.linking ? 'var(--color-ok)' : 'var(--color-line-strong)')
const anyUp = computed(() => props.dev.ifaces.some(i => ifaceUp(props.links, props.dev.id, i.name)))
const meta = computed(() => props.dev.ifaces.find(i => i.addr)?.addr || '—')
const wifi = computed(() => !!(props.dev.wlan?.ssid || props.dev.wifi?.ssid))
</script>

<template>
  <g :transform="`translate(${dev.x},${dev.y})`" tabindex="0" role="button" class="dev-hit"
    :aria-label="'Perangkat ' + dev.name + ' (' + LABEL_OF[dev.type] + ')'"
    @keydown.enter.prevent="$emit('select')" @keydown.delete.prevent="$emit('delete')" @contextmenu.prevent.stop="$emit('context', $event)">
    <rect x="-66" y="-30" width="132" height="60" rx="12" fill="url(#node-glass)" :stroke="stroke" stroke-width="2"
      :filter="selected ? 'url(#suit-glow)' : null" />
    <rect x="-66" y="-30" width="3" height="60" rx="1.5" :fill="t.color" />
    <g :transform="'translate(-52,-11)'"><component :is="t.Icon" :size="20" :stroke-width="1.8" :color="t.color" /></g>
    <text x="-26" y="-6" font-family="var(--font-mono)" font-size="13" font-weight="700" :fill="'var(--color-fg)'" paint-order="stroke" :stroke="'var(--color-node)'" stroke-width="3">{{ trunc(dev.name, 14).toUpperCase() }}</text>
    <text x="-26" y="12" font-family="var(--font-mono)" font-size="10.5" :fill="'var(--color-muted)'">{{ meta }}</text>
    <circle cx="56" cy="-20" r="4" :fill="anyUp ? 'var(--color-ok)' : 'var(--color-line)'" :stroke="'var(--color-line-strong)'" />
    <g v-if="wifi">
      <text v-if="wifiCount" x="46" y="8" text-anchor="end" font-family="var(--font-mono)" font-size="10" :fill="'var(--color-wifi)'">{{ wifiCount }}</text>
      <g transform="translate(48,4)"><Wifi :size="14" :color="'var(--color-wifi)'" /></g>
    </g>
  </g>
</template>
