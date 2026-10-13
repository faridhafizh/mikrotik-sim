<script setup>
import { computed, ref } from 'vue'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { TYPES, LABEL_OF } from '../catalog'
import { validIp, validCidr, validIp6, ifaceStatus, l2Peers } from '../engine'
import { arpEntries } from '../ros/arp'
import { macOf } from '../ros/mac'

const net = useNet(), ui = useUi()
const devId = computed(() => ui.modal?.devId)
const d = computed(() => net.devices[devId.value] || null)
const t = computed(() => TYPES.find(x => x.id === d.value?.type) || TYPES[0])

const isRouter = computed(() => d.value?.type === 'router')
const isSwitch = computed(() => d.value?.type === 'switch')
const tab = ref('ip')

const err = ref('')
async function run(cmds) {
  err.value = ''
  net.selected = d.value.id
  const before = (net.term[d.value.id] || []).length
  for (const c of cmds) await net.run(c)
  const fresh = (net.term[d.value.id] || []).slice(before)
  const bad = fresh.find(l => /^(failure|bad command|dns:|dhcp:|interface |queue type|pool|address tidak valid)/.test(l))
  if (bad) err.value = bad
  else ui.notify('Perintah dijalankan di terminal, hasilnya bisa dilihat di sana', 'success')
}

const ipIfaces = computed(() => (d.value?.ifaces || []).filter(i => i.name.startsWith('ether') && !i.members && !i.parent))
const f = ref({})
const val = k => f.value[k] ?? ''
const setVal = (k, v) => { f.value = { ...f.value, [k]: v } }

function addIp() {
  if (!validCidr(val('ipaddr'))) return err.value = 'Format alamat harus CIDR, contoh 192.168.1.1/24'
  const ifc = val('ipiface') || ipIfaces.value[0]?.name || d.value.ifaces[0].name
  run([`ip address add address=${val('ipaddr')} interface=${ifc}`])
}
function addRoute() {
  if (!validCidr(val('rtdst')) || !validIp(val('rtgw'))) return err.value = 'dst-address=<net/len> gateway=<ip> wajib diisi valid'
  run([`ip route add dst-address=${val('rtdst')} gateway=${val('rtgw')}`])
}
function setDns() {
  if (!validIp(val('dns'))) return err.value = 'servers=<ip> tidak valid'
  run([`ip dns set servers=${val('dns')}`])
}
function setWlan() {
  if (!val('ssid')) return err.value = 'ssid wajib diisi'
  const pw = val('pass')
  if (pw && pw.length < 8) return err.value = 'Password WPA2 minimal 8 karakter'
  run([`interface wireless set wlan1 ssid=${val('ssid')} password=${pw} mode=${val('wmode') || 'ap-bridge'}`])
}
function addPool() {
  if (!val('poolname') || !/^\d+\.\d+\.\d+\.\d+-\d+\.\d+\.\d+\.\d+$/.test(val('ranges') || '')) return err.value = 'butuh name= dan ranges=<ipAwal>-<ipAkhir>'
  run([`ip pool add name=${val('poolname')} ranges=${val('ranges')}`])
}
function addDhcpNet() {
  if (!validCidr(val('dhcpnet'))) return err.value = 'address=<net/len> wajib valid'
  const g = val('dhcpgw'), s = val('dhcpdns')
  if ((g && !validIp(g)) || (s && !validIp(s))) return err.value = 'gateway/dns tidak valid'
  run([`ip dhcp-server network add address=${val('dhcpnet')}${g ? ' gateway=' + g : ''}${s ? ' dns-server=' + s : ''}`])
}
function addDhcpSrv() {
  run([`ip dhcp-server add name=${val('dhcpname') || 'dhcp1'} interface=${val('dhcpiface') || 'ether1'} address-pool=${val('dhcppool')}`])
}
function addDhcpCli() {
  const i = val('cliface') || ipIfaces.value[0]?.name
  if (!i) return err.value = 'interface wajib'
  run([`ip dhcp-client add interface=${i}`])
}
function addDnsStatic() {
  if (!val('dnsname') || !validIp(val('dnsaddr'))) return err.value = 'name= dan address=<ip> wajib valid'
  run([`ip dns static add name=${val('dnsname')} address=${val('dnsaddr')}`])
}
function addFw() {
  const proto = val('fwproto')
  const dport = val('fwdport')
  if (proto && !['tcp', 'udp', 'icmp'].includes(proto)) return err.value = 'protocol harus tcp|udp|icmp'
  if (dport && (!/^\d+$/.test(dport) || +dport < 1 || +dport > 65535)) return err.value = 'dst-port 1-65535'
  run([`ip firewall filter add chain=${val('fwchain') || 'forward'} action=${val('fwaction') || 'drop'}${val('fwsrc') ? ' src-address=' + val('fwsrc') : ''}${val('fwdst') ? ' dst-address=' + val('fwdst') : ''}${proto ? ' protocol=' + proto : ''}${dport ? ' dst-port=' + dport : ''}`])
}
function addNat() {
  const o = val('natout') || ipIfaces.value[0]?.name
  if (!o) return err.value = 'out-interface wajib'
  run([`ip firewall nat add chain=srcnat action=masquerade out-interface=${o}`])
}
function addDstnat() {
  const action = val('natd_action') || 'dst-nat'
  const to = val('natd_to'), tp = val('natd_toport'), proto = val('natd_proto'), dport = val('natd_dport'), inif = val('natd_inif')
  if (action === 'dst-nat' && !validIp(to)) return err.value = 'to-addresses harus IPv4 valid'
  if (to && !validIp(to)) return err.value = 'to-addresses harus IPv4 valid'
  if ((tp && (!/^\d+$/.test(tp) || +tp < 1 || +tp > 65535))) return err.value = 'to-ports 1-65535'
  if (dport && (!/^\d+$/.test(dport) || +dport < 1 || +dport > 65535)) return err.value = 'dst-port 1-65535'
  if (proto && !['tcp', 'udp'].includes(proto)) return err.value = 'protocol harus tcp|udp'
  if (inif && !d.value.ifaces.some(i => i.name === inif)) return err.value = 'in-interface tidak ada'
  const toIp = action === 'redirect' ? (to ? ' to-addresses=' + to : '') : ` to-addresses=${to}`
  run([`ip firewall nat add chain=dstnat action=${action}${toIp}${tp ? ' to-ports=' + tp : ''}${proto ? ' protocol=' + proto : ''}${dport ? ' dst-port=' + dport : ''}${inif ? ' in-interface=' + inif : ''}`])
}
function addAddr6() {
  const c = val('addr6')
  const [a, l] = (c || '').split('/')
  if (!validIp6(a || '') || !(+l >= 0 && +l <= 128)) return err.value = 'address IPv6 tidak valid (contoh 2001:db8::1/64)'
  const ifc = val('addr6if') || d.value.ifaces[0].name
  run([`ipv6 address add address=${c} interface=${ifc}`])
}
function addRoute6() {
  const [a, l] = (val('r6dst') || '').split('/')
  if (!validIp6(a || '') || !(+l >= 0 && +l <= 128) || !validIp6(val('r6gw'))) return err.value = 'gateway IPv6 tidak valid'
  run([`ipv6 route add dst-address=${val('r6dst')} gateway=${val('r6gw')}`])
}
function addQueue() {
  if (!val('qname') || !validCidr(val('qtarget')) || !/^\d+(\.\d+)?[kmg]?\/\d+(\.\d+)?[kmg]?$/i.test(val('qlimit') || ''))
    return err.value = 'butuh name=, target=<net/len>, max-limit=<up>/<down> (mis. 2M/5M)'
  run([`queue simple add name=${val('qname')} target=${val('qtarget')} max-limit=${val('qlimit')}`])
}
function addRouteDyn() {
  if (!validCidr(val('dynnet'))) return err.value = 'network=<net/len> wajib valid'
  run([`routing ${val('dynproto') || 'ospf'} network add network=${val('dynnet')}`])
}
function addBridge() {
  if (!val('brname')) return err.value = 'name= wajib'
  run([`interface bridge add name=${val('brname')}`])
}
function addBridgePort() {
  const b = val('bpon'), i = val('bpoif')
  if (!b || !i) return err.value = 'bridge= dan interface= wajib'
  run([`interface bridge port add bridge=${b} interface=${i}`])
}
function addVlanIf() {
  if (!val('vname') || !(+val('vid') > 0) || !val('vparent')) return err.value = 'name=, vlan-id=, interface= wajib'
  run([`interface vlan add name=${val('vname')} vlan-id=${val('vid')} interface=${val('vparent')}`])
}
function applyVlan() {
  const p = val('vport') || d.value.ifaces[0].name
  if (val('vmode') === 'trunk') {
    if (!(val('vids') || '').split(',').map(Number).filter(Boolean).length) return err.value = 'ids= wajib (mis. 10,20)'
    run([`vlan trunk port=${p} ids=${val('vids')}`])
  } else {
    if (!(+val('vvid') > 0)) return err.value = 'id= wajib'
    run([`vlan access port=${p} id=${val('vvid')}`])
  }
}
function scan() { run(['wifi scan']) }
function connect() { run([`wifi connect ssid=${val('wssid')} password=${val('wpass') || ''}`]) }

// ---------- Interface (enable/disable + komentar) ----------
const ifRows = computed(() => (d.value?.ifaces || []).map(i => ({
  ...i,
  cable: !!i.kind,
  status: ifaceStatus(net, d.value, i.name),
  mac: macOf(d.value.id, i.name)
})))
function setIface(name, kv) { run([`interface ethernet set ${name} ` + kv]) }
function ifEnable(name, on) { run([`interface ethernet ${on ? 'enable' : 'disable'} ${name}`]) }

// ---------- ARP ----------
const arpRows = computed(() => (d.value ? arpEntries(net, d.value, l2Peers) : []))
function dropArp(ip) { run([`ip arp remove address=${ip}`]) }

// ---------- Sistem ----------
const logs = computed(() => (d.value?.log || []).slice(0, 12))
function setIdentity() { if (!val('idname')?.trim()) return err.value = 'nama wajib diisi'; run([`system identity set name=${val('idname').trim()}`]) }
function setClock() {
  const dt = val('cdate'), tm = val('ctime')
  if (!dt && !tm) return err.value = 'isi date dan/atau time'
  if (dt && !/^\d{4}-\d{2}-\d{2}$/.test(dt)) return err.value = 'date harus YYYY-MM-DD'
  if (tm && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(tm)) return err.value = 'time harus HH:MM:SS'
  run([`system clock set${dt ? ' date=' + dt : ''}${tm ? ' time=' + tm : ''}`])
}
function reboot() { run(['system reboot']) }

// ---------- User ----------
const USER_GROUPS = ['full', 'read', 'write', 'policy', 'test']
const users = computed(() => (d.value?.users?.length ? d.value.users : [{ name: 'admin', group: 'full' }]))
function addUser() {
  const n = val('uname')?.trim()
  if (!n || !/^[\w.-]{1,40}$/.test(n)) return err.value = 'nama user wajib (huruf/angka/.-, maks 40)'
  if (!USER_GROUPS.includes(val('ugroup') || 'read')) return err.value = 'group harus ' + USER_GROUPS.join('|')
  run([`user add name=${n} group=${val('ugroup') || 'read'}`])
}
function delUser(name) { run([`user remove name=${name}`]) }

// ---------- Address list ----------
function addAddrList() {
  if (!val('allist')) return err.value = 'list= wajib'
  if (!val('aladdr') || !validCidr(val('aladdr'))) return err.value = 'address harus <ip|net/len>'
  run([`ip firewall address-list add list=${val('allist')} address=${val('aladdr')}${val('altimeout') ? ' timeout=' + val('altimeout') : ''}`])
}
function delAddrList(k) { run([`ip firewall address-list remove numbers=${k}`]) }

// ---------- CMD Windows (host) ----------
const CMD_TOOLS = ['ipconfig /all', 'ipconfig', 'route print', 'arp -a', 'netstat', 'getmac', 'systeminfo', 'hostname']
function cmdTool(c) { run([c]) }
function cmdPing() { if (!val('wping')) return err.value = 'tujuan wajib diisi'; run([`ping ${val('wn') ? '-n ' + val('wn') + ' ' : ''}${val('wping')}`]) }
function cmdTrace() { if (!val('wping')) return err.value = 'tujuan wajib diisi'; run([`tracert ${val('wping')}`]) }
function cmdResolve() { if (!val('wname')) return err.value = 'nama host wajib diisi'; run([`nslookup ${val('wname')}${val('wserver') ? ' ' + val('wserver') : ''}`]) }
function cmdDhcp(cmd) { run([cmd]) }

const inp = 'w-full bg-panel-2 border border-line rounded-ctl px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent'
const lbl = 'text-2xs text-dim'
const btn = 'px-3 py-1.5 rounded-ctl bg-accent text-accent-fg text-[13px] font-semibold'
const del = 'shrink-0 text-danger text-[13px] px-1'

const bridges = computed(() => (d.value?.ifaces || []).filter(i => i.members))
const tabs = computed(() => {
  if (isSwitch.value) return [['iface', 'Interface'], ['vlan', 'VLAN'], ['sistem', 'Sistem'], ['tes', 'Tes']]
  if (isRouter.value) return [['ip', 'IP Address'], ['route', 'Route'], ['iface', 'Interface'], ['arp', 'ARP'], ['dhcp', 'DHCP Server'], ['dhcpcli', 'DHCP Client'], ['dns', 'DNS'], ['wlan', 'Wireless'], ['queue', 'Queue'], ['fw', 'Firewall/NAT'], ['bridge', 'Bridge/VLAN'], ['dyn', 'Routing Dinamis'], ['user', 'User'], ['sistem', 'Sistem']]
  return [['ip', 'IP Address'], ['route', 'Route'], ['iface', 'Interface'], ['wlan', 'Wi-Fi'], ['cmd', 'CMD Windows'], ['tes', 'Tes']]
})
const portCfgOf = name => d.value?.ports?.[name] || { mode: 'access', vlan: 1 }
</script>

<template>
  <div v-if="d" class="mt-4 flex flex-col gap-4 text-[13px]">
    <div class="flex items-center gap-2">
      <component :is="t.Icon" :size="16" />
      <b class="truncate">{{ d.name }}</b>
      <span class="text-2xs text-dim">{{ LABEL_OF[d.type] }}</span>
    </div>

    <div class="flex flex-wrap gap-1.5" role="tablist" :aria-label="'Konfigurasi ' + d.name">
      <button v-for="[k, label] in tabs" :key="k" role="tab" :aria-selected="tab === k"
        class="px-2.5 py-1 rounded-ctl text-[12px] border"
        :class="tab === k ? 'bg-panel-2 text-fg border-accent' : 'text-muted border-line hover:bg-panel-2'"
        @click="tab = k; err = ''">{{ label }}</button>
    </div>

    <p v-if="err" class="text-[12px] text-danger">{{ err }}</p>

    <section v-if="tab === 'ip'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Alamat saat ini</span>
        <div v-for="i in d.ifaces" :key="i.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ i.name }}: {{ i.addr || '—' }}</span>
          <button v-if="i.addr" :class="del" title="Hapus alamat" @click="run([isRouter ? `ip address remove interface=${i.name}` : 'ip address remove'])">×</button>
        </div>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">Alamat (CIDR)</span>
        <input :value="val('ipaddr')" class="font-mono text-[12px]" :class="inp" placeholder="192.168.1.1/24" @input="setVal('ipaddr', $event.target.value)" /></label>
      <label v-if="isRouter || d.ifaces.length > 1" class="flex flex-col gap-1"><span :class="lbl">Interface</span>
        <select :value="val('ipiface') || ipIfaces[0]?.name || d.ifaces[0].name" :class="inp" @change="setVal('ipiface', $event.target.value)">
          <option v-for="i in (ipIfaces.length ? ipIfaces : d.ifaces)" :key="i.name" :value="i.name">{{ i.name }}</option>
        </select></label>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Alamat IPv6 saat ini</span>
        <div v-for="i in d.ifaces" :key="'v6' + i.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ i.name }}: {{ i.addr6 || '-' }}</span>
        </div>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">Alamat IPv6 (CIDR)</span>
        <input :value="val('addr6')" class="font-mono text-[12px]" :class="inp" placeholder="2001:db8::1/64" @input="setVal('addr6', $event.target.value)" /></label>
      <button :class="btn" @click="addAddr6">Tambah alamat IPv6</button>
      <button :class="btn" @click="addIp">Tambah alamat</button>
    </section>

    <section v-if="tab === 'route'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Route saat ini</span>
        <div v-for="(r, k) in d.routes" :key="k" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ r.dst }} → {{ r.gw }}</span>
          <button :class="del" title="Hapus route" @click="run([isRouter ? `ip route remove dst-address=${r.dst}` : 'ip route remove'])">×</button>
        </div>
        <p v-if="!d.routes.length" class="text-[12px] text-dim">Belum ada route statis.</p>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">dst-address</span>
        <input :value="val('rtdst')" class="font-mono text-[12px]" :class="inp" placeholder="0.0.0.0/0" @input="setVal('rtdst', $event.target.value)" /></label>
      <label class="flex flex-col gap-1"><span :class="lbl">gateway</span>
        <input :value="val('rtgw')" class="font-mono text-[12px]" :class="inp" placeholder="10.0.0.2" @input="setVal('rtgw', $event.target.value)" /></label>
      <label v-if="!isRouter" class="flex flex-col gap-1"><span :class="lbl">DNS (opsional)</span>
        <input :value="val('dns')" class="font-mono text-[12px]" :class="inp" placeholder="8.8.8.8" @input="setVal('dns', $event.target.value)" /></label>
      <div class="flex gap-2">
        <button :class="btn" @click="addRoute">Tambah route</button>
        <button v-if="!isRouter" class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="setDns">Set DNS</button>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Route IPv6 saat ini</span>
        <div v-for="(r, k) in d.routes6 || []" :key="'r6' + k" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ r.dst }} → {{ r.gw }}</span>
          <button :class="del" title="Hapus route IPv6" @click="run([`ipv6 route remove dst-address=${r.dst}`])">×</button>
        </div>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">dst-address IPv6</span>
        <input :value="val('r6dst')" class="font-mono text-[12px]" :class="inp" placeholder="::/0" @input="setVal('r6dst', $event.target.value)" /></label>
      <label class="flex flex-col gap-1"><span :class="lbl">gateway IPv6</span>
        <input :value="val('r6gw')" class="font-mono text-[12px]" :class="inp" placeholder="2001:db8:1::2" @input="setVal('r6gw', $event.target.value)" /></label>
      <button :class="btn" @click="addRoute6">Tambah route IPv6</button>
    </section>

    <section v-if="tab === 'wlan'" class="flex flex-col gap-3">
      <template v-if="isRouter">
        <p v-if="d.wlan" class="font-mono text-[12px] text-muted">ssid {{ d.wlan.ssid }} · mode {{ d.wlan.mode || 'ap-bridge' }} · {{ d.wlan.pass ? 'WPA2' : 'Open' }}</p>
        <label class="flex flex-col gap-1"><span :class="lbl">SSID</span>
          <input :value="val('ssid')" :class="inp" @input="setVal('ssid', $event.target.value)" /></label>
        <label class="flex flex-col gap-1"><span :class="lbl">Password (min 8 karakter, kosongkan untuk open)</span>
          <input :value="val('pass')" type="password" :class="inp" @input="setVal('pass', $event.target.value)" /></label>
        <label class="flex flex-col gap-1"><span :class="lbl">Mode</span>
          <select :value="val('wmode') || 'ap-bridge'" :class="inp" @change="setVal('wmode', $event.target.value)">
            <option value="ap-bridge">ap-bridge (pancarkan)</option>
            <option value="station">station (klien)</option>
          </select></label>
        <button :class="btn" @click="setWlan">Terapkan</button>
      </template>
      <template v-else-if="d.type === 'laptop'">
        <p v-if="d.wifi" class="font-mono text-[12px] text-muted">klien ssid {{ d.wifi.ssid }}</p>
        <div class="flex gap-2">
          <button class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="scan">Scan jaringan</button>
          <button class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="run(['wifi status'])">Status</button>
        </div>
        <label class="flex flex-col gap-1"><span :class="lbl">SSID</span>
          <input :value="val('wssid')" :class="inp" @input="setVal('wssid', $event.target.value)" /></label>
        <label class="flex flex-col gap-1"><span :class="lbl">Password</span>
          <input :value="val('wpass')" type="password" :class="inp" @input="setVal('wpass', $event.target.value)" /></label>
        <button :class="btn" @click="connect">Hubungkan</button>
      </template>
      <p v-else class="text-[12px] text-dim">Perangkat ini tidak punya Wi-Fi.</p>
    </section>

    <section v-if="tab === 'dhcp'" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Saat ini</span>
        <div v-for="p in d.pools || []" :key="p.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">pool {{ p.name }} {{ p.from }}-{{ p.to }}</span>
          <button :class="del" @click="run([`ip pool remove name=${p.name}`])">×</button>
        </div>
        <div v-for="x in d.dhcp || []" :key="x.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">dhcp {{ x.name }} {{ x.interface }} ← {{ x.pool }}</span>
          <button :class="del" @click="run([`ip dhcp-server remove name=${x.name}`])">×</button>
        </div>
        <div v-for="n in d.dhcpNets || []" :key="n.address" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">net {{ n.address }} gw {{ n.gateway || '—' }} dns {{ n.dns || '—' }}</span>
          <button :class="del" @click="run([`ip dhcp-server network remove address=${n.address}`])">×</button>
        </div>
        <p v-if="!(d.pools?.length || d.dhcp?.length || d.dhcpNets?.length)" class="text-[12px] text-dim">Belum ada.</p>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">1. Pool: name & ranges (mis. 192.168.1.10-192.168.1.50)</span>
        <div class="flex gap-2">
          <input :value="val('poolname')" class="flex-1" :class="inp" placeholder="pool1" @input="setVal('poolname', $event.target.value)" />
          <input :value="val('ranges')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="192.168.1.10-192.168.1.50" @input="setVal('ranges', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addPool">Tambah pool</button>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">2. Network: address, gateway, dns</span>
        <div class="flex gap-2">
          <input :value="val('dhcpnet')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="192.168.1.0/24" @input="setVal('dhcpnet', $event.target.value)" />
          <input :value="val('dhcpgw')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="192.168.1.1" @input="setVal('dhcpgw', $event.target.value)" />
          <input :value="val('dhcpdns')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="8.8.8.8" @input="setVal('dhcpdns', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addDhcpNet">Tambah network</button>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">3. Server DHCP: interface + pool</span>
        <div class="flex gap-2">
          <input :value="val('dhcpname')" class="flex-1" :class="inp" placeholder="dhcp1" @input="setVal('dhcpname', $event.target.value)" />
          <input :value="val('dhcpiface')" class="flex-1" :class="inp" placeholder="ether1" @input="setVal('dhcpiface', $event.target.value)" />
          <input :value="val('dhcppool')" class="flex-1" :class="inp" placeholder="pool1" @input="setVal('dhcppool', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addDhcpSrv">Nyalakan server</button>
      </div>
    </section>

    <section v-if="tab === 'dhcpcli'" class="flex flex-col gap-3">
      <div v-for="c in d.dhcpClient || []" :key="c.interface" class="flex items-center gap-2 font-mono text-[12px] text-muted">
        <span class="flex-1">{{ c.interface }}: {{ c.ip || '(belum bound)' }}</span>
        <button class="text-[11px] text-info" @click="run([`ip dhcp-client renew interface=${c.interface}`])">renew</button>
        <button class="text-[11px] text-muted" @click="run([`ip dhcp-client release interface=${c.interface}`])">release</button>
        <button :class="del" @click="run([`ip dhcp-client remove interface=${c.interface}`])">×</button>
      </div>
      <p v-if="!d.dhcpClient?.length" class="text-[12px] text-dim">Belum ada client. Tambah di bawah, lalu renew.</p>
      <label class="flex flex-col gap-1"><span :class="lbl">Interface client</span>
        <select :value="val('cliface') || ipIfaces[0]?.name" :class="inp" @change="setVal('cliface', $event.target.value)">
          <option v-for="i in ipIfaces" :key="i.name" :value="i.name">{{ i.name }}</option>
        </select></label>
      <button :class="btn" @click="addDhcpCli">Tambah client</button>
    </section>

    <section v-if="tab === 'dns'" class="flex flex-col gap-3">
      <div v-for="s in d.dnsStatic || []" :key="s.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
        <span class="flex-1">static {{ s.name }} → {{ s.address }}</span>
        <button :class="del" @click="run([`ip dns static remove name=${s.name}`])">×</button>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">Nama host</span>
        <input :value="val('dnsname')" :class="inp" placeholder="web.lan" @input="setVal('dnsname', $event.target.value)" /></label>
      <label class="flex flex-col gap-1"><span :class="lbl">Alamat IP</span>
        <input :value="val('dnsaddr')" class="font-mono text-[12px]" :class="inp" placeholder="10.0.0.10" @input="setVal('dnsaddr', $event.target.value)" /></label>
      <button :class="btn" @click="addDnsStatic">Tambah catatan DNS</button>
    </section>

    <section v-if="tab === 'queue'" class="flex flex-col gap-3">
      <div v-for="q in d.queues || []" :key="q.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
        <span class="flex-1">{{ q.name }} {{ q.target }} {{ q.up }}/{{ q.down }} Mbps</span>
        <button :class="del" @click="run([`queue simple remove name=${q.name}`])">×</button>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">Nama</span>
        <input :value="val('qname')" :class="inp" @input="setVal('qname', $event.target.value)" /></label>
      <label class="flex flex-col gap-1"><span :class="lbl">Target (net/len)</span>
        <input :value="val('qtarget')" class="font-mono text-[12px]" :class="inp" placeholder="192.168.1.0/24" @input="setVal('qtarget', $event.target.value)" /></label>
      <label class="flex flex-col gap-1"><span :class="lbl">max-limit up/down (mis. 2M/5M)</span>
        <input :value="val('qlimit')" class="font-mono text-[12px]" :class="inp" placeholder="2M/5M" @input="setVal('qlimit', $event.target.value)" /></label>
      <button :class="btn" @click="addQueue">Tambah simple queue</button>
    </section>

    <section v-if="tab === 'fw'" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Filter</span>
        <div v-for="(fw, k) in d.fw || []" :key="k" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ fw.chain }} {{ fw.action }} {{ fw.src || '-' }} → {{ fw.dst || '-' }}</span>
          <button :class="del" @click="run([`ip firewall filter remove numbers=${k}`])">×</button>
        </div>
        <div class="flex gap-2">
          <select :value="val('fwchain') || 'forward'" :class="inp" @change="setVal('fwchain', $event.target.value)">
            <option value="forward">forward</option><option value="input">input</option>
          </select>
          <select :value="val('fwaction') || 'drop'" :class="inp" @change="setVal('fwaction', $event.target.value)">
            <option value="drop">drop</option><option value="accept">accept</option>
          </select>
        </div>
        <input :value="val('fwsrc')" class="font-mono text-[12px]" :class="inp" placeholder="src-address (opsional)" @input="setVal('fwsrc', $event.target.value)" />
        <input :value="val('fwdst')" class="font-mono text-[12px]" :class="inp" placeholder="dst-address (opsional)" @input="setVal('fwdst', $event.target.value)" />
        <div class="flex gap-2">
          <select :value="val('fwproto') || ''" :class="inp" @change="setVal('fwproto', $event.target.value)">
            <option value="">protocol (semua)</option><option value="tcp">tcp</option><option value="udp">udp</option><option value="icmp">icmp</option>
          </select>
          <input :value="val('fwdport')" class="font-mono text-[12px]" :class="inp" placeholder="dst-port (opsional)" @input="setVal('fwdport', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addFw">Tambah aturan filter</button>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">NAT</span>
        <div v-for="(n, k) in d.nat || []" :key="k" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ n.chain === 'dstnat' ? 'dstnat ' + n.action + ' ' + (n.redirect ? 'redirect' : (n.toAddr || '-')) + (n.toPort ? ':' + n.toPort : '') + (n.proto ? ' ' + n.proto : '') + (n.dport ? ' :' + n.dport : '') : 'srcnat masquerade out ' + n.out }}</span>
          <button :class="del" @click="run([`ip firewall nat remove numbers=${k}`])">×</button>
        </div>
        <select :value="val('natout') || ipIfaces[0]?.name" :class="inp" @change="setVal('natout', $event.target.value)">
          <option v-for="i in ipIfaces" :key="i.name" :value="i.name">{{ i.name }}</option>
        </select>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addNat">Tambah masquerade</button>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Address list</span>
        <div v-for="(a, k) in d.addrList || []" :key="k" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ a.list }} {{ a.address }} {{ a.timeout || 'static' }}</span>
          <button :class="del" title="Hapus address list" @click="delAddrList(k)">×</button>
        </div>
        <p v-if="!d.addrList?.length" class="text-[12px] text-dim">Belum ada. Dipakai sebagai daftar nama di filter/NAT (disimpan, belum mengeksekusi aturan).</p>
        <div class="flex gap-2">
          <input :value="val('allist')" class="flex-1" :class="inp" placeholder="blokir" @input="setVal('allist', $event.target.value)" />
          <input :value="val('aladdr')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="10.0.0.5" @input="setVal('aladdr', $event.target.value)" />
          <input :value="val('altimeout')" class="w-28" :class="inp" placeholder="timeout" @input="setVal('altimeout', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addAddrList">Tambah address list</button>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">dstnat (port-forward)</span>
        <div class="flex gap-2">
          <select :value="val('natd_action') || 'dst-nat'" :class="inp" @change="setVal('natd_action', $event.target.value)">
            <option value="dst-nat">dst-nat</option><option value="redirect">redirect</option>
          </select>
          <input :value="val('natd_to')" class="font-mono text-[12px]" :class="inp" placeholder="to-addresses" @input="setVal('natd_to', $event.target.value)" />
          <input :value="val('natd_toport')" class="font-mono text-[12px]" :class="inp" placeholder="to-ports" @input="setVal('natd_toport', $event.target.value)" />
        </div>
        <div class="flex gap-2">
          <select :value="val('natd_proto') || ''" :class="inp" @change="setVal('natd_proto', $event.target.value)">
            <option value="">protocol (semua)</option><option value="tcp">tcp</option><option value="udp">udp</option>
          </select>
          <input :value="val('natd_dport')" class="font-mono text-[12px]" :class="inp" placeholder="dst-port" @input="setVal('natd_dport', $event.target.value)" />
          <input :value="val('natd_inif')" class="font-mono text-[12px]" :class="inp" placeholder="in-interface" @input="setVal('natd_inif', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addDstnat">Tambah dstnat</button>
      </div>
    </section>

    <section v-if="tab === 'bridge'" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Bridge</span>
        <div v-for="b in bridges" :key="b.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ b.name }}: {{ b.members.join(', ') || '—' }}</span>
          <button :class="del" title="Hapus bridge" @click="run([`interface bridge remove name=${b.name}`])">×</button>
        </div>
        <p v-if="!bridges.length" class="text-[12px] text-dim">Belum ada bridge.</p>
        <input :value="val('brname')" :class="inp" placeholder="br1" @input="setVal('brname', $event.target.value)" />
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addBridge">Tambah bridge</button>
      </div>
      <div v-if="bridges.length" class="flex flex-col gap-1">
        <span :class="lbl">Tambah port ke bridge</span>
        <div class="flex gap-2">
          <select :value="val('bpon') || bridges[0]?.name" :class="inp" @change="setVal('bpon', $event.target.value)">
            <option v-for="b in bridges" :key="b.name" :value="b.name">{{ b.name }}</option>
          </select>
          <select :value="val('bpoif') || ipIfaces[0]?.name" :class="inp" @change="setVal('bpoif', $event.target.value)">
            <option v-for="i in ipIfaces" :key="i.name" :value="i.name">{{ i.name }}</option>
          </select>
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addBridgePort">Masukkan port</button>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Subinterface VLAN</span>
        <div v-for="i in d.ifaces.filter(x => x.vlan)" :key="i.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ i.name }} vlan {{ i.vlan }} via {{ i.parent }}</span>
          <button :class="del" @click="run([`interface vlan remove name=${i.name}`])">×</button>
        </div>
        <div class="flex gap-2">
          <input :value="val('vname')" class="flex-1" :class="inp" placeholder="vlan10" @input="setVal('vname', $event.target.value)" />
          <input :value="val('vid')" class="w-20 font-mono text-[12px]" :class="inp" placeholder="10" @input="setVal('vid', $event.target.value)" />
          <select :value="val('vparent') || ipIfaces[0]?.name" :class="inp" @change="setVal('vparent', $event.target.value)">
            <option v-for="i in ipIfaces" :key="i.name" :value="i.name">{{ i.name }}</option>
          </select>
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="addVlanIf">Tambah VLAN</button>
      </div>
    </section>

    <section v-if="tab === 'dyn'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">RIP</span>
        <div v-for="(n, k) in d.rip || []" :key="n" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ n }}</span>
          <button :class="del" @click="run([`routing rip network remove network=${n}`])">×</button>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">OSPF</span>
        <div v-for="(n, k) in d.ospf || []" :key="n" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ n }}</span>
          <button :class="del" @click="run([`routing ospf network remove network=${n}`])">×</button>
        </div>
      </div>
      <div class="flex gap-2">
        <select :value="val('dynproto') || 'ospf'" :class="inp" @change="setVal('dynproto', $event.target.value)">
          <option value="ospf">ospf</option><option value="rip">rip</option>
        </select>
        <input :value="val('dynnet')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="192.168.1.0/24" @input="setVal('dynnet', $event.target.value)" />
      </div>
      <button :class="btn" @click="addRouteDyn">Tambah network</button>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Route dinamis dipelajari</span>
        <div v-for="r in d.dyn || []" :key="r.dst + r.proto" class="font-mono text-[12px] text-info">{{ r.proto === 'ospf' ? 'O' : 'R' }} {{ r.dst }} → {{ r.gw }} ({{ r.m }})</div>
        <p v-if="!d.dyn?.length" class="text-[12px] text-dim">Belum ada.</p>
      </div>
    </section>

    <section v-if="tab === 'iface'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Interface</span>
        <div v-for="i in ifRows" :key="i.name" class="flex flex-wrap items-center gap-2 rounded-ctl border border-line px-2 py-1.5">
          <span class="font-mono text-[12px] text-fg">{{ i.name }}</span>
          <span v-if="i.cable" class="font-mono text-[11px] text-dim">{{ i.mac }}</span>
          <span class="font-mono text-[11px]" :class="i.status.startsWith('running') ? 'text-ok' : i.status === 'disabled' ? 'text-danger' : 'text-muted'">{{ i.status }}</span>
          <span class="font-mono text-[11px] text-muted">{{ i.addr || i.addr6 || '—' }}</span>
          <template v-if="i.cable">
            <input :value="val('cm_' + i.name)" class="ml-auto w-36 rounded-ctl border border-line bg-panel-2 px-2 py-1 text-[12px] text-fg outline-none focus:border-accent"
              :placeholder="i.comment || 'komentar'" :aria-label="'Komentar ' + i.name" @input="setVal('cm_' + i.name, $event.target.value)" />
            <button class="rounded-ctl border border-line px-2 py-1 text-[12px] text-muted hover:bg-panel-2" :disabled="(val('cm_' + i.name) || '') === (i.comment || '')"
              @click="setIface(i.name, `disabled=${i.disabled ? 'yes' : 'no'}${val('cm_' + i.name) ? ' comment=' + val('cm_' + i.name) : ''}`)">Simpan</button>
            <button class="rounded-ctl border border-line px-2 py-1 text-[12px] hover:bg-panel-2" :class="i.disabled ? 'text-ok' : 'text-danger'"
              @click="ifEnable(i.name, i.disabled)">{{ i.disabled ? 'Enable' : 'Disable' }}</button>
          </template>
        </div>
      </div>
      <p class="text-[12px] text-dim">Port yang di-disable membuat kabel DOWN: tetangga tidak terlihat di ARP, ping gagal, dan port tidak ikut STP.</p>
      <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['interface print detail'])">Cetak interface print detail</button>
    </section>

    <section v-if="tab === 'arp'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Tabel ARP</span>
        <div v-for="(a, k) in arpRows" :key="a.ip + k" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ a.ip }} · {{ a.mac }} · {{ a.iface }} · {{ a.name }}</span>
          <button :class="del" title="Hapus entri ARP" @click="dropArp(a.ip)">×</button>
        </div>
        <p v-if="!arpRows.length" class="text-[12px] text-dim">Belum ada tetangga L2 yang terjangkau.</p>
      </div>
      <div class="flex gap-2">
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['ip arp print'])">Cetak ip arp print</button>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['ip neighbor print'])">Cetak ip neighbor print</button>
      </div>
      <p class="text-[12px] text-dim">Entri diturunkan dari topologi (bukan cache ARP sungguhan). Remove menyembunyikan entri sampai topologi dimuat ulang.</p>
    </section>

    <section v-if="tab === 'user'" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">User lokal</span>
        <div v-for="(u, k) in users" :key="u.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
          <span class="flex-1">{{ k }} {{ u.name }} · {{ u.group }}</span>
          <button v-if="u.name !== 'admin'" :class="del" title="Hapus user" @click="delUser(u.name)">×</button>
        </div>
      </div>
      <div class="flex gap-2">
        <input :value="val('uname')" class="flex-1" :class="inp" placeholder="operator" @input="setVal('uname', $event.target.value)" />
        <select :value="val('ugroup') || 'read'" class="w-32" :class="inp" @change="setVal('ugroup', $event.target.value)">
          <option v-for="g in USER_GROUPS" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <button :class="btn" @click="addUser">Tambah user</button>
      <p class="text-[12px] text-dim">Tidak ada autentikasi di simulator; user hanya data konfigurasi.</p>
    </section>

    <section v-if="tab === 'sistem'" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Sistem</span>
        <div class="grid grid-cols-2 gap-1 font-mono text-[12px] text-muted">
          <span>identity</span><span class="text-fg">{{ d.name }}</span>
          <span>version</span><span class="text-fg">7.16.2 (simulasi)</span>
          <span>interface</span><span class="text-fg">{{ ifRows.length }}</span>
          <span>log</span><span class="text-fg">{{ logs.length }} entri terakhir</span>
        </div>
        <div class="flex gap-2">
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['system resource print'])">system resource print</button>
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['system clock print'])">system clock print</button>
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['ip service print'])">ip service print</button>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">Ubah nama perangkat</span>
        <input :value="val('idname') || d.name" class="font-mono text-[12px]" :class="inp" placeholder="R1" @input="setVal('idname', $event.target.value)" />
        <button :class="btn" @click="setIdentity">system identity set</button>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">Jam perangkat (tampilan saja)</span>
        <div class="flex gap-2">
          <input :value="val('cdate')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="2026-01-01" @input="setVal('cdate', $event.target.value)" />
          <input :value="val('ctime')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="10:00:00" @input="setVal('ctime', $event.target.value)" />
        </div>
        <button :class="btn" @click="setClock">system clock set</button>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-2xs uppercase tracking-wide text-dim">Log terakhir</span>
        <div v-for="(e, k) in logs" :key="k" class="font-mono text-[12px] text-muted">{{ e.msg }}</div>
        <p v-if="!logs.length" class="text-[12px] text-dim">Belum ada perubahan tercatat.</p>
        <div class="flex gap-2">
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="run(['log print'])">Cetak log print</button>
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-danger text-[12px]" @click="reboot">system reboot</button>
        </div>
      </div>
    </section>

    <section v-if="tab === 'cmd'" class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-1.5">
        <button v-for="c in CMD_TOOLS" :key="c" class="px-2 py-1 rounded-ctl border border-line font-mono text-[12px] text-muted hover:bg-panel-2" @click="cmdTool(c)">{{ c }}</button>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">Tujuan (IP atau nama)</span>
        <div class="flex gap-2">
          <input :value="val('wping')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="192.168.1.10" @input="setVal('wping', $event.target.value)" />
          <input :value="val('wn')" class="w-16 font-mono text-[12px]" :class="inp" placeholder="4" aria-label="Jumlah paket" @input="setVal('wn', $event.target.value)" />
        </div>
        <div class="flex gap-2">
          <button :class="btn" @click="cmdPing">ping</button>
          <button class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="cmdTrace">tracert</button>
          <button class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="run(['netstat'])">netstat</button>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">Nama host untuk nslookup</span>
        <div class="flex gap-2">
          <input :value="val('wname')" class="flex-1" :class="inp" placeholder="web.lan" @input="setVal('wname', $event.target.value)" />
          <input :value="val('wserver')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="server DNS (opsional)" @input="setVal('wserver', $event.target.value)" />
        </div>
        <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]" @click="cmdResolve">nslookup</button>
      </div>
      <div class="flex flex-col gap-1">
        <span :class="lbl">Gateway (route add)</span>
        <div class="flex gap-2">
          <input :value="val('rtarget') || '0.0.0.0'" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="0.0.0.0" @input="setVal('rtarget', $event.target.value)" />
          <input :value="val('rmask') || '0.0.0.0'" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="0.0.0.0" @input="setVal('rmask', $event.target.value)" />
          <input :value="val('rgw') || (d.routes?.[0]?.gw || '')" class="flex-1 font-mono text-[12px]" :class="inp" placeholder="192.168.1.1" @input="setVal('rgw', $event.target.value)" />
        </div>
        <div class="flex gap-2">
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]"
            @click="run([`route add ${val('rtarget') || '0.0.0.0'} mask ${val('rmask') || '0.0.0.0'} ${val('rgw')}`])">route add</button>
          <button class="self-start px-3 py-1 rounded-ctl border border-line text-muted text-[12px]"
            @click="run([`route delete ${val('rtarget') || '0.0.0.0'}`])">route delete</button>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="cmdDhcp('ipconfig /renew')">ipconfig /renew</button>
        <button class="px-3 py-1.5 rounded-ctl border border-line text-muted text-[13px]" @click="cmdDhcp('ipconfig /release')">ipconfig /release</button>
      </div>
      <p class="text-[12px] text-dim">Semua tombol di tab ini menjalankan perintah CMD yang sama seperti yang diketik di terminal.</p>
    </section>

    <section v-if="tab === 'vlan' && isSwitch" class="flex flex-col gap-3">
      <div v-for="i in d.ifaces" :key="i.name" class="flex items-center gap-2 font-mono text-[12px] text-muted">
        <span class="flex-1">{{ i.name }}: {{ portCfgOf(i.name).mode === 'access' ? 'access vlan ' + portCfgOf(i.name).vlan : 'trunk ' + (portCfgOf(i.name).vlans || []).join(',') }}</span>
        <button :class="del" title="Reset ke access vlan 1" @click="run([`vlan remove port=${i.name}`])">×</button>
      </div>
      <label class="flex flex-col gap-1"><span :class="lbl">Port</span>
        <select :value="val('vport') || d.ifaces[0].name" :class="inp" @change="setVal('vport', $event.target.value)">
          <option v-for="i in d.ifaces" :key="i.name" :value="i.name">{{ i.name }}</option>
        </select></label>
      <label class="flex flex-col gap-1"><span :class="lbl">Mode</span>
        <select :value="val('vmode') || 'access'" :class="inp" @change="setVal('vmode', $event.target.value)">
          <option value="access">access</option><option value="trunk">trunk</option>
        </select></label>
      <label v-if="val('vmode') !== 'trunk'" class="flex flex-col gap-1"><span :class="lbl">VLAN ID</span>
        <input :value="val('vvid')" class="font-mono text-[12px]" :class="inp" placeholder="10" @input="setVal('vvid', $event.target.value)" /></label>
      <label v-else class="flex flex-col gap-1"><span :class="lbl">VLAN IDs (koma)</span>
        <input :value="val('vids')" class="font-mono text-[12px]" :class="inp" placeholder="10,20" @input="setVal('vids', $event.target.value)" /></label>
      <button :class="btn" @click="applyVlan">Terapkan</button>
    </section>

    <section v-if="tab === 'tes'" class="flex flex-col gap-3">
      <label class="flex flex-col gap-1"><span :class="lbl">Ping tujuan (ip/nama)</span>
        <input :value="val('tping')" class="font-mono text-[12px]" :class="inp" @input="setVal('tping', $event.target.value)" /></label>
      <button :class="btn" @click="val('tping') && run(['ping ' + val('tping')])">Jalankan ping</button>
      <p class="text-[12px] text-dim">Hasil ping, traceroute, speedtest, dan seluruh perintah tampil di terminal perangkat ini.</p>
    </section>
  </div>
</template>
