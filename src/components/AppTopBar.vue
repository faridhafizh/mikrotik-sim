<script setup>
import { ref, nextTick, computed } from 'vue'
import { Undo2, Redo2, Save, Upload, Download, ImageDown, CircleQuestionMark, ZoomIn, ZoomOut, Frame, CircleDot, PanelRight, User, Router, GraduationCap, Rocket, Volume2, VolumeX, Zap } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { useGuide } from '../stores/guide'
import { toPng } from '../exporter'
import SuitModeSwitcher from './SuitModeSwitcher.vue'

const net = useNet(), ui = useUi(), guide = useGuide()
const fileInput = ref(null)

const api = computed(() => net.api === 'up'
  ? { dot: 'bg-ok', title: 'Backend aktif' }
  : net.api === 'down' ? { dot: 'bg-danger', title: 'Backend tidak aktif' } : { dot: 'bg-dim', title: 'Status backend belum diketahui' })
const zoomPct = computed(() => Math.round(ui.zoom * 100) + '%')
const status = computed(() => net.dirty ? 'UNSAVED CHANGES' : net.curId ? 'SAVED' : 'NEW TOPOLOGY')

async function png() {
  const p = net.packet
  net.packet = null
  await nextTick()
  try { await toPng(ui.canvasEl); ui.notify('Gambar diekspor', 'success') }
  catch { ui.notify('Ekspor gambar gagal di browser ini', 'error') }
  finally { net.packet = p }
}
function pick(e) { net.importFile(e.target.files[0]); e.target.value = '' }
function help() { ui.openModal({ kind: 'help', title: 'Bantuan & pintasan' }) }
function openFirewallFlow() {
  ui.openModal({
    kind: 'firewallFlow',
    title: 'TACTICAL FIREWALL SCAN',
    srcDevId: net.curId || Object.keys(net.devices)[0]
  })
}
function account() { ui.panel = 'akun'; ui.sideOpen = true }
const btn = 'flex items-center gap-1.5 px-2 py-1 text-2xs text-muted hover:bg-panel-2! hover:text-fg disabled:opacity-40 shrink-0 hex-clip glass'
</script>

<template>
  <header class="h-14 shrink-0 flex items-center gap-3 px-3 border-b border-line glass overflow-x-auto">
    <div class="flex items-center gap-2.5 shrink-0">
      <div class="hex-clip glass w-8 h-8 grid place-items-center border border-accent/45 text-accent shrink-0">
        <Router :size="17" aria-hidden="true" />
      </div>
      <div class="flex flex-col leading-none gap-1 whitespace-nowrap">
        <b class="text-[15px] font-bold leading-none tracking-wider">NANOSUIT</b>
        <span class="hud-label text-dim leading-none">// MikroLab</span>
      </div>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <div class="flex items-center gap-1 shrink-0">
      <button :class="btn" :disabled="!net.past.length" :title="'Urungkan (Ctrl+Z)'" aria-label="Urungkan" @click="net.undo()"><Undo2 :size="15" /></button>
      <button :class="btn" :disabled="!net.future.length" :title="'Ulangi (Ctrl+Y)'" aria-label="Ulangi" @click="net.redo()"><Redo2 :size="15" /></button>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <div class="flex items-center gap-1 shrink-0">
      <button :class="btn" :disabled="!net.dirty" title="Simpan" aria-label="Simpan" @click="net.save()"><Save :size="15" /><span class="hidden lg:inline hud-label">Simpan</span></button>
      <button :class="btn" title="Impor JSON" aria-label="Impor JSON" @click="fileInput.click()"><Upload :size="15" /><span class="hidden lg:inline hud-label">Impor JSON</span></button>
      <button :class="btn" title="Ekspor JSON" aria-label="Ekspor JSON" @click="net.exportFile()"><Download :size="15" /><span class="hidden lg:inline hud-label">Ekspor JSON</span></button>
      <button :class="btn" title="Ekspor PNG" aria-label="Ekspor PNG" @click="png"><ImageDown :size="15" /><span class="hidden lg:inline hud-label">Ekspor PNG</span></button>
      <button :class="btn" title="Tactical Firewall Scan" aria-label="Tactical Firewall Scan" @click="openFirewallFlow"><Zap :size="15" /><span class="hidden lg:inline hud-label text-accent">Flow Scan</span></button>
      <button :class="btn" title="Bantuan" aria-label="Bantuan" @click="help"><CircleQuestionMark :size="15" /></button>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>
    <span class="hud-label flex items-center gap-1.5 text-2xs shrink-0 whitespace-nowrap" :class="net.dirty ? 'text-accent' : 'text-dim'" :title="status">
      <CircleDot :size="12" />{{ status }}
    </span>

    <span class="w-px h-6 bg-line shrink-0"></span>
    <SuitModeSwitcher />

    <div class="ml-auto flex items-center gap-1 shrink-0">
      <button :class="btn" :title="guide.mode === 'guided' ? 'Mode pemula: perintah lanjutan disembunyikan. Klik untuk pindah ke mode ahli.' : 'Mode ahli: semua perintah tampil. Klik untuk pindah ke mode pemula.'"
        :aria-pressed="guide.mode === 'guided'" @click="guide.setMode(guide.mode === 'guided' ? 'expert' : 'guided')">
        <component :is="guide.mode === 'guided' ? GraduationCap : Rocket" :size="15" />
        <span class="hidden lg:inline hud-label">{{ guide.mode === 'guided' ? 'Pemula' : 'Ahli' }}</span>
      </button>
      <button :class="btn" :title="guide.mode === 'guided' ? 'Ulangi tur panduan' : 'Tur panduan hanya di mode pemula'" :disabled="guide.mode !== 'guided'" @click="guide.reopen()">
        <CircleQuestionMark :size="15" /><span class="hidden lg:inline hud-label">Tur</span>
      </button>
      <button :class="btn" title="Perkecil" aria-label="Perkecil" @click="ui.zoomBy(1 / 1.25)"><ZoomOut :size="15" /></button>
      <span class="hidden lg:inline text-[13px] tabular-nums text-muted w-[46px] text-center shrink-0" aria-live="off">{{ zoomPct }}</span>
      <button :class="btn" title="Perbesar" aria-label="Perbesar" @click="ui.zoomBy(1.25)"><ZoomIn :size="15" /></button>
      <button :class="btn" title="Muat seluruh topologi" aria-label="Muat seluruh topologi" @click="ui.fitToContent(net.devices, net.notes)"><Frame :size="15" /></button>
      <button :class="btn" title="Reset tampilan" aria-label="Reset tampilan" @click="ui.resetView()"><span class="font-mono">100%</span></button>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <span class="flex items-center gap-1.5 text-2xs text-muted shrink-0" :title="api.title" :aria-label="api.title">
      <span class="w-2 h-2 rounded-pill" :class="api.dot"></span>
    </span>

    <button :class="btn" :aria-pressed="ui.muted" :title="ui.muted ? 'Aktifkan suara suit' : 'Bisukan suara suit'" :aria-label="ui.muted ? 'Aktifkan suara suit' : 'Bisukan suara suit'" @click="ui.toggleMute()">
      <component :is="ui.muted ? VolumeX : Volume2" :size="15" />
    </button>
    <button :class="btn" :aria-pressed="ui.sideOpen" title="Panel" aria-label="Panel" @click="ui.sideOpen = !ui.sideOpen">
      <PanelRight :size="15" /><span class="hidden lg:inline hud-label">Panel</span>
    </button>
    <button :class="btn" title="Akun" aria-label="Akun" @click="account">
      <User :size="15" /><span class="hidden lg:inline hud-label">{{ net.user || 'Masuk' }}</span>
    </button>

    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="pick" />
  </header>
</template>
