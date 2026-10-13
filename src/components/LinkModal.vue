<script setup>
import { computed, reactive, watch } from 'vue'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { CABLE_TYPES, PORT_KINDS, defaultCableFor, freePorts } from '../linkmodel.js'

const net = useNet(), ui = useUi()
const inp = 'w-full bg-panel-2 border border-line rounded-ctl px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent'
const A = computed(() => net.devices[ui.modal?.aId] || null)
const B = computed(() => net.devices[ui.modal?.bId] || null)
const ports = id => (net.devices[id]?.ifaces || []).filter(i => i.kind)
const used = (id, name) => net.links.some(l => (l.a.dev === id && l.a.if === name) || (l.b.dev === id && l.b.if === name))
const kindOf = (id, name) => ports(id).find(i => i.name === name)?.kind || null
const label = i => `${i.name} (${PORT_KINDS[i.kind].label})${used(i.devId, i.name) ? ' (terpakai)' : ''}`

const form = reactive({ portA: '', portB: '', cable: 'cat6' })
watch(() => ui.modal, () => {
  const a = A.value, b = B.value
  if (!a || !b) return
  form.portA = freePorts(a, net.links, a.id)[0]?.name || ''
  form.portB = freePorts(b, net.links, b.id)[0]?.name || ''
  form.cable = defaultCableFor(kindOf(a.id, form.portA), kindOf(b.id, form.portB))
}, { immediate: true })
watch(() => [form.portA, form.portB, ui.modal], () => {
  form.cable = defaultCableFor(kindOf(A.value?.id, form.portA), kindOf(B.value?.id, form.portB))
})

const noRoom = computed(() => !form.portA || !form.portB)
const canConnect = computed(() => !noRoom.value && !used(A.value.id, form.portA) && !used(B.value.id, form.portB))
function submit() {
  if (!canConnect.value) return
  net.connect(A.value.id, form.portA, B.value.id, form.portB, form.cable)
  ui.answer(null)
}
</script>

<template>
  <div v-if="A && B" class="mt-4 flex flex-col gap-3">
    <div class="grid grid-cols-2 gap-2 text-[13px]">
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-dim">{{ A.name }} — port</span>
        <select :class="inp" :value="form.portA" @change="form.portA = $event.target.value">
          <option v-if="!form.portA" value="" disabled>Tidak ada port kabel kosong</option>
          <option v-for="i in ports(A.id)" :key="i.name" :value="i.name" :disabled="used(A.id, i.name) && i.name !== form.portA">{{ label({ ...i, devId: A.id }) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-2xs text-dim">{{ B.name }} — port</span>
        <select :class="inp" :value="form.portB" @change="form.portB = $event.target.value">
          <option v-if="!form.portB" value="" disabled>Tidak ada port kabel kosong</option>
          <option v-for="i in ports(B.id)" :key="i.name" :value="i.name" :disabled="used(B.id, i.name) && i.name !== form.portB">{{ label({ ...i, devId: B.id }) }}</option>
        </select>
      </label>
    </div>
    <label class="flex flex-col gap-1 text-[13px]">
      <span class="text-2xs text-dim">Kabel</span>
      <select :class="inp" :value="form.cable" @change="form.cable = $event.target.value">
        <option v-for="(c, k) in CABLE_TYPES" :key="k" :value="k">{{ c.label }}</option>
      </select>
    </label>
    <p v-if="noRoom" class="text-[12px] text-dim">Tidak ada port kabel kosong</p>
    <div class="flex justify-end gap-2">
      <button class="px-3 py-1.5 rounded-ctl border border-line text-[13px] text-muted hover:bg-panel-2" @click="ui.answer(null)">Batal</button>
      <button class="px-3 py-1.5 rounded-ctl bg-accent text-accent-fg text-[13px] font-semibold disabled:opacity-40" data-primary
        :disabled="!canConnect" @click="submit">Sambungkan</button>
    </div>
  </div>
</template>
