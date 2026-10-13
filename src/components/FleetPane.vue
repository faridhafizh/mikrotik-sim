<script setup>
import { computed } from 'vue'
import { Play, ListChecks } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useFleet } from '../stores/fleet'
import { LABEL_OF } from '../catalog'

const net = useNet(), fleet = useFleet()
const devs = computed(() => Object.values(net.devices))
const selCount = computed(() => fleet.sel.length)
const preview = computed(() => fleet.preview())

function run() {
  if (!selCount.value) return net.note('Pilih minimal satu perangkat', 'error')
  const r = fleet.run(net)
  if (r?.skipped) return net.note('Variabel belum lengkap: ' + fleet.missing.join(', '), 'error')
  net.note(`Skrip dijalankan di ${r.count} perangkat` + (r.changed ? '' : ' — tanpa perubahan konfigurasi'), r.changed ? 'success' : 'info')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p class="text-[12px] text-dim leading-relaxed">
      Jalankan perintah yang sama ke banyak perangkat. Tulis <code class="font-mono text-accent">{{var}}</code> di skrip, lalu isi nilainya di bagian Variabel.
    </p>

    <div class="flex flex-wrap items-center gap-1.5">
      <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="fleet.routers(net)">Semua router</button>
      <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="fleet.all(net)">Semua</button>
      <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="fleet.clear()">Kosongkan</button>
      <span class="ml-auto text-2xs text-dim">{{ selCount }} dipilih</span>
    </div>

    <div class="border border-line rounded-ctl max-h-[132px] overflow-y-auto flex flex-col">
      <label v-for="d in devs" :key="d.id"
        class="flex items-center gap-2 px-2 py-1.5 text-[12px] cursor-pointer hover:bg-panel-2 border-b border-line last:border-b-0">
        <input type="checkbox" :checked="fleet.sel.includes(d.id)" class="accent-[#ffbf47]" :aria-label="'Pilih ' + d.name" @change="fleet.toggle(d.id)" />
        <span class="flex-1 truncate">{{ d.name }}</span>
        <span class="text-2xs text-dim">{{ LABEL_OF[d.type] }}</span>
      </label>
      <p v-if="!devs.length" class="px-2 py-2 text-2xs text-dim">Kanvas masih kosong.</p>
    </div>

    <label class="flex flex-col gap-1">
      <span class="hud-label text-2xs text-accent">Skrip (satu perintah per baris, # komentar)</span>
      <textarea v-model="fleet.script" rows="4" spellcheck="false"
        class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg outline-none focus:border-accent" />
    </label>

    <label class="flex flex-col gap-1">
      <span class="hud-label text-2xs text-accent">Variabel (key=value per baris)</span>
      <textarea v-model="fleet.varsText" rows="2" spellcheck="false"
        class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg outline-none focus:border-accent" />
    </label>

    <p v-if="preview.missing.length" class="text-2xs text-danger">Variabel tanpa nilai: {{ preview.missing.join(', ') }}</p>

    <div class="flex items-center gap-1.5">
      <button class="hex-clip flex items-center gap-1 px-2.5 py-1.5 rounded-ctl bg-accent text-accent-fg text-2xs font-semibold disabled:opacity-40"
        :disabled="!selCount || fleet.busy" @click="run">
        <Play :size="13" />{{ fleet.busy ? 'Menjalankan…' : 'Jalankan' }}
      </button>
      <span class="text-2xs text-dim">Skrip efektif (dry-run) tampil di bawah</span>
    </div>

    <pre class="border border-line rounded-ctl p-2 text-[10px] font-mono text-dim whitespace-pre-wrap leading-relaxed">{{ preview.script || '—' }}</pre>

    <div v-if="fleet.results.length" class="flex flex-col gap-1.5">
      <b class="hud-label text-2xs text-accent flex items-center gap-1"><ListChecks :size="13" />Hasil</b>
      <div v-for="r in fleet.results" :key="r.id" class="relative glass border border-line rounded-ctl p-2">
        <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-line-strong pointer-events-none" aria-hidden="true"></span>
        <div class="flex items-center gap-1.5 text-[12px]">
          <span class="font-semibold truncate">{{ r.name }}</span>
          <span class="text-2xs" :class="r.ok ? 'text-ok' : 'text-danger'">{{ r.ok ? 'ok' : 'ada error' }}</span>
          <span v-if="r.changed" class="ml-auto shrink-0 text-2xs text-dim">konfigurasi berubah</span>
        </div>
        <pre v-if="r.lines.length" class="mt-1 max-h-[120px] overflow-y-auto text-[10px] font-mono text-dim whitespace-pre-wrap leading-relaxed">{{ r.lines.join('\n') }}</pre>
      </div>
    </div>
  </div>
</template>
