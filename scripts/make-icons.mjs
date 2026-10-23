// 產生網站圖示（favicon、加到主畫面的圖示）。
// 圖示用專門畫的 20×19 大頭蕃茄：大眼睛加反光、腮紅、小嘴、捲捲的蒂頭，底色是奶油黃，
// 比畫面上 16×16 的小蕃茄多一點細節，縮到手機桌面上也看得出表情。
// 用法：npm run icons

import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const OUT_DIR = 'public/icons'

const COLORS = {
  background: '#ffe7b3',
  sparkle: '#ffb4a8',
  outline: '#5d275d',
  body: '#f2525c',
  shade: '#c23a52',
  highlight: '#ffb4a8',
  shine: '#fff4ec',
  leaf: '#5fcf6f',
  leafDark: '#2f8f5b',
  eye: '#1a1c2c',
  eyeShine: '#ffffff',
  blush: '#ff8fa3',
  mouth: '#5d275d',
}

const WIDTH = 20
const HEIGHT = 19
const BODY = { cx: 9.5, cy: 11, rx: 9.6, ry: 7.6 }

function inBody(x, y) {
  const dx = (x - BODY.cx) / BODY.rx
  const dy = (y - BODY.cy) / BODY.ry
  return dx * dx + dy * dy <= 1
}

// 畫面上要蓋在身體上的部位：[x, y, 顏色名稱]
const OVERLAY = [
  // 捲捲的蒂頭
  [11, 0, 'leafDark'],
  [12, 0, 'leafDark'],
  [10, 1, 'leafDark'],
  [10, 2, 'leafDark'],
  // 五片葉子
  ...[6, 7, 8, 9, 11, 12, 13].map((x) => [x, 3, 'leaf']),
  [10, 3, 'leafDark'],
  [5, 3, 'leafDark'],
  [14, 3, 'leafDark'],
  ...[4, 15].map((x) => [x, 4, 'leafDark']),
  ...[5, 6, 8, 9, 10, 11, 13, 14].map((x) => [x, 4, 'leaf']),
  ...[7, 12].map((x) => [x, 4, 'leafDark']),
  ...[5, 9, 10, 14].map((x) => [x, 5, 'leafDark']),
  // 左上的反光
  [4, 7, 'shine'],
  [5, 7, 'shine'],
  [3, 8, 'shine'],
  [3, 9, 'highlight'],
  [6, 7, 'highlight'],
  // 大眼睛（2×3）加左上一點反光
  ...[
    [5, 10],
    [6, 10],
    [5, 11],
    [6, 11],
    [5, 12],
    [6, 12],
    [13, 10],
    [14, 10],
    [13, 11],
    [14, 11],
    [13, 12],
    [14, 12],
  ].map(([x, y]) => [x, y, 'eye']),
  [5, 10, 'eyeShine'],
  [13, 10, 'eyeShine'],
  // 腮紅
  [3, 13, 'blush'],
  [4, 13, 'blush'],
  [15, 13, 'blush'],
  [16, 13, 'blush'],
  // ω 形的小嘴
  [8, 13, 'mouth'],
  [9, 14, 'mouth'],
  [10, 13, 'mouth'],
  [11, 14, 'mouth'],
  [12, 13, 'mouth'],
]

function buildSprite() {
  const grid = new Map()
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!inBody(x, y)) continue
      const edge = !inBody(x - 1, y) || !inBody(x + 1, y) || !inBody(x, y - 1) || !inBody(x, y + 1)
      // 右下內側一圈陰影，做出圓滾滾的立體感
      const shade = !inBody(x + 2, y + 2) || !inBody(x + 1, y + 2)
      grid.set(`${x},${y}`, edge ? 'outline' : shade ? 'shade' : 'body')
    }
  }
  for (const [x, y, color] of OVERLAY) grid.set(`${x},${y}`, color)
  return [...grid].map(([key, color]) => {
    const [x, y] = key.split(',').map(Number)
    return { x, y, color }
  })
}

const sprite = buildSprite()

// 背景角落的小星星（十字形），讓圖示不會太空
function sparkles(size) {
  const unit = Math.max(1, Math.round(size / 64))
  const points = [
    [0.14, 0.16],
    [0.86, 0.2],
    [0.84, 0.86],
  ]
  return points.flatMap(([fx, fy]) => {
    const cx = Math.round(size * fx)
    const cy = Math.round(size * fy)
    return [
      [cx, cy],
      [cx - unit, cy],
      [cx + unit, cy],
      [cx, cy - unit],
      [cx, cy + unit],
    ].map(([x, y]) => ({ x, y, w: unit, color: 'sparkle' }))
  })
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function renderPixels(size, ratio, withSparkles) {
  const scale = Math.floor((size * ratio) / WIDTH)
  const offsetX = Math.floor((size - scale * WIDTH) / 2)
  const offsetY = Math.floor((size - scale * HEIGHT) / 2) + Math.round(scale / 2)
  const rgba = Buffer.alloc(size * size * 4)
  const fill = (x0, y0, w, h, color) => {
    const [r, g, b] = hexToRgb(COLORS[color])
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x++) {
        rgba.set([r, g, b, 255], (y * size + x) * 4)
      }
    }
  }
  fill(0, 0, size, size, 'background')
  if (withSparkles) for (const s of sparkles(size)) fill(s.x, s.y, s.w, s.w, s.color)
  for (const { x, y, color } of sprite) {
    fill(offsetX + x * scale, offsetY + y * scale, scale, scale, color)
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

// 瀏覽器分頁的小圖示：透明底，只畫蕃茄
function renderSvg() {
  const rects = sprite
    .map(
      ({ x, y, color }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS[color]}"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${WIDTH}" shape-rendering="crispEdges"><g transform="translate(0 0.5)">${rects}</g></svg>\n`
}

// maskable 圖示會被系統裁成圓形，蕃茄要縮在中間的安全區域裡
const PNGS = [
  { name: 'apple-touch-icon.png', size: 180, ratio: 0.78, sparkles: true },
  { name: 'icon-192.png', size: 192, ratio: 0.78, sparkles: true },
  { name: 'icon-512.png', size: 512, ratio: 0.78, sparkles: true },
  { name: 'icon-maskable-512.png', size: 512, ratio: 0.6, sparkles: false },
]

await mkdir(OUT_DIR, { recursive: true })
await writeFile(`${OUT_DIR}/favicon.svg`, renderSvg())
for (const { name, size, ratio, sparkles: withSparkles } of PNGS) {
  await writeFile(`${OUT_DIR}/${name}`, encodePng(size, renderPixels(size, ratio, withSparkles)))
}
console.log(`已產生 ${PNGS.length + 1} 個圖示到 ${OUT_DIR}/`)
