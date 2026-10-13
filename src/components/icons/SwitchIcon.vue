<script setup>
defineProps({
  size: { type: [Number, String], default: 48 },
  color: { type: String, default: 'var(--color-ok)' }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="switch-icon">
    <defs>
      <linearGradient id="sw-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--color-panel-2, #1e293b)" />
        <stop offset="100%" stop-color="var(--color-chrome, #0f172a)" />
      </linearGradient>
      <linearGradient id="sw-bezel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="sw-top" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" :stop-color="color" stop-opacity="0.8" />
        <stop offset="100%" :stop-color="color" stop-opacity="0.2" />
      </linearGradient>
    </defs>

    <!-- Rack Ears (Left & Right) -->
    <path d="M 2 24 L 6 24 L 6 42 L 2 42 Z" fill="var(--color-line-strong)" stroke="var(--color-line)" stroke-width="0.8" />
    <circle cx="4" cy="27" r="1" fill="#090d16" />
    <circle cx="4" cy="39" r="1" fill="#090d16" />

    <path d="M 62 24 L 58 24 L 58 42 L 62 42 Z" fill="var(--color-line-strong)" stroke="var(--color-line)" stroke-width="0.8" />
    <circle cx="60" cy="27" r="1" fill="#090d16" />
    <circle cx="60" cy="39" r="1" fill="#090d16" />

    <!-- Main Rackmount Chassis -->
    <rect x="6" y="20" width="52" height="26" rx="3" fill="url(#sw-body)" stroke="var(--color-line-strong)" stroke-width="1.5" />

    <!-- Top Accent Line -->
    <rect x="7" y="21" width="50" height="2" rx="1" fill="url(#sw-top)" />

    <!-- Front Bezel -->
    <rect x="9" y="26" width="46" height="17" rx="2" fill="url(#sw-bezel)" stroke="var(--color-line)" stroke-width="0.8" />

    <!-- System Status & Logo (Left Side) -->
    <circle cx="12" cy="29" r="1" fill="var(--color-ok)" />
    <circle cx="12" cy="32" r="1" :fill="color" />
    <rect x="11" y="36" width="3" height="4" rx="0.5" fill="var(--color-line-strong)" />

    <!-- Port Matrix (Row 1 & Row 2 RJ45 Ports) -->
    <!-- Ports Column 1 -->
    <rect x="17" y="28" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="19" cy="27" r="0.6" fill="var(--color-ok)" />
    <rect x="17" y="35" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="19" cy="34" r="0.6" fill="var(--color-ok)" />

    <!-- Ports Column 2 -->
    <rect x="23" y="28" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="25" cy="27" r="0.6" fill="var(--color-ok)" />
    <rect x="23" y="35" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="25" cy="34" r="0.6" fill="var(--color-ok)" />

    <!-- Ports Column 3 -->
    <rect x="29" y="28" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="31" cy="27" r="0.6" fill="var(--color-ok)" />
    <rect x="29" y="35" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="31" cy="34" r="0.6" fill="var(--color-muted)" />

    <!-- Ports Column 4 -->
    <rect x="35" y="28" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="37" cy="27" r="0.6" fill="var(--color-ok)" />
    <rect x="35" y="35" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="37" cy="34" r="0.6" fill="var(--color-ok)" />

    <!-- Ports Column 5 -->
    <rect x="41" y="28" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="43" cy="27" r="0.6" fill="var(--color-ok)" />
    <rect x="41" y="35" width="4" height="5" rx="0.5" fill="#0f172a" stroke="var(--color-line-strong)" stroke-width="0.5" />
    <circle cx="43" cy="34" r="0.6" fill="var(--color-ok)" />

    <!-- SFP Uplink Ports (Far Right) -->
    <rect x="48" y="28" width="5" height="12" rx="0.8" fill="#0f172a" :stroke="color" stroke-width="0.8" />
    <circle cx="50.5" cy="27" r="0.8" :fill="color" />
  </svg>
</template>
