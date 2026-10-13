<script setup>
import { ref } from 'vue'
import { CircleCheck, CircleX } from 'lucide-vue-next'
import { useNet } from '../stores/net'

const net = useNet()
const busy = ref(false)

async function check(id) {
  busy.value = true
  try { await net.checkLab(id) } finally { busy.value = false }
}
const tally = l => {
  const r = net.results[l.id] || []
  return r.length ? `${r.filter(x => x.ok).length}/${r.length} syarat terpenuhi` : ''
}
const stepOpen = ref({})
const toggleStep = (lid, i) => { stepOpen.value[lid + i] = !stepOpen.value[lid + i] }
const stepDone = (() => { try { return JSON.parse(localStorage.getItem('ml.stepdone') || '{}') } catch { return {} } })()
const stepTally = (lid, i) => {
  const s = (net.stepResults[lid] || [])[i]
  if (!s) return ''
  return `${s.results.filter(x => x.ok).length}/${s.results.length}`
}
const stepAllOk = (lid, i) => { const s = (net.stepResults[lid] || [])[i]; return s && s.results.every(x => x.ok) }
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(l, i) in net.labs" :key="l.id" class="relative glass border rounded-ctl p-2.5 cursor-pointer"
      :class="net.activeLab === l.id ? 'border-accent suit-glow' : 'border-line'" :aria-current="net.activeLab === l.id ? 'true' : 'false'"
      @click="net.activeLab = l.id">
      <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r pointer-events-none" :class="net.activeLab === l.id ? 'border-accent' : 'border-line-strong'" aria-hidden="true"></span>
      <div class="flex items-center gap-2">
        <span class="hud-label text-2xs text-accent font-mono">{{ i + 1 }}</span>
        <b class="text-[13px] flex-1">{{ l.title }}</b>
        <CircleCheck v-if="net.done.includes(l.id)" :size="15" class="text-ok shrink-0" />
      </div>
      <template v-if="net.activeLab === l.id">
        <p class="mt-1.5 text-[12px] text-muted leading-relaxed">{{ l.desc }}</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click.stop="net.seedLab(l)">Muat topologi awal</button>
          <button class="hex-clip px-2 py-1 rounded-ctl bg-accent text-accent-fg text-2xs font-semibold disabled:opacity-50" :disabled="busy" @click.stop="check(l.id)">
            {{ busy ? 'Memeriksa…' : 'Periksa jawaban' }}
          </button>
        </div>
        <p v-if="net.results[l.id]" class="mt-2 text-2xs text-muted">{{ tally(l) }}</p>
        <ul v-if="net.results[l.id]" class="mt-1 flex flex-col gap-1">
          <li v-for="r in net.results[l.id]" :key="r.label" class="flex items-start gap-1.5 text-[12px]">
            <component :is="r.ok ? CircleCheck : CircleX" :size="13" class="mt-0.5 shrink-0" :class="r.ok ? 'text-ok' : 'text-danger'" />
            <span :class="r.ok ? 'text-muted' : 'text-fg'">{{ r.label }}</span>
          </li>
        </ul>
        <div v-if="l.steps?.length" class="mt-3 flex flex-col gap-1.5">
          <div v-for="(s, i) in l.steps" :key="i" class="border border-line rounded-ctl p-2" @click.stop>
            <div class="flex items-center gap-2 cursor-pointer" @click.stop="toggleStep(l.id, i)">
              <span class="text-2xs text-dim font-mono">{{ i + 1 }}.</span>
              <b class="text-[12px] flex-1">{{ s.title }}</b>
              <span v-if="stepTally(l.id, i)" class="text-2xs text-muted font-mono">{{ stepTally(l.id, i) }}</span>
              <CircleCheck v-if="stepAllOk(l.id, i) || (stepDone[l.id] ?? 0) > i" :size="13" class="text-ok" />
            </div>
            <template v-if="stepOpen[l.id + i]">
              <pre class="mt-1.5 whitespace-pre-wrap text-[11px] text-dim font-mono leading-relaxed">{{ s.hint }}</pre>
              <ul class="mt-1 flex flex-col gap-0.5">
                <li v-for="r in (net.stepResults[l.id] || [])[i]?.results || []" :key="r.label" class="flex items-start gap-1.5 text-[11px]">
                  <component :is="r.ok ? CircleCheck : CircleX" :size="12" class="mt-0.5 shrink-0" :class="r.ok ? 'text-ok' : 'text-danger'" />
                  <span :class="r.ok ? 'text-muted' : 'text-fg'">{{ r.label }}</span>
                </li>
              </ul>
              <button class="hex-clip mt-1.5 px-2 py-0.5 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" :disabled="busy" @click.stop="check(l.id)">Cek langkah {{ i + 1 }}</button>
            </template>
          </div>
        </div>
      </template>
    </div>

    <div v-if="!net.labs.length" class="flex flex-col gap-2">
      <p class="text-[12px] text-dim leading-relaxed">
        {{ net.api === 'down' ? 'Backend belum aktif. Jalankan pnpm dev:api lalu muat ulang.' : 'Belum ada lab tersedia.' }}
      </p>
      <button v-if="net.api !== 'down'" class="self-start px-2.5 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="net.boot()">Coba lagi</button>
    </div>
  </div>
</template>
