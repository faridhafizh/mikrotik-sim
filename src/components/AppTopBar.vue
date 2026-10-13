<script setup>
import { ref, nextTick, computed } from 'vue'
import { Undo2, Redo2, Save, Upload, Download, ImageDown, CircleQuestionMark, ZoomIn, ZoomOut, Frame, CircleDot, PanelRight, User, ShieldCheck, GraduationCap, Rocket, Zap } from 'lucide-vue-next'
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
const status = computed(() => net.dirty ? 'BELUM DISIMPAN' : net.curId ? 'TERSIMPAN' : 'TOPOLOGI BARU')

async function png() {
  const p = net.packet
  net.packet = null
  await nextTick()
  try { await toPng(ui.canvasEl); ui.notify('Gambar diekspor', 'success') }
  catch { ui.notify('Ekspor gambar gagal di browser ini', 'error') }
  finally { net.packet = p }
}
function pick(e) { net.importFile(e.target.files[0]); e.target.value = '' }
function help() { ui.openModal({ kind: 'help', title: 'Bantuan & Pintasan Sistem' }) }
function openFirewallFlow() {
  ui.openModal({
    kind: 'firewallFlow',
    title: 'ANALISIS ALUR FIREWALL',
    srcDevId: net.curId || Object.keys(net.devices)[0]
  })
}
function account() { ui.panel = 'akun'; ui.sideOpen = true }
const btn = 'flex items-center gap-1.5 px-2.5 py-1 text-2xs text-muted hover:bg-panel-2 hover:text-fg hover:border-line-strong disabled:opacity-40 shrink-0 rounded-md border border-line transition-colors'
</script>

<template>
  <header class="h-14 shrink-0 flex items-center gap-3 px-3.5 border-b border-line bg-chrome overflow-x-auto shadow-sm">
    <!-- Government NOC Branding -->
    <div class="flex items-center gap-2.5 shrink-0">
      <div class="w-8 h-8 rounded-lg bg-accent/15 border border-accent/40 text-accent grid place-items-center shrink-0">
        <ShieldCheck :size="18" aria-hidden="true" />
      </div>
      <div class="flex flex-col leading-none gap-1 whitespace-nowrap">
        <b class="text-[14px] font-bold leading-none tracking-wide text-fg">PUSAT OPERASI JARINGAN</b>
        <span class="hud-label text-dim text-[10px] leading-none">Simulasi RouterOS // MikroLab</span>
      </div>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <!-- Undo / Redo -->
    <div class="flex items-center gap-1 shrink-0">
      <button :class="btn" :disabled="!net.past.length" title="Urungkan (Ctrl+Z)" aria-label="Urungkan" @click="net.undo()"><Undo2 :size="14" /></button>
      <button :class="btn" :disabled="!net.future.length" title="Ulangi (Ctrl+Y)" aria-label="Ulangi" @click="net.redo()"><Redo2 :size="14" /></button>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <!-- Actions -->
    <div class="flex items-center gap-1 shrink-0">
      <button :class="btn" :disabled="!net.dirty" title="Simpan Topologi" aria-label="Simpan" @click="net.save()"><Save :size="14" /><span class="hidden lg:inline font-medium">Simpan</span></button>
      <button :class="btn" title="Impor Berkas JSON" aria-label="Impor JSON" @click="fileInput.click()"><Upload :size="14" /><span class="hidden lg:inline font-medium">Impor</span></button>
      <button :class="btn" title="Ekspor Berkas JSON" aria-label="Ekspor JSON" @click="net.exportFile()"><Download :size="14" /><span class="hidden lg:inline font-medium">Ekspor</span></button>
      <button :class="btn" title="Ekspor Gambar PNG" aria-label="Ekspor PNG" @click="png"><ImageDown :size="14" /><span class="hidden lg:inline font-medium">PNG</span></button>
      <button :class="btn" title="Analisis Alur Firewall" aria-label="Analisis Firewall" @click="openFirewallFlow"><Zap :size="14" /><span class="hidden lg:inline font-medium text-accent">Analisis Firewall</span></button>
      <button :class="btn" title="Bantuan System" aria-label="Bantuan" @click="help"><CircleQuestionMark :size="14" /></button>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <!-- Status Badge -->
    <span class="hud-label flex items-center gap-1.5 text-2xs shrink-0 whitespace-nowrap font-medium" :class="net.dirty ? 'text-amber-500' : 'text-dim'" :title="status">
      <CircleDot :size="11" />{{ status }}
    </span>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <!-- Theme Switcher -->
    <SuitModeSwitcher />

    <!-- Zoom & View controls -->
    <div class="ml-auto flex items-center gap-1 shrink-0">
      <button :class="btn" :title="guide.mode === 'guided' ? 'Mode pemula: perintah lanjutan disembunyikan. Klik untuk pindah ke mode ahli.' : 'Mode ahli: semua perintah tampil. Klik untuk pindah ke mode pemula.'"
        :aria-pressed="guide.mode === 'guided'" @click="guide.setMode(guide.mode === 'guided' ? 'expert' : 'guided')">
        <component :is="guide.mode === 'guided' ? GraduationCap : Rocket" :size="14" />
        <span class="hidden lg:inline font-medium">{{ guide.mode === 'guided' ? 'Pemula' : 'Ahli' }}</span>
      </button>
      <button :class="btn" :title="guide.mode === 'guided' ? 'Ulangi tur panduan' : 'Tur panduan hanya di mode pemula'" :disabled="guide.mode !== 'guided'" @click="guide.reopen()">
        <CircleQuestionMark :size="14" /><span class="hidden lg:inline font-medium">Tur</span>
      </button>
      <button :class="btn" title="Perkecil" aria-label="Perkecil" @click="ui.zoomBy(1 / 1.25)"><ZoomOut :size="14" /></button>
      <span class="hidden lg:inline text-[12px] font-mono tabular-nums text-muted w-[42px] text-center shrink-0" aria-live="off">{{ zoomPct }}</span>
      <button :class="btn" title="Perbesar" aria-label="Perbesar" @click="ui.zoomBy(1.25)"><ZoomIn :size="14" /></button>
      <button :class="btn" title="Muat seluruh topologi" aria-label="Muat seluruh topologi" @click="ui.fitToContent(net.devices, net.notes)"><Frame :size="14" /></button>
      <button :class="btn" title="Reset tampilan" aria-label="Reset tampilan" @click="ui.resetView()"><span class="font-mono">100%</span></button>
    </div>

    <span class="w-px h-6 bg-line shrink-0"></span>

    <!-- Backend status dot -->
    <span class="flex items-center gap-1.5 text-2xs text-muted shrink-0" :title="api.title" :aria-label="api.title">
      <span class="w-2 h-2 rounded-full" :class="api.dot"></span>
    </span>

    <!-- Panel & Account -->
    <button :class="btn" :aria-pressed="ui.sideOpen" title="Panel Kontrol" aria-label="Panel" @click="ui.sideOpen = !ui.sideOpen">
      <PanelRight :size="14" /><span class="hidden lg:inline font-medium">Panel</span>
    </button>
    <button :class="btn" title="Akun Operator" aria-label="Akun" @click="account">
      <User :size="14" /><span class="hidden lg:inline font-medium">{{ net.user || 'Masuk' }}</span>
    </button>

    <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="pick" />
  </header>
</template>
