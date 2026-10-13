## Context

MikroLab (Vue 3 + Pinia + Tailwind v4, `src/App.vue` shell: `AppTopBar` + `DeviceRail` + `TopologyCanvas` + `TerminalDock` + right `aside[DeviceInspector+SidePanel]`) gets a full Crysis 2/3 Nanosuit 2.0 reskin + UX reflow. End state: dark visor-HUD chrome, hex language, suit-mode switcher (Power/Armor/Cloak driving accent + suggested panel), boot-up visor sequence, scan/glow motion with optional suit beeps, all existing sim flows (build topology, link, terminal exec, labs, fleet, monitor, save/share) working unchanged logically.

## Approach

### Step 1 — Nanosuit token system in place (no caller churn)

- Rewrite `@theme` in `src/styles/app.css`: keep existing token names so all `bg-canvas/text-fg/border-line/...` classes keep working; change values to Nanosuit palette:
  - `--color-canvas:#04090f; --color-chrome:#071522; --color-panel:rgba(10,26,40,.78); --color-panel-2:#0e2a44; --color-node:#0b2237; --color-line:#1b3f5e; --color-line-strong:#2e6a99; --color-fg:#dff3ff; --color-muted:#9fc3dd; --color-dim:#6d93ad; --color-accent:#00e5ff; --color-accent-soft:#7df3ff; --color-accent-fg:#03161d; --color-ok:#3dffa2; --color-danger:#ff5d5d; --color-info:#00e5ff; --color-wifi:#b28bff; --color-grid:#0d2a42; --color-grid-strong:#174a75; --color-cable:#41c8e8;`
  - Add `--color-suit-power:#ff7a1a; --color-suit-armor:#00e5ff; --color-suit-cloak:#b28bff; --suit-accent:var(--color-suit-armor);`
  - Add `[data-suit="power"]{--suit-accent:var(--color-suit-power);--color-accent:var(--color-suit-power)}` and same pattern for `armor`/`cloak`; active-mode elements use `text-accent/border-accent/bg-accent` so they retint automatically.
- Keep fonts: no new packages; `Bricolage Grotesque Variable` for headers, `JetBrains Mono Variable` for HUD data (uppercase + `letter-spacing:.12em` via new `.hud-label` utility in same file).
- Add utilities/keyframes in `app.css`: `.glass{background:linear-gradient(180deg,rgba(13,38,60,.85),rgba(6,18,30,.85));backdrop-filter:blur(10px)}`, `.hex-clip{clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}`, `.scanlines::after` (repeating-linear-gradient overlay, pointer-events none), `@keyframes visor-in`, `@keyframes hex-pulse`, `@keyframes suit-glow`; extend existing `prefers-reduced-motion` block to kill these too.
- Update `index.html`: `theme-color` `#04090f`, inline critical `background:#04090f`, `<title>NANOSUIT // MikroLab</title>`.

### Step 2 — Suit-mode + mute + boot state (single store change)

- Extend `src/stores/ui.js` state: `suit: localStorage 'ml.suit' || 'armor'`, `muted: localStorage 'ml.muted' === '1'`, `booted: !!localStorage 'ml.seen'`.
- Add actions `setSuit(m)` (validate `'power'|'armor'|'cloak'`, persist, `notify()` suit-voice line, auto-set panel: `power→'lab'`, `armor→'monitor'`, `cloak→'lab'`; user may switch panel back freely), `toggleMute()` (persist), `markBooted()` (sets `ml.seen`, `welcome=false`, `booted=true`).
- No other store API changes; `panel` values stay `'lab'|'fleet'|'monitor'|'akun'`.

### Step 3 — Shell reflow to visor frame

- `src/App.vue`: root div add `:data-suit="ui.suit"` + `visor-booted` class toggle; wrap `TopologyCanvas` in visor frame div (corner-bracket spans + `.scanlines` overlay + top-center suit-status strip showing `MAXIMUM {POWER|ARMOR|CLOAK}` from `ui.suit`); keep all keyboard handlers, `DeviceRail`/`TerminalDock`/aside mounting logic identical.
- `src/components/AppTopBar.vue`: restructure header into visor bar (keep all existing buttons/handlers: undo/redo/save/import/export/png/help/dirty/mode/zoom/fit/reset/api/panel/account): replace logo block with hex badge (`hex-clip` div + Router icon) + `NANOSUIT // MikroLab` stack; insert new `SuitModeSwitcher.vue` (three hex buttons POWER/ARMOR/CLOAK, `aria-pressed`, click `ui.setSuit`) center-left; add mute toggle button (Volume2/VolumeX, `ui.toggleMute`); apply `.glass`, `.hud-label` to labels; dirty status becomes `● UNSAVED CHANGES` in suit accent.
- `src/components/DeviceRail.vue`: keep `TYPES`/`TOOLS` arrays, drag/drop, `net.add`/`net.tool` logic; restyle `item` class to hex buttons (`hex-clip`, glass, active = suit-accent border + glow); group labels `DEPLOY` (devices) / `TACTICS` (tools) via `.hud-label` spans.
- New `src/components/SuitModeSwitcher.vue`: props none; uses `useUi`; three buttons; emits none.

### Step 4 — Topology canvas becomes tactical visor

- `src/components/TopologyCanvas.vue`: keep pan/zoom/pinch/DnD/menu/template/validation logic; visual-only changes: grid `<pattern>` stroke `var(--color-grid)` + second strong pattern; cables stroke `var(--color-cable)` with glow filter (`<filter id="suit-glow">` feGaussianBlur + merge), link-down cables `var(--color-danger)`; empty-state card rewritten as `NO TACTICAL DATA // DEPLOY UNITS` with hex Deploy button calling same `net.add('router',…)`; tool hint pills restyled to `.hud-label` glass chips; legend entries uppercase.
- `src/components/DeviceNode.vue`: keep props (`dev,selected,linking,links,wifiCount`) and emits; replace hardcoded fills/strokes (`#14375a`,`#ffbf47`,`#5fe3b0`,`#35648f`,`#eaf3fb`,`#b3cde5`,`#2b4666`,`#d9a6ff`,`#0a2138`) with `var(--color-node)`, `var(--suit-accent)`, `var(--color-ok)`, `var(--color-line-strong)`, `var(--color-fg)`, `var(--color-muted)`, `var(--color-wifi)` so PNG export and theme stay in sync; card `132x60 rx12` keeps geometry, adds hex-tinted glass fill + 3px left status strip in type color, name in mono uppercase, selected = `stroke var(--suit-accent)` + glow filter; status dot ok/danger tokens unchanged.
- `src/exporter.js`: update `TOKENS` array values to new palette (`--color-info:#00e5ff`, `--color-ok:#3dffa2`, `--color-accent:var suit armor #00e5ff`, `--color-wifi:#b28bff`, `--color-fg:#dff3ff`, `--color-muted:#9fc3dd`, `--color-dim:#6d93ad`, `--color-cable:#41c8e8`) and default `background` param `'#04090f'`; filename default unchanged.
- `src/suitAudio.js` (new, no equivalent exists): export `beep(kind)` using `AudioContext` oscillator (open 880Hz 60ms / confirm 1320Hz 50ms / error 180Hz 120ms / mode 660→990 sweep); no-op when `useUi().muted` or no user gesture yet; call from `SuitModeSwitcher` click, `ui.notify` wrapper stays silent otherwise.
### Step 5 — Terminal, inspector, side modules to suit modules

- `src/components/TerminalDock.vue`: keep `net.run`/history/Tab-complete/spark/QUICK chips/resize logic; header becomes `VISOR LINK // {dev.name}` + suit-accent status pill (`TRANSMITTING`/`READY`); prompt prefix per suit (`PWR>`,`ARM>`,`CLK> ` + existing `promptOf`); output area adds `.scanlines` + caret blink keyframe; quick chips restyled hex, same `insert()` behavior.
- `src/components/DeviceInspector.vue`: keep all sections/mutators; wrap in glass panel with `.hud-label` section titles (`UNIT //`, `COMMS //`, `ARMOR // VLAN`); action buttons hex-clipped, destructive unchanged.
- `src/components/SidePanel.vue` + `LabPane/FleetPane/MonitoringPane/AccountPane/HistoryPane.vue`: keep tab ids, `ui.panel` switching, all lab-check/fleet-run/monitor-poll/auth/version logic; tabs become hex module buttons `LAB/FLEET/MONITOR/ACCT` with suit-accent active underline; cards get `.glass` + corner tick; Monitor alert colors map to ok/danger tokens unchanged.
- `ModalHost/CommandPalette/ContextMenu/ToastHost/GuidedTour.vue`: logic untouched; toasts prefixed suit-voice style (`>> SUIT: {text}`) via `ToastHost` render only; modals/menus/palette get `.glass` + `hex-clip` + hud labels.

### Step 6 — Boot-up visor sequence replaces welcome

- Rewrite `src/components/WelcomeOverlay.vue` template/logic: on `ui.welcome`, full-screen visor boot with staged lines (`NANOSUIT 2.0 // ONLINE`, `NEURAL LINK … OK`, `TACTICAL NETWORK … OK`), progress bar animating ~1.6s (`visor-in`), INITIATE DEPLOYMENT button → `ui.markBooted()` + `guide.reopen()`; SKIP link → `markBooted()` + `guide.finish()`; respects `prefers-reduced-motion` (instant). Keep `ml.seen` key so returning users skip.
- `src/main.js`, `src/catalog.js` (TYPES/CMDS), engine/fleet/monitor/net stores, server: no changes. Do not add font/icon/asset packages; `lucide-vue-next` icons only.

## Critical files & anchors

- `src/styles/app.css` — sole stylesheet; `@theme` tokens + `.glass`/`.hex-clip`/`.scanlines`/keyframes; every visual change keys off this.
- `src/stores/ui.js` — `suit/muted/booted`, `setSuit/toggleMute/markBooted`; `SuitModeSwitcher` + `App.vue[data-suit]` consume it.
- `src/components/TopologyCanvas.vue` — SVG grid/cables/glow filter/empty-state; most intricate visual edit, logic must not change.
- `src/components/DeviceNode.vue` + `src/exporter.js` — hardcoded hex literals must move to CSS vars together or PNG export drifts from screen.
- `src/components/WelcomeOverlay.vue` — boot sequence owns first-run `ml.seen` flow; wrong gating locks users out.

## Verification

- `pnpm test` (repo root) — full vitest suite green; guards sim logic untouched by reskin.
- `pnpm build` (repo root) — Vite production build passes; guards Tailwind v4 token/clip-path CSS validity.
- Manual visor pass (`pnpm dev`, clear `localStorage ml.seen`): boot sequence plays ≤2s → INITIATE DEPLOYMENT lands on canvas with `MAXIMUM ARMOR` strip; switch POWER/CLOAK retints accents + plays sweep (mute silences); add router → link two devices → terminal `ping` shows packet glow + `>> SUIT:` toast; export PNG has dark `#04090f` background.
- Reduced-motion pass: OS reduce-motion on → boot instant, no pulse/scan animation, all flows usable.

## Assumptions & contingencies

- Suit-mode auto-switches side panel (`power→lab`, `armor→monitor`); if monitor auto-open annoys during build flows, fallback: notify only, never change `ui.panel`.
- `AudioContext` beeps assume user-gesture creation; if autoplay policy blocks, fallback: silent no-op (never error-toast for audio).
- If `backdrop-filter`/clip-path hurts low-end perf, fallback: keep hex geometry + flat fills, drop blur/glow but keep palette and layout.
