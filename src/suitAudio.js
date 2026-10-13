// Nanosuit 2.0 Visor Tactical Acoustic Feedback & Voice System
let audioCtx = null

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (AudioCtx) {
      audioCtx = new AudioCtx()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playVoiceMessage(text) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.pitch = 0.65
      utterance.rate = 1.05
      utterance.volume = 0.95
      const voices = window.speechSynthesis.getVoices()
      const engVoice = voices.find(v => v.lang.startsWith('en'))
      if (engVoice) utterance.voice = engVoice
      window.speechSynthesis.speak(utterance)
    } catch {
      // Speech synthesis fallback
    }
  }
}

export function playSuitModeAudio(mode) {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  if (mode === 'armor') {
    // Maximum Armor - Cyan Heavy Resonant Frequency Burst
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.3)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
    osc.start(now)
    osc.stop(now + 0.35)
    playVoiceMessage('Maximum Armor')
  } else if (mode === 'power') {
    // Maximum Power - Orange High Energy Pulse Burst
    osc.type = 'square'
    osc.frequency.setValueAtTime(300, now)
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.25)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc.start(now)
    osc.stop(now + 0.3)
    playVoiceMessage('Maximum Power')
  } else if (mode === 'cloak') {
    // Stealth Cloak Engaged - Low Frequency Phase Modulated Sine Sweep
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, now)
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.4)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
    osc.start(now)
    osc.stop(now + 0.4)
    playVoiceMessage('Cloak Engaged')
  } else {
    // Boot Calibration Sequence
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.setValueAtTime(880, now + 0.1)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
    osc.start(now)
    osc.stop(now + 0.25)
  }
}

export function beep(kind = 'confirm') {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  if (kind === 'alert' || kind === 'error') {
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(220, now)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    osc.start(now)
    osc.stop(now + 0.2)
  } else {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, now)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    osc.start(now)
    osc.stop(now + 0.1)
  }
}
