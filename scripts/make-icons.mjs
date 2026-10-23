// 用畫面上同一份蕃茄點陣圖產生網站圖示（favicon、加到主畫面的圖示）。
// 用法：npm run icons（需要 Node 23.6 以上，直接讀 .ts）

import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import { buildTomatoSprite, SPRITE_SIZE } from '../src/core/tomatoSprite.ts'

const OUT_DIR = 'public/icons'

// 與 src/styles/tokens.css 的 Sweetie 16 色盤一致（熟透的紅蕃茄）
const BACKGROUND = '#1a1c2c'
const TONES = {
  outline: '#1a1c2c',
  eye: '#1a1c2c',
  body: '#b13e53',
  shade: '#5d275d',
  highlight: '#ef7d57',
  leaf: '#38b764',
  leafDark: '#257179',
  cheek: '#ef7d57',
}

const sprite = buildTomatoSprite('awake')

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// 外框是深色、背景也是深色，所以圖示底色用稍亮的一圈把蕃茄襯出來
function renderPixels(size, ratio) {
  const scale = Math.floor((size * ratio) / SPRITE_SIZE)
  const offset = Math.floor((size - scale * SPRITE_SIZE) / 2)
  const rgba = Buffer.alloc(size * size * 4)
  const [br, bg, bb] = hexToRgb(BACKGROUND)
  for (let i = 0; i < size * size; i++) rgba.set([br, bg, bb, 255], i * 4)
  for (const { x, y, tone } of sprite) {
    const [r, g, b] = hexToRgb(TONES[tone])
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const px = offset + x * scale + dx
        const py = offset + y * scale + dy
        rgba.set([r, g, b, 255], (py * size + px) * 4)
      }
    }
  }
  return rgba
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8 bit、RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function renderSvg() {
  const rects = sprite
    .map(({ x, y, tone }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${TONES[tone]}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}" shape-rendering="crispEdges">${rects}</svg>\n`
}

// maskable 圖示會被系統裁成圓形，蕃茄要縮在中間 80% 的安全區域裡
const PNGS = [
  { name: 'apple-touch-icon.png', size: 180, ratio: 0.8 },
  { name: 'icon-192.png', size: 192, ratio: 0.8 },
  { name: 'icon-512.png', size: 512, ratio: 0.8 },
  { name: 'icon-maskable-512.png', size: 512, ratio: 0.6 },
]

await mkdir(OUT_DIR, { recursive: true })
await writeFile(`${OUT_DIR}/favicon.svg`, renderSvg())
for (const { name, size, ratio } of PNGS) {
  await writeFile(`${OUT_DIR}/${name}`, encodePng(size, renderPixels(size, ratio)))
}
console.log(`已產生 ${PNGS.length + 1} 個圖示到 ${OUT_DIR}/`)
