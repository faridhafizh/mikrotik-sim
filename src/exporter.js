import bricolage from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url'
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'
import { useUi } from './stores/ui'

// Token yang dipakai visual kanvas. SVG yang dimuat lewat <img> tidak mewarisi
// stylesheet halaman, jadi variabel + aturan dash disuntikkan ke dalam clone.
const TOKENS = [
  '--color-info:#00e5ff', '--color-ok:#3dffa2', '--color-accent:#00e5ff', '--color-wifi:#b28bff',
  '--color-fg:#dff3ff', '--color-muted:#9fc3dd', '--color-dim:#6d93ad', '--color-cable:#41c8e8',
  '--color-canvas:#04090f', '--color-chrome:#071522', '--color-panel:#0a1a28', '--color-panel-2:#0e2a44',
  '--color-node:#0b2237', '--color-line:#1b3f5e', '--color-line-strong:#2e6a99', '--color-danger:#ff5d5d',
  '--color-grid:#0d2a42', '--color-grid-strong:#174a75', '--color-accent-soft:#7df3ff', '--color-accent-fg:#03161d',
  "--font-mono:'JetBrains Mono Variable',ui-monospace,monospace"
].join(';')

// Nilai --suit-accent per mode (harus sinkron dengan app.css) supaya PNG ikut mode aktif.
const SUIT_ACCENT = { power: '#ff7a1a', armor: '#00e5ff', cloak: '#b28bff' }

function toBase64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

async function fontCss() {
  try {
    const [a, b] = await Promise.all([fetch(bricolage), fetch(mono)])
    if (!a.ok || !b.ok) return ''
    const [ab, bb] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()])
    return `@font-face{font-family:'Bricolage Grotesque Variable';src:url(data:font/woff2;base64,${toBase64(ab)}) format('woff2-variations');font-weight:200 800}`
      + `@font-face{font-family:'JetBrains Mono Variable';src:url(data:font/woff2;base64,${toBase64(bb)}) format('woff2-variations');font-weight:100 800}`
  } catch { return '' }
}

export async function toPng(svgEl, { scale = 2, background = '#04090f', name = 'mikrolab-topologi.png' } = {}) {
  if (!svgEl) throw new Error('kanvas belum siap')
  const r = svgEl.getBoundingClientRect()
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height))

  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  const css = await fontCss()
  const suitAccent = SUIT_ACCENT[useUi().suit] || SUIT_ACCENT.armor
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `svg{${TOKENS};--suit-accent:${suitAccent};--color-accent:${suitAccent}}` + css + '.wifi-flow{stroke-dasharray:6 6;animation:none}.cable-flow{stroke-dasharray:2 10;animation:none}'
  clone.prepend(style)
  if (!css) useUi().notify('Gambar diekspor tanpa font khusus', 'info')

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg tidak dapat dirender')); img.src = url })
    const cv = document.createElement('canvas')
    cv.width = w * scale
    cv.height = h * scale
    const ctx = cv.getContext('2d')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.drawImage(img, 0, 0, cv.width, cv.height)
    const out = await new Promise(res => cv.toBlob(res, 'image/png'))
    if (!out) throw new Error('canvas tidak dapat dikodekan')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(out)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  } finally { URL.revokeObjectURL(url) }
}
