<script setup>
import { ShieldCheck, Network, Zap, GraduationCap, ArrowRight } from 'lucide-vue-next'
import { useUi } from '../stores/ui'
import { useGuide } from '../stores/guide'

const ui = useUi(), guide = useGuide()

function initiate() { ui.markBooted(); guide.reopen() }
function skip() { ui.markBooted(); guide.finish() }
</script>

<template>
  <div v-if="ui.welcome" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-md grid place-items-center p-4">
    <div class="relative w-[min(560px,calc(100vw-2rem))] bg-chrome border border-line rounded-2xl p-6 shadow-2xl">
      <div class="flex items-center gap-3 border-b border-line pb-4">
        <div class="w-10 h-10 rounded-xl bg-accent/15 border border-accent/40 text-accent grid place-items-center shrink-0">
          <ShieldCheck :size="22" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-fg leading-tight">PUSAT OPERASI JARINGAN</h2>
          <p class="text-xs text-muted">Selamat Datang di Sistem Simulasi RouterOS MikroLab</p>
        </div>
      </div>

      <div class="my-5 space-y-3">
        <div class="flex gap-3 p-3 rounded-lg bg-panel-2/60 border border-line/60">
          <Network :size="20" class="text-accent shrink-0 mt-0.5" />
          <div class="text-xs">
            <b class="text-fg font-semibold block mb-0.5">Simulasi RouterOS Real-Time</b>
            <span class="text-muted leading-relaxed">Rancang topologi L2/L3, atur IP address, rute statis/dynamic OSPF, VLAN trunking, dan uji CLI RouterOS secara langsung.</span>
          </div>
        </div>

        <div class="flex gap-3 p-3 rounded-lg bg-panel-2/60 border border-line/60">
          <Zap :size="20" class="text-accent shrink-0 mt-0.5" />
          <div class="text-xs">
            <b class="text-fg font-semibold block mb-0.5">Analisis Firewall & Packet Flow</b>
            <span class="text-muted leading-relaxed">Visualisasikan lintasan paket data hop-by-hop melalui tabel NAT, Filter Rule, Prerouting, dan Forwarding.</span>
          </div>
        </div>

        <div class="flex gap-3 p-3 rounded-lg bg-panel-2/60 border border-line/60">
          <GraduationCap :size="20" class="text-accent shrink-0 mt-0.5" />
          <div class="text-xs">
            <b class="text-fg font-semibold block mb-0.5">Laboratorium & Modul Misi Praktis</b>
            <span class="text-muted leading-relaxed">Selesaikan tantangan simulasi jaringan interaktif dengan verifikasi objektif otomatis.</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2">
        <button
          class="text-xs text-muted hover:text-fg underline-offset-4 hover:underline transition-colors px-1"
          @click="skip"
        >Langsung Ke Kanvas</button>

        <button
          class="flex items-center gap-2 px-5 py-2 bg-accent text-accent-fg rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
          @click="initiate"
        >
          <span>Mulai Tur Panduan</span>
          <ArrowRight :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
