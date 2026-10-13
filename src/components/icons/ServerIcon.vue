<script setup>
defineProps({
  size: { type: [Number, String], default: 48 },
  color: { type: String, default: 'var(--color-accent)' }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="server-icon">
    <defs>
      <linearGradient id="srv-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-panel-2, #1e293b)" />
        <stop offset="100%" stop-color="var(--color-chrome, #0f172a)" />
      </linearGradient>
      <linearGradient id="srv-bay" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="srv-top" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" :stop-color="color" stop-opacity="0.9" />
        <stop offset="100%" :stop-color="color" stop-opacity="0.3" />
      </linearGradient>
    </defs>

    <!-- Rack Ears & Handles -->
    <path d="M 3 16 L 7 16 L 7 48 L 3 48 Z" fill="var(--color-line-strong)" stroke="var(--color-line)" stroke-width="0.8" />
    <path d="M 2 24 L 5 24 L 5 40 L 2 40 Z" fill="#090d16" stroke="var(--color-line-strong)" stroke-width="0.8" />

    <path d="M 61 16 L 57 16 L 57 48 L 61 48 Z" fill="var(--color-line-strong)" stroke="var(--color-line)" stroke-width="0.8" />
    <path d="M 62 24 L 59 24 L 59 40 L 62 40 Z" fill="#090d16" stroke="var(--color-line-strong)" stroke-width="0.8" />

    <!-- Main Server Body Chassis -->
    <rect x="7" y="14" width="50" height="36" rx="4" fill="url(#srv-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Top Accent Line -->
    <rect x="9" y="15" width="46" height="2" rx="1" fill="url(#srv-top)" />

    <!-- Hot-Swap Drive Bays (Top Row & Bottom Row) -->
    <!-- Drive 1 -->
    <rect x="11" y="20" width="11" height="11" rx="1.5" fill="url(#srv-bay)" stroke="var(--color-line)" stroke-width="0.8" />
    <rect x="12" y="28" width="9" height="2" rx="0.5" stroke="var(--color-line-strong)" stroke-width="0.5" fill="#0f172a" />
    <circle cx="13" cy="22" r="0.8" fill="var(--color-ok)" />

    <!-- Drive 2 -->
    <rect x="24" y="20" width="11" height="11" rx="1.5" fill="url(#srv-bay)" stroke="var(--color-line)" stroke-width="0.8" />
    <rect x="25" y="28" width="9" height="2" rx="0.5" stroke="var(--color-line-strong)" stroke-width="0.5" fill="#0f172a" />
    <circle cx="26" cy="22" r="0.8" fill="var(--color-ok)" />

    <!-- Drive 3 -->
    <rect x="37" y="20" width="11" height="11" rx="1.5" fill="url(#srv-bay)" stroke="var(--color-line)" stroke-width="0.8" />
    <rect x="38" y="28" width="9" height="2" rx="0.5" stroke="var(--color-line-strong)" stroke-width="0.5" fill="#0f172a" />
    <circle cx="39" cy="22" r="0.8" fill="var(--color-ok)" />

    <!-- Drive 4 -->
    <rect x="11" y="33" width="11" height="11" rx="1.5" fill="url(#srv-bay)" stroke="var(--color-line)" stroke-width="0.8" />
    <rect x="12" y="41" width="9" height="2" rx="0.5" stroke="var(--color-line-strong)" stroke-width="0.5" fill="#0f172a" />
    <circle cx="13" cy="35" r="0.8" fill="var(--color-ok)" />

    <!-- Drive 5 -->
    <rect x="24" y="33" width="11" height="11" rx="1.5" fill="url(#srv-bay)" stroke="var(--color-line)" stroke-width="0.8" />
    <rect x="25" y="41" width="9" height="2" rx="0.5" stroke="var(--color-line-strong)" stroke-width="0.5" fill="#0f172a" />
    <circle cx="26" cy="35" r="0.8" fill="var(--color-ok)" />

    <!-- Ventilation Grill & Control Panel (Far Right) -->
    <rect x="50" y="20" width="5" height="24" rx="1.5" fill="url(#srv-bay)" stroke="var(--color-line)" stroke-width="0.8" />

    <!-- Power Button & System LEDs -->
    <circle cx="52.5" cy="23" r="1.2" :fill="color" />
    <circle cx="52.5" cy="27" r="1" fill="var(--color-ok)" />
    <circle cx="52.5" cy="30" r="1" fill="var(--color-ok)" />

    <!-- Vent Slits -->
    <line x1="51.5" y1="34" x2="53.5" y2="34" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="51.5" y1="37" x2="53.5" y2="37" stroke="var(--color-line-strong)" stroke-width="0.8" />
    <line x1="51.5" y1="40" x2="53.5" y2="40" stroke="var(--color-line-strong)" stroke-width="0.8" />
  </svg>
</template>
