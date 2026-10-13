<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useNet } from './stores/net'
import { useUi } from './stores/ui'
import { confirmRemove, confirmRemoveNote } from './actions'
import AppTopBar from './components/AppTopBar.vue'
import DeviceRail from './components/DeviceRail.vue'
import TopologyCanvas from './components/TopologyCanvas.vue'
import TerminalDock from './components/TerminalDock.vue'
import DeviceInspector from './components/DeviceInspector.vue'
import SidePanel from './components/SidePanel.vue'
import ToastHost from './components/ToastHost.vue'
import ModalHost from './components/ModalHost.vue'
import CommandPalette from './components/CommandPalette.vue'
import ContextMenu from './components/ContextMenu.vue'
import WelcomeOverlay from './components/WelcomeOverlay.vue'
import GuidedTour from './components/GuidedTour.vue'

const net = useNet(), ui = useUi()

function onKey(e) {
  if (e.key === 'Escape') {
    if (ui.paletteOpen) { ui.paletteOpen = false; return }
    if (!ui.modal) {
      ui.closeMenu(); ui.answer(false); net.from = null; net.traceOverlay = null
      if (net.tool === 'note') net.tool = 'select'
      return
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.togglePalette(); return }
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || ui.modal) return
  if (!e.ctrlKey && !e.metaKey) {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); ui.zoomBy(1.25) }
    else if (e.key === '-') { e.preventDefault(); ui.zoomBy(1 / 1.25) }
    else if (e.key === '0') { e.preventDefault(); ui.resetView() }
    else if (e.key.toLowerCase() === 'f') { e.preventDefault(); ui.fitToContent(net.devices, net.notes) }
    else if (e.key === 'Delete' && net.selectedNote && net.notes[net.selectedNote]) { e.preventDefault(); confirmRemoveNote(net.selectedNote) }
    else if (e.key === 'Delete' && net.selected) { e.preventDefault(); confirmRemove(net.selected) }
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); net.tool = 'note'; net.from = null; net.selected = null; net.selectedNote = null }
    return
  }
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); net.undo() }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); net.redo() }
}

onMounted(() => {
  net.seed()
  net.boot()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="h-dvh flex flex-col overflow-hidden bg-canvas text-fg" :data-suit="ui.suit" :class="ui.booted ? 'visor-booted' : null">
    <AppTopBar />
    <div class="flex-1 flex flex-col lg:flex-row min-h-0 relative">
      <DeviceRail />
      <main class="flex-1 min-w-0 flex flex-col">
        <div class="relative flex-1 min-h-0 flex flex-col overflow-hidden">
          <!-- scanlines overlay -->
          <div class="scanlines absolute! inset-0 z-10 pointer-events-none" aria-hidden="true"></div>
          <!-- corner brackets -->
          <span class="pointer-events-none absolute z-10 top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent opacity-70" aria-hidden="true"></span>
          <span class="pointer-events-none absolute z-10 top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent opacity-70" aria-hidden="true"></span>
          <span class="pointer-events-none absolute z-10 bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent opacity-70" aria-hidden="true"></span>
          <span class="pointer-events-none absolute z-10 bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent opacity-70" aria-hidden="true"></span>
          <!-- suit status strip -->
          <div class="pointer-events-none absolute z-20 top-0 left-1/2 -translate-x-1/2">
            <span class="hud-label glass hex-clip block border border-accent/40 text-accent px-3 py-1 whitespace-nowrap">MAXIMUM {{ ui.suit.toUpperCase() }}</span>
          </div>
          <TopologyCanvas class="flex-1 min-h-0" />
        </div>
        <TerminalDock v-if="net.selected && net.devices[net.selected]" />
      </main>
      <div v-if="ui.sideOpen" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="ui.sideOpen = false"></div>
      <aside class="shrink-0 border-line bg-chrome overflow-y-auto flex flex-col gap-3 p-3
        fixed inset-x-0 bottom-0 z-30 max-h-[85dvh] rounded-t-panel border-t transition-transform
        lg:static lg:z-auto lg:max-h-none lg:rounded-none lg:border-l lg:w-[320px]"
        :class="ui.sideOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0 lg:hidden'" aria-label="Panel samping">
        <DeviceInspector v-if="net.selected && net.devices[net.selected]" />
        <SidePanel />
      </aside>
    </div>
    <ToastHost />
    <ModalHost />
    <CommandPalette />
    <ContextMenu />
    <WelcomeOverlay />
    <GuidedTour />
  </div>
</template>
