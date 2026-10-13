<script setup>
import { computed } from 'vue'
import { Terminal, SquarePen, Trash2, SlidersHorizontal, CircleCheck, CircleX, Zap } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useGuide } from '../stores/guide'
import { TYPES, LABEL_OF } from '../catalog'
import { linkUp } from '../graph'
import { PORT_KINDS, profilesFor } from '../linkmodel'
import { confirmRemove, renameDevice, openTerminal, openConfig } from '../actions'
import { l2Peers } from '../engine'
import { useUi } from '../stores/ui'

const ui = useUi()

function openFirewallFlow() {
  ui.openModal({
    kind: 'firewallFlow',
    title: 'ANALISIS ALUR FIREWALL',
    srcDevId: d.value?.id
  })
}
import { arpEntries } from '../ros/arp'

const net = useNet(), guide = useGuide()
const guided = computed(() => guide.mode === 'guided')
const d = computed(() => net.devices[net.selected] || null)
const t = computed(() => TYPES.find(x => x.id === d.value?.type) || TYPES[0])
const profiles = computed(() => d.value ? profilesFor(d.value.type) : [])
const kindOptions = computed(() => d.value?.type === 'pc' ? ['FE', 'GBE'] : ['FE', 'GBE', 'SFP', 'SFPP'])
const SHORT_KIND = { FE: 'FE', GBE: '1G', SFP: 'SFP', SFPP: 'SFP+' }
const online = computed(() => !!d.value && net.links.some(l => linkUp(net, l) && (l.a.dev === d.value.id || l.b.dev === d.value.id)))
const hasIp = computed(() => !!d.value && d.value.ifaces.filter(i => i.kind && i.addr).length > 0)
const ipCount = computed(() => d.value ? d.value.ifaces.filter(i => i.kind && i.addr).length : 0)
const hasNet = computed(() => !!(d.value?.pools?.length || d.value?.dhcp?.length || d.value?.dhcpNets?.length || d.value?.leases?.length || d.value?.dns || d.value?.dnsStatic?.length))
const hasQ = computed(() => !!(d.value?.queues?.length || d.value?.qtypes?.length || d.value?.qtrees?.length))
const hasFw = computed(() => !!(d.value?.fw?.length || d.value?.nat?.length))
const hasVlan = computed(() => !!d.value?.ports && Object.keys(d.value.ports).length > 0)
const arpRows = computed(() => (d.value ? arpEntries(net, d.value, l2Peers) : []))
const logs = computed(() => (d.value?.log || []).slice(0, 6))
const nothing = computed(() => {
  const x = d.value
  return !x.ifaces.length && !x.routes?.length && !x.dyn?.length && !x.rip?.length && !x.ospf?.length &&
    !x.wlan && !x.wifi && !hasNet.value && !hasQ.value && !hasFw.value && !hasVlan.value
})
const btn = 'flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-panel-2 text-2xs text-muted hover:text-fg hover:border-line-strong transition-colors font-medium'
</script>

<template>
  <section v-if="d" class="bg-chrome border border-line rounded-xl p-3.5 flex flex-col gap-3 shadow-md" aria-label="Detail perangkat">
    <header class="flex items-center gap-2 border-b border-line pb-2.5">
      <component :is="t.Icon" :size="18" class="text-accent" />
      <span class="text-[14px] font-bold text-fg truncate">{{ d.name }}</span>
      <span class="text-2xs text-muted bg-panel border border-line px-1.5 py-0.5 rounded-md font-mono shrink-0">{{ LABEL_OF[d.type] }}</span>
      <span class="ml-auto w-2.5 h-2.5 rounded-full shrink-0" :class="online ? 'bg-ok' : 'bg-line-strong'"
        :title="online ? 'Ada tautan aktif' : 'Tidak ada tautan aktif'"></span>
    </header>

    <div class="flex flex-wrap gap-1.5">
      <button :class="btn" title="Buka terminal" data-guide="terminal" @click="openTerminal(d.id)">
        <Terminal :size="13" />Terminal
      </button>

      <button :class="btn" title="Konfigurasi lewat form (alternatif CLI)" @click="openConfig(d.id)">
        <SlidersHorizontal :size="13" />Konfigurasi
      </button>

      <button class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-accent/40 bg-accent/10 text-2xs text-accent font-medium hover:bg-accent/20 transition-colors" title="Simulasi alur paket firewall" @click="openFirewallFlow">
        <Zap :size="13" />Alur Firewall
      </button>

      <button :class="btn" title="Ubah nama perangkat" @click="renameDevice(d.id)">
        <SquarePen :size="13" />Ubah nama
      </button>

      <button class="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-panel-2 text-2xs text-danger hover:bg-danger/10 transition-colors font-medium" title="Hapus perangkat" @click="confirmRemove(d.id)">
        <Trash2 :size="13" />Hapus
      </button>
    </div>

    <p v-if="nothing" class="text-[12px] text-dim leading-relaxed">Belum dikonfigurasi. Buka terminal untuk mengatur perangkat ini.</p>

    <div v-if="guided" class="flex flex-col gap-1 border border-line rounded-lg p-2.5 bg-panel-2/40">
      <b class="text-2xs uppercase tracking-wide text-dim font-bold">Status Persiapan</b>
      <span class="flex items-center gap-1.5 text-[12px]" :class="hasIp ? 'text-ok font-medium' : 'text-muted'">
        <component :is="hasIp ? CircleCheck : CircleX" :size="13" />
        {{ hasIp ? `Alamat IP terpasang (${ipCount})` : 'Belum ada alamat IP' }}
      </span>
      <span class="flex items-center gap-1.5 text-[12px]" :class="online ? 'text-ok font-medium' : 'text-muted'">
        <component :is="online ? CircleCheck : CircleX" :size="13" />
        {{ online ? 'Kabel jaringan terhubung' : 'Belum ada kabel terhubung' }}
      </span>
    </div>

    <label v-if="profiles.length" class="flex items-center gap-2 text-2xs text-dim">
      <span class="uppercase tracking-wide font-medium">Profil</span>
      <select class="flex-1 bg-panel-2 border border-line rounded-md px-2 py-1 text-[12px] text-fg outline-none focus:border-accent"
        :value="d.profileId" @change="net.setProfile(d.id, $event.target.value)">
        <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </label>

    <section v-if="d.ifaces.length" class="flex flex-col gap-1.5">
      <h3 class="hud-label text-2xs text-accent font-bold">ANTARMUKA &amp; PORT</h3>
      <div v-for="i in d.ifaces" :key="i.name" class="flex flex-wrap items-center gap-2 text-[12px] font-mono bg-panel/40 p-1.5 rounded-md border border-line/50">
        <span class="text-fg font-semibold">{{ i.name }}</span>
        <span v-if="i.kind" class="text-dim">{{ SHORT_KIND[i.kind] }}</span>
        <span v-if="i.disabled" class="text-danger font-semibold">disabled</span>
        <span class="text-muted">{{ i.addr || '—' }}</span>
        <span v-if="i.vlan" class="text-wifi">vlan {{ i.vlan }} via {{ i.parent }}</span>
        <span v-if="i.members" class="text-ok">bridge: {{ i.members.join(', ') || '—' }}</span>
        <span v-if="i.comment" class="text-dim italic truncate max-w-[9rem]">"{{ i.comment }}"</span>
        <select v-if="i.kind" class="ml-auto bg-panel border border-line rounded px-1.5 py-0.5 text-[11px] text-fg outline-none focus:border-accent"
          :value="i.kind" @change="net.setPortKind(d.id, i.name, $event.target.value)">
          <option v-for="k in kindOptions" :key="k" :value="k">{{ PORT_KINDS[k].label }}</option>
        </select>
      </div>
    </section>

    <section v-if="net.devices[d.id] && arpRows.length" class="flex flex-col gap-1">
      <h3 class="text-2xs uppercase tracking-wide text-dim font-bold">Tabel ARP</h3>
      <div v-for="a in arpRows" :key="a.ip + a.iface" class="text-[12px] font-mono text-muted">{{ a.ip }} → {{ a.mac }} ({{ a.name }})</div>
    </section>

    <details v-if="logs.length" class="insp-adv flex flex-col gap-1">
      <summary class="text-2xs uppercase tracking-wide text-dim font-bold">Log Perangkat</summary>
      <div v-for="(e, k) in logs" :key="k" class="text-[12px] font-mono text-muted">{{ e.msg }}</div>
    </details>

    <section v-if="d.routes?.length || d.dyn?.length" class="flex flex-col gap-1">
      <h3 class="text-2xs uppercase tracking-wide text-dim font-bold">Tabel Rute (Routing)</h3>
      <div v-for="(r, k) in d.routes" :key="'s' + k" class="text-[12px] font-mono text-muted">{{ r.dst }} → {{ r.gw }}</div>
      <div v-for="(r, k) in d.dyn" :key="'d' + k" class="text-[12px] font-mono text-info">
        {{ r.proto === 'ospf' ? 'O' : 'R' }} {{ r.dst }} → {{ r.gw }} ({{ r.m }})
      </div>
    </section>

    <section v-if="d.wlan || d.wifi" class="flex flex-col gap-1">
      <h3 class="text-2xs uppercase tracking-wide text-dim font-bold">Nirkabel (Wi-Fi)</h3>
      <template v-if="d.wlan">
        <div class="text-[12px] font-mono text-muted">SSID: {{ d.wlan.ssid }}</div>
        <div class="text-[12px] font-mono text-muted">Mode: {{ d.wlan.mode || 'ap-bridge' }}</div>
        <div class="text-[12px] font-mono text-muted">{{ d.wlan.pass ? 'WPA2' : 'Open' }}</div>
      </template>
      <div v-if="d.wifi" class="text-[12px] font-mono text-muted">klien SSID: {{ d.wifi.ssid }}</div>
    </section>

    <section v-if="hasNet" class="flex flex-col gap-1">
      <h3 class="text-2xs uppercase tracking-wide text-dim font-bold">Layanan DHCP &amp; DNS</h3>
      <div v-for="p in d.pools || []" :key="'p' + p.name" class="text-[12px] font-mono text-muted">pool {{ p.name }} {{ p.from }}-{{ p.to }}</div>
      <div v-for="x in d.dhcp || []" :key="'h' + x.name" class="text-[12px] font-mono text-muted">dhcp {{ x.name }} {{ x.interface }} ← {{ x.pool }}</div>
      <div v-for="(n, k) in d.dhcpNets || []" :key="'n' + k" class="text-[12px] font-mono text-muted">net {{ n.address }} gw {{ n.gateway || '—' }} dns {{ n.dns || '—' }}</div>
      <div v-for="(l, k) in d.leases || []" :key="'l' + k" class="text-[12px] font-mono text-muted">lease {{ l.ip }} {{ net.devices[l.by]?.name || '?' }}</div>
      <div v-if="d.dns" class="text-[12px] font-mono text-muted">dns {{ d.dns }}</div>
      <div v-for="(s, k) in d.dnsStatic || []" :key="'s' + k" class="text-[12px] font-mono text-muted">static {{ s.name }} → {{ s.address }}</div>
    </section>

    <details v-if="hasQ" class="insp-adv flex flex-col gap-1" :open="!guided">
      <summary class="text-2xs uppercase tracking-wide text-dim font-bold">Manajemen Bandwidth (Queue)<template v-if="guided"> (lanjutan)</template></summary>
      <div v-for="(q, k) in d.queues || []" :key="'q' + k" class="text-[12px] font-mono text-muted">{{ q.name }} {{ q.target }} {{ q.up }}/{{ q.down }} Mbps</div>
      <div v-for="(q, k) in d.qtypes || []" :key="'t' + k" class="text-[12px] font-mono text-muted">type {{ q.name }} {{ q.rate }} Mbps {{ q.classifier }}</div>
      <div v-for="(q, k) in d.qtrees || []" :key="'r' + k" class="text-[12px] font-mono text-muted">tree {{ q.name }} parent=global {{ q.up }}/{{ q.down }}{{ q.queue ? ' queue=' + q.queue : '' }}</div>
    </details>

    <details v-if="hasFw" class="insp-adv flex flex-col gap-1" :open="!guided">
      <summary class="text-2xs uppercase tracking-wide text-dim font-bold">Firewall &amp; NAT<template v-if="guided"> (lanjutan)</template></summary>
      <div v-for="(f, k) in d.fw || []" :key="'f' + k" class="text-[12px] font-mono text-muted">{{ f.chain }} {{ f.action }} {{ f.src || '-' }} → {{ f.dst || '-' }}{{ f.proto ? ' ' + f.proto : '' }}</div>
      <div v-for="(n, k) in d.nat || []" :key="'n' + k" class="text-[12px] font-mono text-muted">srcnat masquerade out-interface {{ n.out }}</div>
    </details>

    <details v-if="hasVlan" class="insp-adv flex flex-col gap-1" :open="!guided">
      <summary class="hud-label text-2xs text-accent font-bold">KONFIGURASI VLAN<template v-if="guided"> (lanjutan)</template></summary>
      <div v-for="(cfg, p) in d.ports" :key="p" class="text-[12px] font-mono text-muted">
        {{ p }} {{ cfg.mode === 'access' ? 'access vlan ' + cfg.vlan : 'trunk ' + (cfg.vlans || []).join(',') }}
      </div>
    </details>
  </section>
</template>
