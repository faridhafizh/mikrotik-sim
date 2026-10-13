<script setup>
import { ref, computed, onMounted } from 'vue'
import { Activity, Bell, BellOff, CirclePlay, CircleStop, Trash2, Gauge, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useMonitor } from '../stores/monitor'
import { sparkPoints } from '../monitor.js'
import { bw } from '../engine'

const net = useNet(), mon = useMonitor()

const srcDevId = ref('')
const dstIp = ref('10.0.0.1')
const activeTestResult = ref(null)

onMounted(() => {
  mon.backfill()
  srcDevId.value = Object.keys(net.devices)[0] || ''
})

const s = computed(() => mon.summary)
const rows = computed(() => {
  const sum = mon.summary
  if (!sum) return []
  return Object.entries(sum.devices).map(([id, m]) => ({
    id, name: net.devices[id]?.name || id, ...m,
    spark: sparkPoints((mon.history[id] || []).map(h => (h.total ? h.up / h.total : 1)))
  }))
})

function runBandwidthTest() {
  if (!srcDevId.value || !dstIp.value.trim()) return
  const res = bw(net, srcDevId.value, dstIp.value.trim())
  if (res.ok) {
    activeTestResult.value = {
      ok: true,
      tx: res.tx,
      rx: res.rx,
      path: res.path,
      target: dstIp.value.trim()
    }
  } else {
    activeTestResult.value = {
      ok: false,
      err: res.err || 'Target unreachable'
    }
  }
}

const tile = 'relative flex flex-col glass border border-line rounded-ctl px-2.5 py-1.5 gap-0.5'
function toggle() { mon.on ? mon.stop() : mon.start(net) }
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Telemetry Bandwidth Test Section -->
    <div class="glass border border-accent/40 rounded-ctl p-3 flex flex-col gap-2.5 scanlines">
      <div class="flex items-center gap-1.5">
        <Gauge :size="16" class="text-accent suit-glow" />
        <b class="hud-label text-xs text-accent">BANDWIDTH TELEMETRY DIAGNOSTIC</b>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label class="hud-label text-dim block mb-1">Source Node</label>
          <select v-model="srcDevId" class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none">
            <option v-for="d in Object.values(net.devices)" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <div>
          <label class="hud-label text-dim block mb-1">Target IP</label>
          <input v-model="dstIp" placeholder="10.0.0.1" class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none font-mono" />
        </div>
        <div class="flex items-end">
          <button class="hex-clip w-full bg-accent text-accent-fg font-bold hud-label text-2xs py-1.5 hover:brightness-110 flex items-center justify-center gap-1" @click="runBandwidthTest">
            <Zap :size="12" /> RUN TEST
          </button>
        </div>
      </div>

      <!-- Test Live Results Display -->
      <div v-if="activeTestResult" class="mt-1 p-2 bg-panel/80 border border-line rounded-ctl flex flex-col gap-2">
        <div v-if="activeTestResult.ok" class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-2 p-2 bg-panel-2 rounded border border-ok/30">
            <ArrowUpRight :size="18" class="text-ok" />
            <div>
              <span class="hud-label text-[9px] text-dim block">TX THROUGHPUT</span>
              <span class="text-sm font-bold font-mono text-ok">{{ activeTestResult.tx.toFixed(1) }} Mbps</span>
            </div>
          </div>
          <div class="flex items-center gap-2 p-2 bg-panel-2 rounded border border-accent/30">
            <ArrowDownLeft :size="18" class="text-accent" />
            <div>
              <span class="hud-label text-[9px] text-dim block">RX THROUGHPUT</span>
              <span class="text-sm font-bold font-mono text-accent">{{ activeTestResult.rx.toFixed(1) }} Mbps</span>
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-danger font-mono p-1">
          FAILURE: {{ activeTestResult.err }}
        </div>
      </div>
    </div>

    <!-- Active Link Monitoring -->
    <div class="flex items-center gap-1.5 pt-1">
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
