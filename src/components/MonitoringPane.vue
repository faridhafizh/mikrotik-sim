<script setup>
import { computed, onMounted } from 'vue'
import { Activity, Bell, BellOff, CirclePlay, CircleStop, Trash2 } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useMonitor } from '../stores/monitor'
import { sparkPoints } from '../monitor.js'

const net = useNet(), mon = useMonitor()
const s = computed(() => mon.summary)
const rows = computed(() => {
  const sum = mon.summary
  if (!sum) return []
  return Object.entries(sum.devices).map(([id, m]) => ({
    id, name: net.devices[id]?.name || id, ...m,
    spark: sparkPoints((mon.history[id] || []).map(h => (h.total ? h.up / h.total : 1)))
  }))
})
const tile = 'relative flex flex-col glass border border-line rounded-ctl px-2.5 py-1.5 gap-0.5'
onMounted(() => mon.backfill())
function toggle() { mon.on ? mon.stop() : mon.start(net) }
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-1.5">
      <Activity :size="15" class="text-accent" />
      <b class="hud-label text-[13px] text-accent">Monitoring</b>
      <span class="ml-auto flex items-center gap-1">
        <button class="hex-clip flex items-center gap-1 px-2 py-1 rounded-ctl border border-line text-2xs hover:bg-panel-2"
          :class="mon.on ? 'text-danger' : 'text-ok'" @click="toggle">
          <component :is="mon.on ? CircleStop : CirclePlay" :size="13" />
          {{ mon.on ? 'Hentikan' : 'Mulai pantau' }}
        </button>
        <select class="bg-panel-2 border border-line rounded-ctl px-1.5 py-1 text-2xs text-fg outline-none focus:border-accent"
          :value="mon.interval" aria-label="Interval sampling" @change="mon.setIntervalSec(net, +$event.target.value)">
          <option v-for="v of [5, 15, 60]" :key="v" :value="v">{{ v }}s</option>
        </select>
      </span>
    </div>

    <p class="text-[12px] text-dim leading-relaxed">
      Memantau status kabel &amp; IP semua perangkat tiap beberapa detik. Peringatan muncul sebagai notifikasi dan tercatat di bawah.
    </p>

    <div v-if="s" class="grid grid-cols-3 gap-1.5">
      <div :class="tile">
        <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-line-strong pointer-events-none" aria-hidden="true"></span>
        <span class="text-2xs text-dim">Perangkat</span>
        <b class="text-[15px] font-mono">{{ Object.keys(s.devices).length }}</b>
      </div>
      <div :class="tile">
        <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-line-strong pointer-events-none" aria-hidden="true"></span>
        <span class="text-2xs text-dim">Kabel UP</span>
        <b class="text-[15px] font-mono" :class="s.up === s.total ? 'text-ok' : 'text-accent'">{{ s.up }}/{{ s.total }}</b>
      </div>
      <div :class="tile">
        <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-line-strong pointer-events-none" aria-hidden="true"></span>
        <span class="text-2xs text-dim">Tanpa IP</span>
        <b class="text-[15px] font-mono" :class="s.noIp ? 'text-accent' : 'text-ok'">{{ s.noIp }}</b>
      </div>
    </div>

    <div v-if="rows.length" class="flex flex-col gap-1">
      <b class="hud-label text-2xs text-accent">Perangkat</b>
      <div v-for="r in rows" :key="r.id" class="flex items-center gap-2 glass border border-line rounded-ctl px-2 py-1.5">
        <span class="text-[12px] flex-1 truncate" :class="r.up === r.total ? '' : 'text-accent'">{{ r.name }}</span>
        <span class="text-2xs font-mono text-dim w-10 text-right">{{ r.up }}/{{ r.total }}</span>
        <svg v-if="r.spark" width="64" height="18" aria-hidden="true">
          <polyline :points="r.spark" fill="none" stroke="#7fb8e8" stroke-width="1.5" />
        </svg>
        <span class="w-2 h-2 rounded-pill shrink-0" :class="r.up === r.total ? 'bg-ok' : r.up ? 'bg-accent' : 'bg-danger'"
          :title="r.up === r.total ? 'semua kabel UP' : 'ada kabel DOWN'" />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <b class="hud-label text-2xs text-accent">Aturan peringatan</b>
      <label v-for="r in mon.rules" :key="r.id" class="flex items-center gap-2 border border-line rounded-ctl px-2 py-1.5 text-[12px] cursor-pointer hover:bg-panel-2">
        <input type="checkbox" :checked="r.on" class="accent-[#ffbf47]" @change="mon.toggleRule(r.id)" />
        <component :is="r.on ? Bell : BellOff" :size="13" class="text-muted shrink-0" />
        <span class="flex-1">{{ r.label }}</span>
        <span class="text-2xs text-dim">{{ r.severity === 'error' ? 'segera' : '2× sampel' }}</span>
      </label>
    </div>

    <div v-if="mon.alerts.length" class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5">
        <b class="hud-label text-2xs text-accent flex-1">Peringatan</b>
        <button class="hex-clip p-1 rounded-ctl text-muted hover:bg-panel-2" aria-label="Bersihkan peringatan" title="Bersihkan peringatan" @click="mon.clearAlerts()">
          <Trash2 :size="13" />
        </button>
      </div>
      <div v-for="(a, i) in mon.alerts" :key="a.t + i" class="flex items-center gap-2 glass border border-line rounded-ctl px-2 py-1.5 text-[12px]">
        <span class="w-2 h-2 rounded-pill bg-danger shrink-0" />
        <span class="flex-1 truncate"><b>{{ a.name }}</b> — {{ a.text }}</span>
        <span class="text-2xs text-dim shrink-0">{{ new Date(a.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}</span>
      </div>
    </div>
  </div>
</template>
