<script setup>
defineProps({
  size: { type: [Number, String], default: 48 },
  color: { type: String, default: 'var(--color-info)' }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="router-icon">
    <defs>
      <linearGradient id="rt-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-panel-2, #1e293b)" />
        <stop offset="100%" stop-color="var(--color-chrome, #0f172a)" />
      </linearGradient>
      <linearGradient id="rt-top" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" :stop-color="color" stop-opacity="0.8" />
        <stop offset="100%" :stop-color="color" stop-opacity="0.3" />
      </linearGradient>
      <linearGradient id="rt-panel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#090d16" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#1e293b" stop-opacity="0.9" />
      </linearGradient>
      <filter id="rt-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Antennas -->
    <!-- Left Antenna -->
    <path d="M 16 28 L 16 10 C 16 8.5 17.5 7 19 7 C 20.5 7 22 8.5 22 10 L 22 28" fill="url(#rt-body)" stroke="var(--color-line-strong)" stroke-width="1.2" />
    <circle cx="19" cy="7" r="2" fill="url(#rt-top)" />
    <!-- Right Antenna -->
    <path d="M 42 28 L 42 10 C 42 8.5 43.5 7 45 7 C 46.5 7 48 8.5 48 10 L 48 28" fill="url(#rt-body)" stroke="var(--color-line-strong)" stroke-width="1.2" />
    <circle cx="45" cy="7" r="2" fill="url(#rt-top)" />

    <!-- Antenna Waves -->
    <path d="M 13 10 C 10 13 10 17 13 20" stroke="var(--color-wifi)" stroke-width="1.2" stroke-linecap="round" opacity="0.75" />
    <path d="M 51 10 C 54 13 54 17 51 20" stroke="var(--color-wifi)" stroke-width="1.2" stroke-linecap="round" opacity="0.75" />

    <!-- Main Chassis -->
    <rect x="6" y="26" width="52" height="26" rx="5" fill="url(#rt-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Top Accent Bar -->
    <rect x="8" y="27" width="48" height="3" rx="1.5" fill="url(#rt-top)" />

    <!-- Front Bezel / Interface Panel -->
    <rect x="10" y="34" width="44" height="14" rx="3" fill="url(#rt-panel)" stroke="var(--color-line)" stroke-width="1" />

    <!-- Ethernet Ports (5 Ports) -->
    <!-- Port 1 -->
    <rect x="13" y="37" width="5" height="8" rx="1" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="14" y1="42" x2="17" y2="42" stroke="var(--color-muted)" stroke-width="0.8" />
    <!-- Port 2 -->
    <rect x="20" y="37" width="5" height="8" rx="1" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="21" y1="42" x2="24" y2="42" stroke="var(--color-muted)" stroke-width="0.8" />
    <!-- Port 3 -->
    <rect x="27" y="37" width="5" height="8" rx="1" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="28" y1="42" x2="31" y2="42" stroke="var(--color-muted)" stroke-width="0.8" />
    <!-- Port 4 -->
    <rect x="34" y="37" width="5" height="8" rx="1" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="35" y1="42" x2="38" y2="42" stroke="var(--color-muted)" stroke-width="0.8" />
    <!-- Port 5 (WAN / Internet) -->
    <rect x="41" y="37" width="5" height="8" rx="1" fill="#0f172a" :stroke="color" stroke-width="0.9" />
    <line x1="42" y1="42" x2="45" y2="42" :stroke="color" stroke-width="0.8" />

    <!-- Status LEDs (Right Side) -->
    <circle cx="49" cy="38" r="1.2" fill="var(--color-ok)" filter="url(#rt-glow)" />
    <circle cx="49" cy="41" r="1.2" :fill="color" />
    <circle cx="49" cy="44" r="1.2" fill="var(--color-ok)" />

    <!-- Rubber Feet -->
    <rect x="12" y="52" width="6" height="2" rx="1" fill="var(--color-line-strong)" />
    <rect x="46" y="52" width="6" height="2" rx="1" fill="var(--color-line-strong)" />
  </svg>
</template>
