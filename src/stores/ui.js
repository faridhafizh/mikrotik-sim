import { defineStore } from 'pinia'
import { zoomAt, boundsOf, fitView } from '../zoom'

let seq = 0
let resolveModal = null

const SUITS = ['power', 'armor', 'cloak']
const SUIT_PANEL = { power: 'lab', armor: 'monitor', cloak: 'lab' }

export const useUi = defineStore('ui', {
  state: () => {
    const savedSuit = localStorage.getItem('ml.suit')
    const savedMuted = localStorage.getItem('ml.muted')
    const seen = !!localStorage.getItem('ml.seen')
    const narrow = window.matchMedia?.('(max-width: 1023px)')?.matches ?? false
    return {
      zoom: 1, pan: { x: 0, y: 0 }, viewport: { w: 0, h: 0 },
      suit: SUITS.includes(savedSuit) ? savedSuit : 'armor',   // 'power' | 'armor' | 'cloak'
      muted: savedMuted === '1',
      booted: seen,
      panel: 'lab',                       // 'lab' | 'akun'
      sideOpen: !(window.matchMedia?.('(max-width: 900px)')?.matches ?? false),
      termH: narrow ? Math.min(260, Math.round(window.innerHeight * 0.4)) : 260,
      termMin: false,
      menu: null,                         // { x, y, devId } | null
      modal: null,                        // { kind, ... , value } | null
      toasts: [],                         // [{ id, text, kind }]
      welcome: !localStorage.getItem('ml.seen'),
      focusTerm: 0,                       // penanda permintaan fokus ke input terminal
      canvasEl: null,                     // elemen <svg>, diisi TopologyCanvas
      paletteOpen: false
    }
  },
  actions: {
    setViewport(w, h) { this.viewport = { w, h } },
    applyZoom(factor, screen) {
      const r = zoomAt(this.zoom, this.pan, screen, factor)
      this.zoom = r.zoom
      this.pan = r.pan
    },
    zoomBy(factor) { this.applyZoom(factor, { x: this.viewport.w / 2, y: this.viewport.h / 2 }) },
    resetView() { this.zoom = 1; this.pan = { x: 0, y: 0 } },
    fitToContent(devices, notes) {
      const b = boundsOf(devices, notes)
      if (!b) return this.resetView()
      const v = fitView(b, this.viewport.w, this.viewport.h)
      this.zoom = v.zoom
      this.pan = v.pan
    },
    notify(text, kind = 'info') {
      const id = ++seq
      this.toasts.push({ id, text, kind })
      setTimeout(() => this.dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    dismiss(id) { this.toasts = this.toasts.filter(t => t.id !== id) },
    openMenu(spec) { this.menu = spec },
    closeMenu() { this.menu = null },
    openModal(spec) { this.modal = { kind: 'help', ...spec } },
    focusTerminal() { this.termMin = false; this.focusTerm++ },
    ask(spec) {
      this.modal = { kind: 'confirm', confirm: 'Hapus', cancel: 'Batal', danger: true, ...spec }
      return new Promise(res => { resolveModal = res })
    },
    askText(spec) {
      this.modal = { kind: 'text', value: '', placeholder: '', max: 80, error: '', ...spec }
      return new Promise(res => { resolveModal = res })
    },
    answer(value) {
      const r = resolveModal
      resolveModal = null
      this.modal = null
      if (r) r(value)
    },
    setSuit(m) {
      if (!SUITS.includes(m) || m === this.suit) return
      this.suit = m
      localStorage.setItem('ml.suit', m)
      const p = SUIT_PANEL[m]
      if (p) this.panel = p
      this.notify(`Maximum ${m.toUpperCase()} engaged`)
    },
    toggleMute() {
      this.muted = !this.muted
      localStorage.setItem('ml.muted', this.muted ? '1' : '0')
    },
    markBooted() {
      localStorage.setItem('ml.seen', '1')
      this.welcome = false
      this.booted = true
    },
    seenWelcome() { localStorage.setItem('ml.seen', '1'); this.welcome = false; this.booted = true },
    setTermH(h) { this.termH = Math.max(140, Math.min(Math.round(h), Math.round(0.6 * window.innerHeight))) },
    toggleTerm() { this.termMin = !this.termMin },
    togglePalette() { this.paletteOpen = !this.paletteOpen }
  }
})
