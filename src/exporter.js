import bricolage from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url'
import mono from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url'
import { useUi } from './stores/ui'

const DARK_TOKENS = [
  '--color-info:#0ea5e9', '--color-ok:#10b981', '--color-accent:#3b82f6', '--color-wifi:#8b5cf6',
  '--color-fg:#f8fafc', '--color-muted:#cbd5e1', '--color-dim:#64748b', '--color-cable:#3b82f6',
  '--color-canvas:#090d16', '--color-chrome:#0f172a', '--color-panel:rgba(30,41,59,0.9)', '--color-panel-2:#1e293b',
  '--color-node:#1e293b', '--color-line:#334155', '--color-line-strong:#475569', '--color-danger:#ef4444',
  '--color-grid:#1e293b', '--color-grid-strong:#334155', '--color-accent-soft:#60a5fa', '--color-accent-fg:#ffffff',
  "--font-mono:'JetBrains Mono Variable',ui-monospace,monospace"
].join(';')

const LIGHT_TOKENS = [
  '--color-info:#0284c7', '--color-ok:#15803d', '--color-accent:#1d4ed8', '--color-wifi:#6d28d9',
  '--color-fg:#0f172a', '--color-muted:#334155', '--color-dim:#64748b', '--color-cable:#2563eb',
  '--color-canvas:#f1f5f9', '--color-chrome:#ffffff', '--color-panel:rgba(255,255,255,0.95)', '--color-panel-2:#f8fafc',
  '--color-node:#ffffff', '--color-line:#cbd5e1', '--color-line-strong:#94a3b8', '--color-danger:#b91c1c',
  '--color-grid:#e2e8f0', '--color-grid-strong:#cbd5e1', '--color-accent-soft:#2563eb', '--color-accent-fg:#ffffff',
  "--font-mono:'JetBrains Mono Variable',ui-monospace,monospace"
].join(';')

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

export async function toPng(svgEl, { scale = 2, background = null, name = 'mikrolab-topologi.png' } = {}) {
  if (!svgEl) throw new Error('kanvas belum siap')
  const ui = useUi()
  const isLight = ui.theme === 'light'
  const bg = background || (isLight ? '#f1f5f9' : '#090d16')
  const tokens = isLight ? LIGHT_TOKENS : DARK_TOKENS
  const accentHex = isLight ? '#1d4ed8' : '#3b82f6'

  const r = svgEl.getBoundingClientRect()
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height))

  const clone = svgEl.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  const css = await fontCss()
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `svg{${tokens};--suit-accent:${accentHex};--color-accent:${accentHex}}` + css + '.wifi-flow{stroke-dasharray:6 6;animation:none}.cable-flow{stroke-dasharray:2 10;animation:none}'
  clone.prepend(style)
  if (!css) ui.notify('Gambar diekspor tanpa font khusus', 'info')

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg tidak dapat dirender')); img.src = url })
    const cv = document.createElement('canvas')
    cv.width = w * scale
    cv.height = h * scale
    const ctx = cv.getContext('2d')
    ctx.fillStyle = bg
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
