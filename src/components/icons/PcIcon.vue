<script setup>
defineProps({
  size: { type: [Number, String], default: 48 },
  color: { type: String, default: 'var(--color-fg)' }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="pc-icon">
    <defs>
      <linearGradient id="pc-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-panel-2, #1e293b)" />
        <stop offset="100%" stop-color="var(--color-chrome, #0f172a)" />
      </linearGradient>
      <linearGradient id="pc-screen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <!-- Monitor Unit -->
    <!-- Monitor Bezel Frame -->
    <rect x="4" y="10" width="38" height="28" rx="3" fill="url(#pc-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Monitor Display Glass -->
    <rect x="7" y="13" width="32" height="22" rx="1.5" fill="url(#pc-screen)" stroke="var(--color-line)" stroke-width="0.8" />

    <!-- Screen Terminal Simulation Lines -->
    <path d="M 10 17 L 16 17" stroke="var(--color-ok)" stroke-width="1.2" stroke-linecap="round" />
    <path d="M 10 21 L 28 21" stroke="var(--color-muted)" stroke-width="1" stroke-linecap="round" opacity="0.8" />
    <path d="M 10 25 L 22 25" stroke="var(--color-muted)" stroke-width="1" stroke-linecap="round" opacity="0.8" />
    <path d="M 10 29 L 26 29" stroke="var(--color-accent-soft)" stroke-width="1" stroke-linecap="round" opacity="0.8" />

    <!-- Monitor Power LED -->
    <circle cx="23" cy="36.5" r="0.8" fill="var(--color-ok)" />

    <!-- Monitor Stand Arm -->
    <path d="M 21 38 L 25 38 L 26 47 L 20 47 Z" fill="var(--color-line-strong)" stroke="var(--color-line)" stroke-width="0.8" />

    <!-- Monitor Stand Base -->
    <ellipse cx="23" cy="48" rx="10" ry="2.5" fill="url(#pc-body)" stroke="var(--color-line-strong)" stroke-width="1.2" />

    <!-- Desktop PC Tower Case (Right Side) -->
    <rect x="44" y="14" width="16" height="34" rx="3" fill="url(#pc-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Tower Power Button -->
    <circle cx="52" cy="19" r="1.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <circle cx="52" cy="19" r="0.8" fill="var(--color-ok)" />

    <!-- Front USB Ports & Audio Jack -->
    <rect x="49" y="23" width="6" height="1.5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <rect x="49" y="26" width="6" height="1.5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />

    <!-- Vertical RGB Glow Strip / Accent Line -->
    <line x1="47" y1="30" x2="47" y2="44" :stroke="color" stroke-width="1.2" stroke-linecap="round" opacity="0.85" />

    <!-- Lower Vent Intake Slits -->
    <line x1="50" y1="33" x2="56" y2="33" stroke="var(--color-line)" stroke-width="0.8" />
    <line x1="50" y1="36" x2="56" y2="36" stroke="var(--color-line)" stroke-width="0.8" />
    <line x1="50" y1="39" x2="56" y2="39" stroke="var(--color-line)" stroke-width="0.8" />
    <line x1="50" y1="42" x2="56" y2="42" stroke="var(--color-line)" stroke-width="0.8" />
  </svg>
</template>
