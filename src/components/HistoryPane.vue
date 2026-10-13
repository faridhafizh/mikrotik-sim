<script setup>
import { computed } from 'vue'
import { History, RotateCcw } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { timeAgo } from '../versions'

const net = useNet()
const can = computed(() => !!net.token && !!net.curId)
const items = computed(() => net.versions)
</script>

<template>
  <section class="glass border border-line rounded-panel p-3 flex flex-col gap-2 relative" aria-label="Riwayat versi">
    <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-line-strong pointer-events-none" aria-hidden="true"></span>
    <header class="flex items-center gap-2">
      <History :size="15" class="text-accent" />
      <b class="hud-label text-[13px] text-accent">Riwayat perubahan</b>
      <span class="ml-auto text-2xs text-dim">{{ items.length }} versi</span>
    </header>
    <p v-if="!net.token" class="text-[12px] text-dim leading-relaxed">Masuk akun agar setiap penyimpanan tercatat sebagai versi yang bisa dipulihkan.</p>
    <p v-else-if="!net.curId" class="text-[12px] text-dim leading-relaxed">Simpan topologi ini ke server dulu; setiap Simpan berikutnya tercatat di sini.</p>
    <p v-else-if="!items.length" class="text-[12px] text-dim leading-relaxed">Belum ada versi. Tekan Simpan untuk mencatat versi pertama.</p>
    <ul v-else class="flex flex-col gap-1">
      <li v-for="v in items" :key="v.ver" class="flex items-center gap-2 border border-line rounded-ctl px-2 py-1.5">
        <span class="font-mono text-2xs text-accent w-9 shrink-0">v{{ v.ver }}</span>
        <span class="flex-1 flex flex-col leading-tight min-w-0">
          <span class="text-[12px] truncate">{{ v.summary || 'perubahan' }}</span>
          <span class="text-2xs text-dim">{{ timeAgo(v.ts) }}</span>
        </span>
        <button class="hex-clip shrink-0 p-1 rounded-ctl text-muted hover:bg-panel-2"
          :title="'Pulihkan versi ' + v.ver" :aria-label="'Pulihkan versi ' + v.ver" @click="net.restoreVersion(v.ver)">
          <RotateCcw :size="14" />
        </button>
      </li>
    </ul>
  </section>
</template>
