import { defineStore } from 'pinia'
import { GUIDE_STEPS } from '../guide'

// Mode pemula/ahli + tur singkat. Persist memakai localStorage (sama seperti WelcomeOverlay).
export const useGuide = defineStore('guide', {
  state: () => ({
    mode: localStorage.getItem('ml.mode') || 'guided',   // 'guided' | 'expert'
    steps: GUIDE_STEPS,
    step: 0,
    tourOpen: (localStorage.getItem('ml.mode') || 'guided') === 'guided' && !localStorage.getItem('ml.seen')
  }),
  actions: {
    setMode(m) {
      this.mode = m === 'expert' ? 'expert' : 'guided'
      localStorage.setItem('ml.mode', this.mode)
      if (this.mode === 'guided') this.reopen()
    },
    next() { this.step < this.steps.length - 1 ? this.step++ : this.finish() },
    prev() { if (this.step > 0) this.step-- },
    finish() { this.tourOpen = false },
    reopen() { this.step = 0; this.tourOpen = true }
  }
})
