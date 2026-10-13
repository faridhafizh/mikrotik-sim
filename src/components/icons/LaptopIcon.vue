<script setup>
defineProps({
  size: { type: [Number, String], default: 48 },
  color: { type: String, default: 'var(--color-wifi)' }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="laptop-icon">
    <defs>
      <linearGradient id="lp-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-panel-2, #1e293b)" />
        <stop offset="100%" stop-color="var(--color-chrome, #0f172a)" />
      </linearGradient>
      <linearGradient id="lp-screen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <!-- Upper Display Lid -->
    <rect x="10" y="10" width="44" height="30" rx="3" fill="url(#lp-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Screen Bezel & Display Glass -->
    <rect x="13" y="13" width="38" height="24" rx="1.5" fill="url(#lp-screen)" stroke="var(--color-line)" stroke-width="0.8" />

    <!-- Webcam Dot -->
    <circle cx="32" cy="11.5" r="0.8" fill="var(--color-line-strong)" />

    <!-- Display Screen Terminal Content -->
    <path d="M 16 17 L 22 17" stroke="var(--color-wifi)" stroke-width="1.2" stroke-linecap="round" />
    <path d="M 16 21 L 36 21" stroke="var(--color-muted)" stroke-width="1" stroke-linecap="round" opacity="0.8" />
    <path d="M 16 25 L 30 25" stroke="var(--color-muted)" stroke-width="1" stroke-linecap="round" opacity="0.8" />
    <path d="M 16 29 L 38 29" stroke="var(--color-accent-soft)" stroke-width="1" stroke-linecap="round" opacity="0.8" />

    <!-- Wireless Wi-Fi Waves Overlay (Upper Right Screen) -->
    <path d="M 42 16 C 44 14 47 14 49 16" :stroke="color" stroke-width="1.2" stroke-linecap="round" />
    <path d="M 43.5 18.5 C 44.5 17.5 46.5 17.5 47.5 18.5" :stroke="color" stroke-width="1.2" stroke-linecap="round" />
    <circle cx="45.5" cy="20.5" r="0.8" :fill="color" />

    <!-- Laptop Hinge Base Bar -->
    <rect x="12" y="39" width="40" height="3" rx="1" fill="var(--color-line-strong)" />

    <!-- Lower Laptop Base Deck (Keyboard & Touchpad) -->
    <path d="M 6 42 L 58 42 L 54 52 C 53.5 53.5 52 54 50 54 L 14 54 C 12 54 10.5 53.5 10 52 Z" fill="url(#lp-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Keyboard Area Cutout -->
    <polygon points="12,44 52,44 50,49 14,49" fill="#090d16" stroke="var(--color-line)" stroke-width="0.8" />

    <!-- Keyboard Keys Grid Lines -->
    <line x1="16" y1="46" x2="48" y2="46" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="20" y1="44" x2="19" y2="49" stroke="var(--color-line-strong)" stroke-width="0.6" />
    <line x1="26" y1="44" x2="25" y2="49" stroke="var(--color-line-strong)" stroke-width="0.6" />
    <line x1="32" y1="44" x2="32" y2="49" stroke="var(--color-line-strong)" stroke-width="0.6" />
    <line x1="38" y1="44" x2="39" y2="49" stroke="var(--color-line-strong)" stroke-width="0.6" />
    <line x1="44" y1="44" x2="45" y2="49" stroke="var(--color-line-strong)" stroke-width="0.6" />

    <!-- Trackpad -->
    <rect x="28" y="50" width="8" height="3" rx="0.5" fill="none" stroke="var(--color-line-strong)" stroke-width="0.8" />
  </svg>
</template>
