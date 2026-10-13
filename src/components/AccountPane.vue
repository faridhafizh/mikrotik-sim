<script setup>
import { ref } from 'vue'
import { User, Trash2 } from 'lucide-vue-next'
import { useNet } from '../stores/net'
import { useUi } from '../stores/ui'
import { relTime } from '../fmt'

const net = useNet(), ui = useUi()
const u = ref(''), p = ref(''), err = ref(''), busy = ref(false)

async function submit(mode) {
  err.value = ''
  if (!/^[a-z0-9_]{3,30}$/i.test(u.value) || p.value.length < 6) {
    err.value = 'Username 3-30 huruf/angka/_, password minimal 6 karakter'
    return
  }
  busy.value = true
  try { await net.auth(mode, u.value, p.value); p.value = '' }
  catch (e) { err.value = e.message }
  finally { busy.value = false }
}
async function save() {
  if (net.curId) return net.save()
  const name = await ui.askText({ title: 'Nama topologi', label: 'Nama', value: 'Topologi baru', max: 80 })
  if (name !== null) await net.save(name)
}
async function del(t) {
  const ok = await ui.ask({ title: 'Hapus topologi?', body: 'Topologi ' + t.name + ' akan dihapus permanen dari akun Anda.', confirm: 'Hapus' })
  if (ok) await net.delTopo(t.id)
}
</script>

<template>
  <div v-if="!net.user" class="flex flex-col gap-2">
    <label class="flex flex-col gap-1">
      <span class="text-2xs text-dim">Username</span>
      <input v-model="u" autocomplete="username" class="bg-panel-2 border border-line rounded-ctl px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-2xs text-dim">Password</span>
      <input v-model="p" type="password" autocomplete="current-password" class="bg-panel-2 border border-line rounded-ctl px-2.5 py-1.5 text-[13px] text-fg outline-none focus:border-accent"
        @keydown.enter.prevent="submit('login')" />
    </label>
    <p v-if="err" class="text-[12px] text-danger leading-snug">{{ err }}</p>
    <div class="flex gap-2">
      <button class="hex-clip flex-1 px-2 py-1.5 rounded-ctl bg-accent text-accent-fg text-[13px] font-semibold disabled:opacity-50" :disabled="busy" @click="submit('login')">
        {{ busy ? 'Memproses…' : 'Masuk' }}
      </button>
      <button class="hex-clip px-2 py-1.5 rounded-ctl border border-line text-[13px] text-muted hover:bg-panel-2 disabled:opacity-50" :disabled="busy" @click="submit('register')">Daftar</button>
    </div>
  </div>

  <div v-else class="flex flex-col gap-3">
    <div class="relative flex items-center gap-2 glass border border-line rounded-ctl px-2.5 py-2">
      <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r border-line-strong pointer-events-none" aria-hidden="true"></span>
      <User :size="15" class="text-accent" />
      <span class="text-[13px] font-semibold flex-1 truncate">{{ net.user }}</span>
      <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="net.logout()">Keluar</button>
    </div>
    <div class="flex flex-wrap gap-1.5">
      <button class="hex-clip px-2 py-1 rounded-ctl bg-accent text-accent-fg text-2xs font-semibold" @click="save">Simpan topologi</button>
      <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="net.curId = null; ui.notify('Simpan berikutnya membuat topologi baru', 'info')">Simpan sebagai baru</button>
      <button class="hex-clip px-2 py-1 rounded-ctl border border-line text-2xs text-muted hover:bg-panel-2" @click="net.share()">Bagikan tautan</button>
    </div>

    <section class="flex flex-col gap-1.5">
      <h3 class="hud-label text-2xs text-accent">Topologi saya</h3>
      <div v-for="t in net.topologies" :key="t.id" class="relative flex items-center gap-2 glass border rounded-ctl px-2.5 py-1.5"
        :class="net.curId === t.id ? 'border-accent suit-glow' : 'border-line'" :aria-current="net.curId === t.id ? 'true' : 'false'">
        <span class="absolute top-1.5 right-1.5 w-2 h-2 border-t border-r pointer-events-none" :class="net.curId === t.id ? 'border-accent' : 'border-line-strong'" aria-hidden="true"></span>
        <button class="flex-1 text-left min-w-0" :title="'Muat ' + t.name" @click="net.load(t.id)">
          <span class="block text-[12px] text-fg truncate">{{ t.name }}</span>
          <span class="block text-2xs text-dim">{{ relTime(t.updated_at) }}</span>
        </button>
        <button class="hex-clip shrink-0 p-1 rounded-ctl text-danger hover:bg-panel-2" title="Hapus topologi" aria-label="Hapus topologi" @click="del(t)">
          <Trash2 :size="14" />
        </button>
      </div>
      <p v-if="!net.topologies.length" class="text-[12px] text-dim">Belum ada topologi tersimpan.</p>
    </section>
  </div>
</template>
