<script setup>
import { ref } from 'vue'
import { CircleCheck, CircleX, Plus, Trash2, Download, Upload, Play, Edit, ShieldCheck, Wifi, Radio, Router } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { beep } from '../suitAudio'

const net = useNet()
const ui = useUi()

const mode = ref('list') // 'list' | 'builder'
const busy = ref(false)

// Custom Mission Editor State
const editId = ref('')
const title = ref('')
const desc = ref('')
const objectives = ref([])

function resetForm() {
  editId.value = ''
  title.value = ''
  desc.value = ''
  objectives.value = [
    { type: 'ping', target: '10.0.0.1', label: 'Ping Reachability to 10.0.0.1' }
  ]
}

function addObjective() {
  objectives.value.push({ type: 'ping', target: '', label: '' })
}

function removeObjective(idx) {
  objectives.value.splice(idx, 1)
}

function startNewMission() {
  resetForm()
  mode.value = 'builder'
}

function editCustomMission(m) {
  editId.value = m.id
  title.value = m.title
  desc.value = m.desc
  objectives.value = JSON.parse(JSON.stringify(m.objectives || []))
  mode.value = 'builder'
}

function saveMission() {
  if (!title.value.trim()) {
    ui.notify('Mission title required', 'error')
    return
  }
  const id = editId.value || 'custom-' + Date.now()
  const customLab = {
    id,
    title: title.value.trim(),
    desc: desc.value.trim() || 'Custom created mission parameters.',
    custom: true,
    objectives: objectives.value.map(o => ({
      ...o,
      label: o.label || `${o.type.toUpperCase()}: ${o.target || 'Check'}`
    })),
    seed: net.snap()
  }

  net.addCustomLab(customLab)
  ui.notify('Mission saved!', 'success')
  beep('confirm')
  mode.value = 'list'
}

function deleteMission(id) {
  net.removeCustomLab(id)
  ui.notify('Custom mission deleted', 'info')
}

function exportMission(l) {
  const data = JSON.stringify(l, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `mission-${l.id}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

function importMissionFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = evt => {
    try {
      const parsed = JSON.parse(evt.target.result)
      if (parsed.title && parsed.objectives) {
        net.addCustomLab({ ...parsed, custom: true })
        ui.notify('Mission imported successfully!', 'success')
      } else {
        ui.notify('Invalid mission file format', 'error')
      }
    } catch {
      ui.notify('Failed to parse JSON', 'error')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function check(id) {
  busy.value = true
  try {
    const passed = await net.checkLab(id)
    if (passed) beep('confirm')
  } finally {
    busy.value = false
  }
}

const tally = l => {
  const r = net.results[l.id] || []
  return r.length ? `${r.filter(x => x.ok).length}/${r.length} objectives cleared` : ''
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Header Controls -->
    <div class="flex items-center justify-between border-b border-line pb-2">
      <div class="flex items-center gap-1.5">
        <ShieldCheck :size="16" class="text-accent" />
        <span class="hud-label text-xs text-accent">TACTICAL MISSIONS</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button v-if="mode === 'list'" class="hex-clip px-2 py-1 bg-accent/20 border border-accent/40 text-accent hover:bg-accent text-2xs font-semibold flex items-center gap-1" @click="startNewMission">
          <Plus :size="12" />Create Mission
        </button>
        <label v-if="mode === 'list'" class="hex-clip px-2 py-1 glass border border-line text-muted hover:text-fg text-2xs cursor-pointer flex items-center gap-1">
          <Upload :size="12" />Import
          <input type="file" accept=".json" class="hidden" @change="importMissionFile" />
        </label>
        <button v-if="mode === 'builder'" class="hex-clip px-2 py-1 glass border border-line text-muted hover:text-fg text-2xs" @click="mode = 'list'">
          Cancel
        </button>
      </div>
    </div>

    <!-- Builder Mode -->
    <div v-if="mode === 'builder'" class="glass border border-accent/40 rounded-ctl p-3 flex flex-col gap-3 scanlines">
      <h3 class="hud-label text-xs text-accent">MISSION CREATOR // PARAMETERS</h3>

      <div>
        <label class="hud-label text-2xs text-dim block mb-1">Mission Title</label>
        <input v-model="title" placeholder="e.g. OSPF Dual-Area Setup" class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none" />
      </div>

      <div>
        <label class="hud-label text-2xs text-dim block mb-1">Briefing / Description</label>

        <textarea v-model="desc" rows="2" placeholder="Brief explanation of the mission..." class="w-full bg-panel-2 border border-line rounded-ctl px-2 py-1 text-xs text-fg focus:border-accent outline-none"></textarea>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="hud-label text-2xs text-accent">Auto-Grader Objectives</span>
          <button class="text-2xs text-accent hover:underline flex items-center gap-1" @click="addObjective">
            <Plus :size="12" /> Add Objective
          </button>
        </div>

        <div v-for="(obj, idx) in objectives" :key="idx" class="flex flex-wrap items-center gap-2 p-2 bg-panel/80 border border-line rounded-ctl">
          <select v-model="obj.type" class="bg-panel-2 border border-line text-xs rounded px-1.5 py-0.5 text-fg">
            <option value="ping">Ping Reachability</option>
            <option value="ifaceIp">Interface IP Check</option>
            <option value="route">Route Check</option>
            <option value="fw">Firewall Rule Check</option>
          </select>

          <input v-model="obj.target" placeholder="Target (e.g. 10.0.0.1 or R1:192.168.1.1/24)" class="flex-1 bg-panel-2 border border-line text-xs rounded px-2 py-0.5 text-fg font-mono" />

          <button class="text-danger hover:text-red-400 p-1" @click="removeObjective(idx)">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-line">
        <button class="hex-clip px-3 py-1 bg-accent text-accent-fg font-bold text-2xs hover:brightness-110" @click="saveMission">
          SAVE MISSION
        </button>
      </div>
    </div>

    <!-- Mission List Mode -->
    <div v-else class="flex flex-col gap-2">
      <div v-for="(l, i) in net.labs" :key="l.id" class="relative glass border rounded-ctl p-2.5 cursor-pointer"
        :class="net.activeLab === l.id ? 'border-accent suit-glow' : 'border-line'" :aria-current="net.activeLab === l.id ? 'true' : 'false'"
        @click="net.activeLab = l.id">
        <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r pointer-events-none" :class="net.activeLab === l.id ? 'border-accent' : 'border-line-strong'" aria-hidden="true"></span>

        <div class="flex items-center gap-2">
          <span class="hud-label text-2xs text-accent font-mono">{{ i + 1 }}</span>
          <b class="text-[13px] flex-1">{{ l.title }}</b>
          <span v-if="l.custom" class="hud-label text-[9px] bg-accent/20 border border-accent/40 text-accent px-1 rounded">CUSTOM</span>
          <CircleCheck v-if="net.done.includes(l.id)" :size="15" class="text-ok shrink-0" />
        </div>

        <template v-if="net.activeLab === l.id">
          <p class="mt-1.5 text-[12px] text-muted leading-relaxed">{{ l.desc }}</p>

          <div class="mt-2 flex flex-wrap items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5">
              <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click.stop="net.seedLab(l)">Load Initial Topology</button>
              <button class="hex-clip px-2 py-1 rounded-ctl bg-accent text-accent-fg text-2xs font-semibold disabled:opacity-50" :disabled="busy" @click.stop="check(l.id)">
                {{ busy ? 'Evaluating…' : 'Run Auto-Grader' }}
              </button>
            </div>

            <div v-if="l.custom" class="flex items-center gap-1">
              <button class="text-dim hover:text-fg p-1" title="Export Mission JSON" @click.stop="exportMission(l)"><Download :size="13" /></button>
              <button class="text-dim hover:text-fg p-1" title="Edit Mission" @click.stop="editCustomMission(l)"><Edit :size="13" /></button>
              <button class="text-danger hover:text-red-400 p-1" title="Delete Mission" @click.stop="deleteMission(l.id)"><Trash2 :size="13" /></button>
            </div>
          </div>

          <p v-if="net.results[l.id]" class="mt-2 text-2xs text-muted">{{ tally(l) }}</p>
          <ul v-if="net.results[l.id]" class="mt-1 flex flex-col gap-1">
            <li v-for="r in net.results[l.id]" :key="r.label" class="flex items-start gap-1.5 text-[12px]">
              <component :is="r.ok ? CircleCheck : CircleX" :size="13" class="mt-0.5 shrink-0" :class="r.ok ? 'text-ok' : 'text-danger'" />
              <span :class="r.ok ? 'text-muted' : 'text-fg'">{{ r.label }}</span>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </div>
</template>
