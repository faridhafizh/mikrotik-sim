import { defineStore } from 'pinia'
import { zoomAt, boundsOf, fitView } from '../zoom'

let seq = 0
let resolveModal = null

export const useUi = defineStore('ui', {
  state: () => {
    const savedTheme = localStorage.getItem('ml.theme')
    const savedMuted = localStorage.getItem('ml.muted')
    const seen = !!localStorage.getItem('ml.seen')
    const narrow = window.matchMedia?.('(max-width: 1023px)')?.matches ?? false
    const theme = savedTheme === 'light' ? 'light' : 'dark'

    // Set initial data-theme attribute on documentElement
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }

    return {
      zoom: 1, pan: { x: 0, y: 0 }, viewport: { w: 0, h: 0 },
      theme,                               // 'dark' | 'light'
      suit: 'armor',                       // fallback property for backward compatibility
      muted: savedMuted === '1',
      booted: seen,
      panel: 'lab',                        // 'lab' | 'fleet' | 'monitor' | 'akun'
      sideOpen: !(window.matchMedia?.('(max-width: 900px)')?.matches ?? false),
      termH: narrow ? Math.min(260, Math.round(window.innerHeight * 0.4)) : 260,
      termMin: false,
      menu: null,                          // { x, y, devId } | null
      modal: null,                         // { kind, ... , value } | null
      toasts: [],                          // [{ id, text, kind }]
      welcome: !localStorage.getItem('ml.seen'),
      focusTerm: 0,                        // penanda permintaan fokus ke input terminal
      canvasEl: null,                      // elemen <svg>, diisi TopologyCanvas
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
    setTheme(mode) {
      this.theme = mode === 'light' ? 'light' : 'dark'
      localStorage.setItem('ml.theme', this.theme)
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', this.theme)
      }
      this.notify(`Mode tampilan diubah ke ${this.theme === 'light' ? 'Terang' : 'Gelap'}`)
    },
    toggleTheme() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    setSuit(m) {
      // Legacy suit setter compatibility
      this.suit = m || 'armor'
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
