// Nanosuit HUD beeps — best-effort only; silent no-op when muted, no gesture yet,
// or when the browser refuses the AudioContext (autoplay policy).
import { useUi } from './stores/ui'

let ctx = null

function audio() {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) {
    try { ctx = new AudioContext() } catch { return null }
  }
  if (ctx.state === 'suspended') {
    // Autoplay policy: only a user gesture can resume; never throw for audio.
    ctx.resume().catch(() => {})
  }
  return ctx.state === 'running' ? ctx : null
}

function tone({ type = 'sine', from = 880, to = from, ms = 60, gain = 0.04 }) {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  if (to !== from) osc.frequency.linearRampToValueAtTime(to, t0 + ms / 1000)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + ms / 1000 + 0.02)
}

const KINDS = {
  open: () => tone({ from: 880, ms: 60 }),
  confirm: () => tone({ from: 1320, ms: 50 }),
  error: () => tone({ type: 'triangle', from: 180, ms: 120 }),
  mode: () => tone({ from: 660, to: 990, ms: 140 })
}

export function beep(kind = 'confirm') {
  try {
    if (useUi().muted) return
    const k = KINDS[kind] || KINDS.confirm
    k()
  } catch { /* audio is decoration; never surface errors */ }
}
