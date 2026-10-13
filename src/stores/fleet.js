import { defineStore } from 'pinia'
import { exec } from '../engine'
import { runFleet, parseVars, renderScript, scriptChanges } from '../fleet'

export const useFleet = defineStore('fleet', {
  state: () => ({
    sel: [],      // id device terpilih
    script: '# contoh: beri IP dan gateway ke setiap router\n/ip address add address={{ip}}/24 interface=ether1\n/ip route add dst-address=0.0.0.0/0 gateway={{gw}}',
    varsText: 'ip=192.168.88.1\ngw=192.168.88.254',
    results: [],  // hasil run terakhir: [{id, name, ok, lines, changed}]
    missing: [],
    busy: false
  }),
  actions: {
    toggle(id) { this.sel = this.sel.includes(id) ? this.sel.filter(x => x !== id) : [...this.sel, id] },
    clear() { this.sel = [] },
    all(net) { this.sel = Object.keys(net.devices) },
    routers(net) { this.sel = Object.values(net.devices).filter(d => d.type === 'router').map(d => d.id) },
    // Dry-run: tampilkan skrip efektif + daftar var tanpa nilai; tidak menyentuh topologi
    preview() {
      const vars = parseVars(this.varsText)
      const { out, missing } = renderScript(this.script, vars)
      return { script: out, missing }
    },
    run(net) {
      this.busy = true
      try {
        const vars = parseVars(this.varsText)
        const { missing } = renderScript(this.script, vars)
        if (missing.length) { this.missing = missing; this.results = []; return { skipped: true } }
        // commit SEBELUM eksekusi supaya Ctrl+Z mengurungkan seluruh batch
        if (scriptChanges(this.script)) net.commit()
        const r = runFleet(net, this.sel, this.script, vars, (d, line) => exec(net, d, line))
        this.missing = r.missing
        this.results = r.results
        if (r.badVar) { net.note('Nama variabel tidak valid: ' + r.badVar, 'error'); return { skipped: true } }
        return { count: r.results.length, changed: r.results.some(x => x.changed) }
      } finally { this.busy = false }
    }
  }
})
