# MikroLab // MikroTik RouterOS Simulator & Tactical Visor

An interactive, high-fidelity MikroTik RouterOS network topology simulator with a **Crysis 2/3 Nanosuit 2.0 Visor HUD** theme, step-by-step firewall packet flow visualizer, custom mission builder, and real-time bandwidth telemetry diagnostics.

![MikroLab Visor Banner](https://img.shields.io/badge/NANOSUIT-2.0_ONLINE-00e5ff?style=for-the-badge&logo=mikrotik)
![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?style=flat-square)
![Pinia](https://img.shields.io/badge/Pinia-2.3-yellow?style=flat-square)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-06b6d4?style=flat-square)
![Vitest](https://img.shields.io/badge/Tests-169_Passing-brightgreen?style=flat-square)

---

## ⚡ Key Features

### 🪖 Crysis Nanosuit 2.0 Visor HUD Theme & UX
- **Dynamic Suit Modes**: Switch seamlessly between **MAXIMUM ARMOR** (Cyan), **MAXIMUM POWER** (Orange), and **CLOAK** (Purple) with sound effects and retinted HUD accents.
- **Boot Sequence Overlay**: Interactive Nanosuit neural calibration initialization sequence.
- **Tactical Canvas**: Hexagonal geometry badges, glowing glassmorphism panels, scanlines, and animated packet routing traces.

### 🛡️ Tactical Firewall Scan (Packet Flow Visualizer)
- **Step-by-step Packet Traversal**: Trace packets hop-by-hop across `PREROUTING` → `DST-NAT` → `INPUT` / `FORWARD` → `POSTROUTING` → `SRC-NAT`.
- **Rule Match Diagnostics**: Inspect matched firewall filter rules, masquerade NAT transforms, and drop/accept verdicts with Nanosuit hex alerts.

### 🎯 Custom Mission Creator & Auto-Grader
- **Interactive Lab Builder**: Design custom network scenarios with custom goals, briefing notes, and initial topology snapshots.
- **Automated Objective Verification**: Real-time checking for ping reachability, interface IP settings, static/dynamic routes, and firewall rule configurations.
- **Export/Import Missions**: Save and share lab challenges as `.json` files.

### 📊 Bandwidth Telemetry & Diagnostics
- **RouterOS `/tool bandwidth-test`**: CLI command supporting `address=`, `protocol=tcp|udp`, `direction=transmit|receive|both`, and `duration=`.
- **Live Telemetry HUD Panel**: Real-time throughput (Tx/Rx Mbps), jitter, and packet loss meters in the Visor monitoring module.

### 🔌 RouterOS Simulation Engine
- **L3 Routing & Switching**: Static routes, OSPF multi-area, RIP, VLAN trunking/access, Bridge STP, DHCP server/client, static DNS, simple queues & queue trees.
- **Link Model**: Cable medium constraints (Cat5e / Cat6 / Fiber SFP+), bandwidth limits, and wireless AP/Station association.

---

## 🚀 Quickstart

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (v8+)

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/user/mikrotik-sim.git
   cd mikrotik-sim
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start the Development Server**:
   ```bash
   pnpm dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Run Unit Tests**:
   ```bash
   pnpm test
   ```

---

## 📁 Project Architecture

```
mikrotik-sim/
├── src/
│   ├── components/         # Vue 3 Visor UI Components
│   │   ├── AppTopBar.vue        # Nanosuit HUD header bar & suit mode switcher
│   │   ├── TopologyCanvas.vue   # SVG canvas with packet glow & tactical grid
│   │   ├── FirewallFlowModal.vue # Tactical Firewall Packet Scan visualizer
│   │   ├── LabPane.vue          # Custom Lab Builder & Mission objective checker
│   │   ├── MonitoringPane.vue   # Telemetry & Bandwidth diagnostic panel
│   │   └── ...
│   ├── ros/                # RouterOS CLI parsing & command registry
│   │   └── registry.js      # RouterOS & Host command implementations
│   ├── engine.js           # Packet tracing, firewall evaluation, & L2/L3 simulation
│   ├── suitAudio.js        # Web Audio API Nanosuit audio feedback
│   └── stores/             # Pinia stores (net, ui, guide, monitor, fleet)
├── tests/                  # Vitest unit test suites (169 tests)
└── vite.config.js          # Vite build configuration
```

---

## 📝 License

Distributed under the MIT License.
