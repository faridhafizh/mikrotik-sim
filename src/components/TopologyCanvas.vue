<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { wifiLinks } from '../engine'
import { NOTE_COLORS } from '../zoom'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { confirmRemove, confirmRemoveNote } from '../actions'
import { TEMPLATES } from '../templates.js'
import { routeCable, groupLinks, pairKey, cubicPoint } from '../cables.js'
import { CABLE_TYPES, linkStatus, speedLabel } from '../linkmodel.js'
import DeviceNode from './DeviceNode.vue'
import NoteNode from './NoteNode.vue'

const net = useNet(), ui = useUi()
const root = ref(null), svg = ref(null)
const drag = ref(null), panDrag = ref(null)
const noteDraft = ref(null), noteDrag = ref(null)
watch(() => net.tool, () => { noteDraft.value = null; noteDrag.value = null })
const motionReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const world = computed(() => `translate(${ui.pan.x},${ui.pan.y}) scale(${ui.zoom})`)
// transform grid hanya di pattern luar; pattern dalam (grid-sm) diwarisi transformnya
const gridT = computed(() => `translate(${ui.pan.x} ${ui.pan.y}) scale(${ui.zoom})`)
const devices = computed(() => Object.values(net.devices))
const wifi = computed(() => wifiLinks({ devices: net.devices }))
const wifiClients = id => wifi.value.filter(w => w.ap === id).length
const pkt = computed(() => net.packet?.ok ? 'var(--suit-accent)' : 'var(--color-danger)')

const MEDIUM_STROKE = { copper: 'var(--color-cable)', fiber: 'var(--color-wifi)' }
const cables = computed(() => {
  const groups = groupLinks(net.links)
  return net.links.map(l => {
    const a = net.devices[l.a.dev], b = net.devices[l.b.dev]
    if (!a || !b) return null
    const g = groups.get(pairKey(l.a.dev, l.b.dev))
    const sel = net.selected === l.a.dev || net.selected === l.b.dev
    const c = routeCable(a, b, net.devices, g.indexOf(l), g.length, wobble[l.a.dev], wobble[l.b.dev])
    const st = linkStatus({ devices: net.devices }, l)
    const ct = CABLE_TYPES[l.cable] || CABLE_TYPES.cat6
    const down = !st.up
    return {
      l, d: c.d, la: c.la, lb: c.lb, down, medium: ct.medium,
      stroke: down ? 'var(--color-danger)' : sel ? 'var(--suit-accent)' : (MEDIUM_STROKE[ct.medium] || 'var(--color-cable)'),
      flowOp: down ? 0.25 : sel ? 0.8 : 0.55,
      mid: cubicPoint(c.p0, c.p1, c.p2, c.p3, 0.5),
      label: down ? (st.reason === 'port disabled' ? 'DOWN · disabled' : 'DOWN') : `${ct.short} · ${speedLabel(st.speed)}`
    }
  }).filter(Boolean)
})

const pktPos = ref({ x: 0, y: 0 })
let pktRaf = 0, lastHop = null
const cableEls = new Map()
function setCableEl(c, el) {
  const k = c.l.a.dev + c.l.a.if + c.l.b.dev + c.l.b.if
  if (el) cableEls.set(k, el); else cableEls.delete(k)
}
function stopPkt() { cancelAnimationFrame(pktRaf); pktRaf = 0 }
function animatePkt(fromPos, toPos, pathEl, reverse) {
  stopPkt()
  const lerpTo = e => ({ x: fromPos.x + (toPos.x - fromPos.x) * e, y: fromPos.y + (toPos.y - fromPos.y) * e })
  if (motionReduced() || !fromPos) { pktPos.value = { ...toPos }; return }
  const t0 = performance.now()
  const step = now => {
    const tt = Math.min(1, (now - t0) / 420)
    const e = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2
    if (pathEl) {
      try {
        const len = pathEl.getTotalLength()
        const p = pathEl.getPointAtLength(len * (reverse ? 1 - e : e))
        pktPos.value = { x: p.x, y: p.y }
      } catch { pktPos.value = lerpTo(e) }
    } else pktPos.value = lerpTo(e)
    if (tt < 1) pktRaf = requestAnimationFrame(step)
  }
  pktRaf = requestAnimationFrame(step)
}
watch(() => net.packet, (np, prev) => {
  if (!np) { stopPkt(); lastHop = null; return }
  const to = { x: np.x, y: np.y }
  if (!prev) { pktPos.value = { ...to }; lastHop = to; return }
  const from = lastHop || { x: prev.x, y: prev.y }
  const near = p => Object.values(net.devices).find(d => Math.abs(d.x - p.x) < 0.5 && Math.abs(d.y - p.y) < 0.5)
  const fromDev = near(from), toDev = near(to)
  let el = null, reverse = false
  if (fromDev && toDev) {
    const l = net.links.find(l => (l.a.dev === fromDev.id && l.b.dev === toDev.id) || (l.a.dev === toDev.id && l.b.dev === fromDev.id))
    if (l) { el = cableEls.get(l.a.dev + l.a.if + l.b.dev + l.b.if) || null; reverse = l.a.dev === toDev.id }
  }
  animatePkt(from, to, el, reverse)
  lastHop = to
})

const pt = e => { const r = svg.value.getBoundingClientRect(); return { x: (e.clientX - r.left - ui.pan.x) / ui.zoom, y: (e.clientY - r.top - ui.pan.y) / ui.zoom } }
const draftRect = computed(() => {
  const d = noteDraft.value
  if (!d) return null
  const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1)
  return { x, y, w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) }
})
function onWheel(e) {
  e.preventDefault()
  const r = svg.value.getBoundingClientRect()
  ui.applyZoom(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), { x: e.clientX - r.left, y: e.clientY - r.top })
}
// Sentinel pointer (di luar event target) supaya gestur multi-jari tetap terlihat
// walau DeviceNode memakai @pointerdown.stop.
const pointers = new Map()
let pinch = null, downPt = null, lastTap = 0
let pressTimer = 0, press = null
const TAP_MS = 280, PRESS_MS = 500
const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0 }; press = null }
function startPinch() {
  cancelPress()
  const [a, b] = [...pointers.values()]
  pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) }
  panDrag.value = null; drag.value = null; noteDrag.value = null; noteDraft.value = null; pendingPt = null
}
function applyPinch() {
  const [a, b] = [...pointers.values()]
  const r = svg.value.getBoundingClientRect()
  const dist = Math.hypot(a.x - b.x, a.y - b.y)
  ui.applyZoom(dist / (pinch.dist || dist), { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top })
}
function onDownCapture(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) startPinch()
}
function onUpCapture(e) {
  pointers.delete(e.pointerId)
  if (pinch && pointers.size < 2) {
    pinch = null
    panDrag.value = null; drag.value = null; noteDrag.value = null; pendingPt = null
  }
  cancelPress()
}
function onDown(e) {
  downPt = { x: e.clientX, y: e.clientY }
  if (net.tool === 'note' && e.button === 0) {
    const p = pt(e)
    noteDraft.value = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
    svg.value.setPointerCapture?.(e.pointerId)
    return
  }
  if (e.button === 1 || (e.button === 0 && net.tool === 'select')) {
    panDrag.value = { sx: e.clientX, sy: e.clientY, px: ui.pan.x, py: ui.pan.y }
    svg.value.setPointerCapture?.(e.pointerId)
  }
}
const STIFF = 140, DAMP = 13, KICK = 0.35, MAXO = 28
const wobble = reactive({})
let pendingPt = null, rafOn = false, lastFrame = 0
function kickWobble(id, dx, dy) {
  if (motionReduced()) return
  const w = (wobble[id] ||= { ox: 0, oy: 0, vx: 0, vy: 0 })
  w.ox = Math.max(-MAXO, Math.min(MAXO, w.ox - dx * KICK))
  w.oy = Math.max(-MAXO, Math.min(MAXO, w.oy - dy * KICK))
}
function frame(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000); lastFrame = now
  if (drag.value && pendingPt) {
    const d = net.devices[drag.value]
    if (d) {
      const dx = pendingPt.x - d.x, dy = pendingPt.y - d.y
      Object.assign(d, pendingPt)
      pendingPt = null
      kickWobble(drag.value, dx, dy)
    }
  }
  let active = !!drag.value || !!pendingPt
  for (const id of Object.keys(wobble)) {
    const w = wobble[id]
    w.vx += (-STIFF * w.ox - DAMP * w.vx) * dt
    w.vy += (-STIFF * w.oy - DAMP * w.vy) * dt
    w.ox += w.vx * dt; w.oy += w.vy * dt
    if (!drag.value && Math.abs(w.ox) + Math.abs(w.oy) + Math.abs(w.vx) + Math.abs(w.vy) < 0.01) delete wobble[id]
    else active = true
  }
  if (active) requestAnimationFrame(frame)
  else rafOn = false
}
function pump() { if (!rafOn) { rafOn = true; lastFrame = performance.now(); requestAnimationFrame(frame) } }

function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pinch && pointers.size >= 2) { applyPinch(); return }
  if (pressTimer && downPt && Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 8) cancelPress()
  if (noteDraft.value) { const p = pt(e); noteDraft.value.x1 = p.x; noteDraft.value.y1 = p.y; return }
  if (noteDrag.value) {
    const p = pt(e), d = noteDrag.value
    if (d.mode === 'resize') net.resizeNote(d.id, d.w0 + (p.x - d.gx), d.h0 + (p.y - d.gy))
    else if (net.notes[d.id]) Object.assign(net.notes[d.id], { x: p.x - d.dx, y: p.y - d.dy })
    return
  }
  if (panDrag.value) { ui.pan = { x: panDrag.value.px + e.clientX - panDrag.value.sx, y: panDrag.value.py + e.clientY - panDrag.value.sy }; return }
  if (drag.value) { pendingPt = pt(e); pump() }
}
async function onUp(e) {
  // ketuk dua kali di latar: tampilkan seluruh topologi (praktis di ponsel)
  if (!pointers.size && e?.target?.classList?.contains('bg-hit') && net.tool === 'select') {
    const now = performance.now()
    if (now - lastTap < TAP_MS) ui.fitToContent(net.devices, net.notes)
    lastTap = now
  }
  if (noteDraft.value) {
    const d = noteDraft.value
    noteDraft.value = null
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1)
    const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0)
    if (w >= 8 && h >= 8) {
      const title = await ui.askText({ title: 'Judul catatan', label: 'Judul (boleh kosong untuk kotak polos)', value: '', max: 60, confirm: 'Buat' })
      if (title !== null) net.addNote({ title, x, y, w, h, color: NOTE_COLORS[0] })
    }
  }
  noteDrag.value = null; panDrag.value = null; drag.value = null; pendingPt = null
}
function down(e, d) {
  if (net.tool === 'link') return net.pick(d.id)
  if (net.tool === 'remove') return confirmRemove(d.id)
  if (net.tool === 'note') return
  net.commit()
  net.selected = d.id
  net.selectedNote = null
  drag.value = d.id
  pendingPt = null
  svg.value.setPointerCapture?.(e.pointerId)
  // tekan-lama (ponsel): buka menu konteks, batalkan drag
  press = { x: e.clientX, y: e.clientY, dev: d.id }
  pressTimer = setTimeout(() => {
    pressTimer = 0
    if (!press) return
    const p = press
    press = null
    drag.value = null
    pendingPt = null
    ui.openMenu({ x: p.x, y: p.y, devId: p.dev })
  }, PRESS_MS)
}
function noteDown(e, note, mode) {
  if (net.tool === 'remove') return confirmRemoveNote(note.id)
  if (net.tool === 'link' || net.tool === 'note') return
  net.commit()
  net.selected = null
  net.selectedNote = note.id
  const p = pt(e)
  noteDrag.value = mode === 'resize'
    ? { id: note.id, mode, gx: p.x, gy: p.y, w0: note.w, h0: note.h }
    : { id: note.id, mode, dx: p.x - note.x, dy: p.y - note.y }
  svg.value.setPointerCapture?.(e.pointerId)
}
function noteMenu(zn, e) { ui.openMenu({ x: e.clientX, y: e.clientY, noteId: zn.id }) }
function bgClick() {
  net.traceOverlay = null
  if (net.tool === 'select') { net.selectedNote = null; net.selected = null }
}
function menu(d, e) { ui.openMenu({ x: e.clientX, y: e.clientY, devId: d.id }) }
function onDrop(e) {
  const f = e.dataTransfer.files?.[0]
  if (f?.name.endsWith('.json')) return net.importFile(f)
  const t = e.dataTransfer.getData('t')
  if (t) { const p = pt(e); net.add(t, p.x, p.y) }
}
function measure() { const r = root.value.getBoundingClientRect(); ui.setViewport(r.width, r.height) }

let ro = null
onMounted(() => {
  svg.value.addEventListener('wheel', onWheel, { passive: false })
  // capture phase: gestur multi-jari terlihat walau node memakai @pointerdown.stop
  svg.value.addEventListener('pointerdown', onDownCapture, true)
  svg.value.addEventListener('pointerup', onUpCapture, true)
  svg.value.addEventListener('pointercancel', onUpCapture, true)
  ui.canvasEl = svg.value
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(root.value)
})
onUnmounted(() => {
  svg.value?.removeEventListener('wheel', onWheel)
  svg.value?.removeEventListener('pointerdown', onDownCapture, true)
  svg.value?.removeEventListener('pointerup', onUpCapture, true)
  svg.value?.removeEventListener('pointercancel', onUpCapture, true)
  ro?.disconnect()
  stopPkt()
})
</script>

<template>
  <div ref="root" class="relative h-full w-full overflow-hidden">
    <svg ref="svg" class="block h-full w-full touch-none select-none" role="application" aria-label="Kanvas topologi"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onUp"
      @contextmenu.prevent @dragover.prevent @drop.prevent="onDrop">
      <defs>
        <pattern id="grid-sm" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 L 0 24" stroke="var(--color-grid)" fill="none" stroke-width="1" />
        </pattern>
        <pattern id="grid-lg" width="96" height="96" patternUnits="userSpaceOnUse" :patternTransform="gridT">
          <rect width="96" height="96" fill="url(#grid-sm)" />
          <path d="M 96 0 L 0 0 L 0 96" stroke="var(--color-grid-strong)" fill="none" stroke-width="1" />
        </pattern>
        <filter id="suit-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="node-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--color-node)" stop-opacity="0.95" />
          <stop offset="1" stop-color="var(--color-panel-2)" stop-opacity="0.9" />
        </linearGradient>
      </defs>

      <rect width="100%" height="100%" fill="var(--color-canvas)" class="bg-hit" @click="bgClick" />
      <rect width="100%" height="100%" fill="url(#grid-lg)" class="bg-hit" @click="bgClick" />

      <g :transform="world">
        <g v-for="c in cables" :key="c.l.a.dev + c.l.a.if + c.l.b.dev + c.l.b.if + c.l.cable">
          <path :d="c.d" class="cable-base" :ref="el => setCableEl(c, el)" :stroke="c.stroke" stroke-width="2.5" fill="none" stroke-linecap="round" :stroke-dasharray="c.down ? '6 4' : null" filter="url(#suit-glow)" />
          <path :d="c.d" class="cable-flow" pointer-events="none" stroke="var(--color-fg)" :opacity="c.flowOp" stroke-width="1.4" fill="none" stroke-dasharray="2 10" />
          <text :x="c.la.x" :y="c.la.y" fill="var(--suit-accent)" font-family="var(--font-mono)" font-size="10" font-weight="600" text-anchor="middle" paint-order="stroke" stroke="var(--color-canvas)" stroke-width="3">{{ c.l.a.if }}</text>
          <text :x="c.lb.x" :y="c.lb.y" fill="var(--suit-accent)" font-family="var(--font-mono)" font-size="10" font-weight="600" text-anchor="middle" paint-order="stroke" stroke="var(--color-canvas)" stroke-width="3">{{ c.l.b.if }}</text>
          <text :x="c.mid.x" :y="c.mid.y" :fill="c.down ? 'var(--color-danger)' : (MEDIUM_STROKE[c.medium] || 'var(--color-cable)')" font-family="var(--font-mono)" font-size="9" text-anchor="middle" paint-order="stroke" stroke="var(--color-canvas)" stroke-width="3">{{ c.label }}</text>
        </g>

        <g v-for="w in wifi" :key="w.ap + w.cl">
          <line class="wifi-flow" :x1="net.devices[w.ap].x" :y1="net.devices[w.ap].y" :x2="net.devices[w.cl].x" :y2="net.devices[w.cl].y" stroke="var(--color-wifi)" stroke-width="2" />
          <text :x="(net.devices[w.ap].x + net.devices[w.cl].x) / 2" :y="(net.devices[w.ap].y + net.devices[w.cl].y) / 2 - 8"
            fill="var(--color-wifi)" font-family="var(--font-mono)" font-size="10" text-anchor="middle" paint-order="stroke" stroke="var(--color-canvas)" stroke-width="3">{{ w.dbm }} dBm</text>
        </g>

        <NoteNode v-for="zn in Object.values(net.notes)" :key="zn.id" :note="zn" :selected="net.selectedNote === zn.id"
          @move.stop="noteDown($event, zn, 'move')" @resize.stop="noteDown($event, zn, 'resize')"
          @select="net.selectedNote = zn.id" @delete="confirmRemoveNote(zn.id)" @context="noteMenu(zn, $event)" />

        <DeviceNode v-for="d in devices" :key="d.id" :dev="d" :links="net.links" :wifi-count="wifiClients(d.id)"
          :selected="net.selected === d.id" :linking="net.from === d.id"
          @pointerdown.stop="down($event, d)" @select="net.selected = d.id" @delete="confirmRemove(d.id)" @context="menu(d, $event)" />

        <g v-if="net.packet" data-packet :transform="`translate(${pktPos.x},${pktPos.y})`" style="pointer-events:none">
          <circle r="14" :fill="pkt" opacity="0.3" />
          <circle r="6" :fill="pkt" stroke="var(--color-fg)" stroke-width="2" />
        </g>

        <g v-if="net.traceOverlay" style="pointer-events:none">
          <line v-for="(id, i) in net.traceOverlay.path.slice(1)" :key="'ov' + i"
            :x1="net.devices[net.traceOverlay.path[i]]?.x" :y1="net.devices[net.traceOverlay.path[i]]?.y"
            :x2="net.devices[id]?.x" :y2="net.devices[id]?.y"
            :stroke="net.traceOverlay.ok ? 'var(--suit-accent)' : 'var(--color-danger)'" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" opacity="0.85" />
          <circle v-for="(id, i) in net.traceOverlay.path" :key="'ovp' + i"
            :cx="net.devices[id]?.x" :cy="net.devices[id]?.y" r="9"
            :fill="net.traceOverlay.ok ? 'var(--suit-accent)' : 'var(--color-danger)'" stroke="var(--color-fg)" stroke-width="2" />
          <text v-for="(id, i) in net.traceOverlay.path" :key="'ovt' + i"
            :x="net.devices[id]?.x" :y="net.devices[id]?.y + 3.5" fill="var(--color-accent-fg)" font-size="10" font-weight="700" text-anchor="middle" font-family="var(--font-mono)">{{ i + 1 }}</text>
        </g>
        <rect v-if="draftRect" :x="draftRect.x" :y="draftRect.y" :width="draftRect.w" :height="draftRect.h"
          fill="var(--suit-accent)" fill-opacity="0.08" stroke="var(--suit-accent)" stroke-width="1.5" stroke-dasharray="6 4" style="pointer-events:none" />
      </g>
    </svg>

    <div v-if="net.tool === 'note'" class="absolute top-3 left-1/2 -translate-x-1/2 glass hud-label border border-line rounded-pill px-3 py-1.5 text-2xs text-muted">
      Tarik kotak di area kosong, lalu isi judul. Esc untuk selesai.
    </div>

    <div v-if="net.tool === 'link'" class="absolute top-3 left-1/2 -translate-x-1/2 glass hud-label border border-line rounded-pill px-3 py-1.5 text-2xs text-muted">
      {{ net.from ? 'Klik perangkat tujuan. Esc untuk batal.' : 'Klik perangkat pertama untuk mulai menghubungkan.' }}
    </div>

    <div v-if="!devices.length" class="absolute inset-0 grid place-items-center pointer-events-none">
      <div class="pointer-events-auto glass hex-clip border border-line-strong p-6 text-center flex flex-col items-center gap-2">
        <b class="hud-label text-[13px] text-accent">NO TACTICAL DATA // DEPLOY UNITS</b>
        <p class="text-[12px] text-muted">Tarik perangkat dari rail kiri ke kanvas.</p>
        <button class="hex-clip bg-accent text-accent-fg px-3 py-1.5 text-2xs font-semibold hud-label" @click="net.add('router', (ui.viewport.w / 2 - ui.pan.x) / ui.zoom, (ui.viewport.h / 2 - ui.pan.y) / ui.zoom)">Deploy router</button>
        <button class="px-2.5 py-1.5 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="net.seed(true)">Muat contoh topologi</button>
        <div class="flex gap-1.5 mt-1 flex-wrap justify-center">
          <button v-for="t in TEMPLATES" :key="t.id" :title="t.desc" class="px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="net.applyTemplate(t.id)">{{ t.title }}</button>
        </div>
      </div>
    </div>

    <div class="absolute bottom-3 left-3 flex items-center gap-3 text-2xs text-muted">
      <span class="flex items-center gap-1.5">
        <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--color-cable)" stroke-width="2.5" stroke-linecap="round" /></svg>
        <span class="hud-label">Kabel</span>
      </span>
      <span class="flex items-center gap-1.5">
        <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--color-wifi)" stroke-width="2" stroke-dasharray="6 6" /></svg>
        <span class="hud-label">Wi-Fi</span>
      </span>
    </div>
  </div>
</template>
