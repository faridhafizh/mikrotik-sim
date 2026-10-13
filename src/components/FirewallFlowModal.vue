<script setup>
import { ref, computed } from 'vue'
import { ShieldAlert, ShieldCheck, ArrowRight, Activity, Zap, Router, Server, Laptop, Cpu } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { simulatePacketFlow } from '../engine'
import { beep } from '../suitAudio'

const net = useNet()
const ui = useUi()

const srcDevId = ref(ui.modal?.srcDevId || net.curId || Object.keys(net.devices)[0] || '')
const dstIp = ref(ui.modal?.dstIp || '10.0.0.1')
const proto = ref('icmp')
const dport = ref('80')
const scanResult = ref(null)

const devices = computed(() => Object.values(net.devices))

function devIcon(type) {
  if (type === 'router') return Router
  if (type === 'server') return Server
  if (type === 'laptop') return Laptop
  return Cpu
}

function runScan() {
  if (!srcDevId.value || !dstIp.value.trim()) return
  beep('confirm')
  scanResult.value = simulatePacketFlow(net, {
    srcDevId: srcDevId.value,
    dstIp: dstIp.value.trim(),
    proto: proto.value,
    dport: dport.value.trim()
  })
}

function chainBadgeClass(action) {
  if (action === 'DROP') return 'bg-danger/20 text-danger border-danger/40'
  if (action === 'ACCEPT' || action === 'ACCEPT (default)') return 'bg-ok/20 text-ok border-ok/40'
  if (action === 'DST-NAT' || action === 'SRC-NAT') return 'bg-accent/20 text-accent border-accent/40'
  return 'bg-dim/20 text-dim border-line'
}
</script>

<template>
  <div class="flex flex-col gap-4 text-fg max-w-2xl w-full">
    <div class="flex items-center gap-2 border-b border-line pb-3">
      <Zap :size="18" class="text-accent suit-glow" />
      <div>
        <h3 class="hud-label text-sm font-bold text-accent">TACTICAL FIREWALL SCAN // PACKET FLOW</h3>
        <p class="text-2xs text-dim">Simulate packet traversal, firewall chains, NAT transforms & rule matches.</p>
      </div>
    </div>

    <!-- Scan Form -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 glass p-3 rounded-ctl border border-line">
      <div>
        <label class="hud-label text-dim block mb-1">Source Node</label>
        <select v-model="srcDevId" class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none">
          <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.type }})</option>
        </select>
      </div>

      <div>
        <label class="hud-label text-dim block mb-1">Target IP</label>
        <input v-model="dstIp" placeholder="e.g. 10.0.0.1" class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none font-mono" />
      </div>

      <div>
        <label class="hud-label text-dim block mb-1">Protocol</label>
        <select v-model="proto" class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none">
          <option value="icmp">ICMP (Ping)</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
      </div>

      <div>
        <label class="hud-label text-dim block mb-1">Port</label>
        <div class="flex gap-1.5">
          <input v-model="dport" :disabled="proto === 'icmp'" placeholder="80" class="w-20 bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none font-mono disabled:opacity-40" />
          <button class="hex-clip flex-1 bg-accent text-accent-fg font-bold hud-label text-2xs px-2 py-1 hover:brightness-110 active:scale-95 transition-all" @click="runScan">
            SCAN
          </button>
        </div>
      </div>
    </div>

    <!-- Scan Results Visualizer -->
    <div v-if="scanResult" class="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
      <div class="flex items-center justify-between glass px-3 py-2 rounded-ctl border" :class="scanResult.ok ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5'">
        <div class="flex items-center gap-2">
          <component :is="scanResult.ok ? ShieldCheck : ShieldAlert" :size="18" :class="scanResult.ok ? 'text-ok' : 'text-danger'" />
          <span class="hud-label text-xs font-bold" :class="scanResult.ok ? 'text-ok' : 'text-danger'">
            STATUS: {{ scanResult.finalStatus }}
          </span>
        </div>
        <span v-if="scanResult.error" class="text-2xs font-mono text-danger">{{ scanResult.error }}</span>
      </div>

      <div class="flex flex-col gap-3">
        <div v-for="(hop, idx) in scanResult.hops" :key="hop.hop" class="glass border border-line/80 rounded-ctl p-3 flex flex-col gap-2 relative scanlines">
          <!-- Hop Header -->
          <div class="flex items-center justify-between border-b border-line/50 pb-2">
            <div class="flex items-center gap-2">
              <span class="hud-label text-2xs bg-accent/10 border border-accent/30 text-accent px-1.5 py-0.5 rounded-ctl">
                HOP {{ hop.hop }}
              </span>
              <component :is="devIcon(hop.devType)" :size="15" class="text-muted" />
              <span class="font-bold text-xs text-fg">{{ hop.devName }}</span>
            </div>
            <div class="text-2xs font-mono text-dim flex items-center gap-2">
              <span>SRC: {{ hop.srcIp }}</span>
              <ArrowRight :size="10" />
              <span>DST: {{ hop.dstIp }}</span>
            </div>
          </div>

          <!-- Chain Evaluations -->
          <div class="grid grid-cols-1 gap-1.5 pl-2">
            <div v-for="(chain, cIdx) in hop.chains" :key="cIdx" class="flex flex-col text-2xs font-mono p-1.5 rounded bg-panel/60 border border-line/40">
              <div class="flex items-center justify-between">
                <span class="hud-label text-[10px] text-accent font-semibold">{{ chain.chain }}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border" :class="chainBadgeClass(chain.action)">
                  {{ chain.action }}
                </span>
              </div>
              <p class="text-muted mt-1 text-[11px] leading-snug">{{ chain.detail }}</p>
              <div v-if="chain.matchedRule" class="mt-1 text-[10px] text-accent/80 font-mono bg-panel-2 px-1.5 py-0.5 rounded border border-accent/20">
                MATCH: {{ chain.matchedRule }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
