<script setup>
import { X, Send, Activity, History } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import LabPane from './LabPane.vue'
import AccountPane from './AccountPane.vue'
import FleetPane from './FleetPane.vue'
import MonitoringPane from './MonitoringPane.vue'
import HistoryPane from './HistoryPane.vue'

const net = useNet(), ui = useUi()
const TABS = [
  { id: 'lab', label: 'LAB', Icon: null },
  { id: 'fleet', label: 'FLEET', Icon: Send },
  { id: 'monitor', label: 'MONITOR', Icon: Activity }
]
const tab = id => ({ role: 'tab', 'aria-selected': String(ui.panel === id), 'aria-controls': 'panel-body' })
const TAB_CLS = 'relative flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-ctl hex-clip border hud-label text-[11px]'
const active = id => ui.panel === id ? `${TAB_CLS} border-accent text-accent suit-glow bg-panel-2` : `${TAB_CLS} border-line text-muted hover:bg-panel-2`
</script>

<template>
  <div class="flex flex-col gap-3" id="side-panel">
    <div class="flex items-center gap-1" role="tablist" aria-label="Panel samping">
      <button v-bind="tab('lab')" :class="active('lab')" @click="ui.panel = 'lab'">
        Lab{{ net.done.length ? ` (${net.done.length})` : '' }}
        <span v-if="ui.panel === 'lab'" class="absolute left-2 right-2 -bottom-px h-0.5 bg-accent rounded-pill" aria-hidden="true"></span>
      </button>
      <button v-for="t in TABS.slice(1)" :key="t.id" v-bind="tab(t.id)" :class="active(t.id)" @click="ui.panel = t.id">
        <component :is="t.Icon" :size="13" />{{ t.label }}
        <span v-if="ui.panel === t.id" class="absolute left-2 right-2 -bottom-px h-0.5 bg-accent rounded-pill" aria-hidden="true"></span>
      </button>
      <button v-bind="tab('akun')" :class="active('akun')" :title="net.user || 'Akun'" @click="ui.panel = 'akun'">
        <span class="truncate max-w-[5rem]">{{ net.user || 'Akun' }}</span>
        <span v-if="ui.panel === 'akun'" class="absolute left-2 right-2 -bottom-px h-0.5 bg-accent rounded-pill" aria-hidden="true"></span>
      </button>
      <button class="lg:hidden p-1.5 rounded-ctl text-muted hover:bg-panel-2 shrink-0" aria-label="Tutup panel" title="Tutup panel" @click="ui.sideOpen = false">
        <X :size="16" />
      </button>
    </div>
    <div id="panel-body" role="tabpanel" class="flex flex-col gap-3">
      <LabPane v-if="ui.panel === 'lab'" />
      <FleetPane v-else-if="ui.panel === 'fleet'" />
      <MonitoringPane v-else-if="ui.panel === 'monitor'" />
      <AccountPane v-else />
      <HistoryPane v-if="net.token && (net.curId || net.versions.length)" />
    </div>
  </div>
</template>
