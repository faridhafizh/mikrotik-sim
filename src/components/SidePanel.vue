<script setup>
import { X, Send, Activity } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import LabPane from './LabPane.vue'
import AccountPane from './AccountPane.vue'
import FleetPane from './FleetPane.vue'
import MonitoringPane from './MonitoringPane.vue'
import HistoryPane from './HistoryPane.vue'

const net = useNet(), ui = useUi()
const TABS = [
  { id: 'lab', label: 'MODUL LAB', Icon: null },
  { id: 'fleet', label: 'ARMADA', Icon: Send },
  { id: 'monitor', label: 'MONITORING', Icon: Activity }
]
const tab = id => ({ role: 'tab', 'aria-selected': String(ui.panel === id), 'aria-controls': 'panel-body' })
const TAB_CLS = 'relative flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-2xs font-semibold transition-colors'
const active = id => ui.panel === id ? `${TAB_CLS} border-accent bg-accent/15 text-accent shadow-xs` : `${TAB_CLS} border-line text-muted bg-panel-2/40 hover:bg-panel-2 hover:text-fg`
</script>

<template>
  <div class="flex flex-col gap-3" id="side-panel">
    <div class="flex items-center gap-1.5" role="tablist" aria-label="Panel samping">
      <button v-bind="tab('lab')" :class="active('lab')" @click="ui.panel = 'lab'">
        LAB{{ net.done.length ? ` (${net.done.length})` : '' }}
      </button>
      <button v-for="t in TABS.slice(1)" :key="t.id" v-bind="tab(t.id)" :class="active(t.id)" @click="ui.panel = t.id">
        <component :is="t.Icon" :size="13" />{{ t.label }}
      </button>
      <button v-bind="tab('akun')" :class="active('akun')" :title="net.user || 'Akun'" @click="ui.panel = 'akun'">
        <span class="truncate max-w-[5rem]">{{ net.user || 'AKUN' }}</span>
      </button>
      <button class="lg:hidden p-1.5 rounded-md text-muted hover:bg-panel-2 shrink-0" aria-label="Tutup panel" title="Tutup panel" @click="ui.sideOpen = false">
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
