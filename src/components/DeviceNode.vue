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
  <g :transform="`translate(${dev.x},${dev.y})`" tabindex="0" role="button" class="dev-hit group"
    :aria-label="'Perangkat ' + dev.name + ' (' + LABEL_OF[dev.type] + ')'"
    @keydown.enter.prevent="$emit('select')" @keydown.delete.prevent="$emit('delete')" @contextmenu.prevent.stop="$emit('context', $event)">

    <!-- Transparent Hit Area for Easy Selection & Dragging -->
    <rect x="-60" y="-38" width="120" height="76" rx="16" fill="transparent" />

    <!-- Selection Ring / Backdrop Disc around Hardware Icon -->
    <circle cx="0" cy="-8" r="28"
      :fill="selected ? 'var(--color-panel-2)' : 'var(--color-node)'"
      fill-opacity="0.88"
      :stroke="stroke"
      :stroke-width="selected ? 2.5 : 1.5"
      :filter="selected ? 'url(#suit-glow)' : null" />

    <!-- Central Realistic Hardware SVG Icon -->
    <g transform="translate(-26,-34)">
      <component :is="t.Icon" :size="52" :color="t.color" />
    </g>

    <!-- Status LED Indicator (Top Right corner) -->
    <g transform="translate(18, -24)">
      <circle r="4.5" :fill="anyUp ? 'var(--color-ok)' : 'var(--color-line-strong)'" :stroke="'var(--color-canvas)'" stroke-width="1.5" />
      <circle v-if="anyUp" r="2" fill="#ffffff" opacity="0.8" />
    </g>

    <!-- Wi-Fi Badge (Top Left corner if active) -->
    <g v-if="wifi" transform="translate(-20, -24)">
      <rect x="-10" y="-8" width="20" height="15" rx="7.5" fill="var(--color-chrome)" stroke="var(--color-wifi)" stroke-width="1.2" />
      <g transform="translate(-6, -5)">
        <Wifi :size="10" :color="'var(--color-wifi)'" />
      </g>
      <text v-if="wifiCount" x="3" y="3" font-family="var(--font-mono)" font-size="8" font-weight="700" fill="var(--color-wifi)">{{ wifiCount }}</text>
    </g>

    <!-- Floating Pill Badge for Device Name and IP Meta -->
    <g transform="translate(0, 22)">
      <rect x="-56" y="-10" width="112" height="24" rx="12"
        fill="var(--color-chrome)"
        fill-opacity="0.92"
        :stroke="selected ? 'var(--suit-accent)' : 'var(--color-line)'"
        :stroke-width="selected ? 1.5 : 1" />

      <!-- Type Accent Color Indicator Dot -->
      <circle cx="-46" cy="2" r="3" :fill="t.color" />

      <!-- Device Name Text -->
      <text x="-38" y="-1" font-family="var(--font-mono)" font-size="10.5" font-weight="700" fill="var(--color-fg)" paint-order="stroke" stroke="var(--color-chrome)" stroke-width="2">
        {{ trunc(dev.name, 11).toUpperCase() }}
      </text>

      <!-- Device IP Meta Text -->
      <text x="-38" y="9" font-family="var(--font-mono)" font-size="8.5" font-weight="500" fill="var(--color-muted)">
        {{ trunc(meta, 15) }}
      </text>
    </g>
  </g>
</template>
