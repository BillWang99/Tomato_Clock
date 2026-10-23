// 像素蕃茄主角的點陣圖。只回傳「每一格是什麼部位」，顏色由畫面元件依階段決定，
// 所以同一份圖可以給網頁（CSS 變數）和圖示產生腳本（色碼）共用。

export type SpriteTone =
  'outline' | 'body' | 'shade' | 'highlight' | 'leaf' | 'leafDark' | 'eye' | 'cheek'

/** awake：專注中睜眼；relaxed：短休息瞇眼；sleepy：長休息睡著 */
export type TomatoMood = 'awake' | 'relaxed' | 'sleepy'

export interface SpritePixel {
  x: number
  y: number
  tone: SpriteTone
}

export const SPRITE_SIZE = 16

const BODY = { cx: 7.5, cy: 9.2, rx: 7.4, ry: 6.4 }

// 蒂頭與葉子，疊在身體上方
const CALYX: readonly [number, number, SpriteTone][] = [
  [8, 0, 'leafDark'],
  [7, 1, 'leafDark'],
  [8, 1, 'leaf'],
  [5, 2, 'leafDark'],
  [6, 2, 'leaf'],
  [7, 2, 'leaf'],
  [8, 2, 'leaf'],
  [9, 2, 'leaf'],
  [10, 2, 'leafDark'],
  [3, 3, 'leafDark'],
  [4, 3, 'leaf'],
  [5, 3, 'leafDark'],
  [6, 3, 'leaf'],
  [7, 3, 'leaf'],
  [8, 3, 'leaf'],
  [9, 3, 'leaf'],
  [10, 3, 'leafDark'],
  [11, 3, 'leaf'],
  [12, 3, 'leafDark'],
  [4, 4, 'leafDark'],
  [7, 4, 'leafDark'],
  [8, 4, 'leafDark'],
  [11, 4, 'leafDark'],
]

const FACES: Readonly<Record<TomatoMood, readonly [number, number, SpriteTone][]>> = Object.freeze({
  awake: [
    [5, 8, 'eye'],
    [5, 9, 'eye'],
    [10, 8, 'eye'],
    [10, 9, 'eye'],
    [3, 10, 'cheek'],
    [12, 10, 'cheek'],
    [7, 11, 'eye'],
    [8, 11, 'eye'],
  ],
  relaxed: [
    [4, 9, 'eye'],
    [5, 8, 'eye'],
    [6, 9, 'eye'],
    [9, 9, 'eye'],
    [10, 8, 'eye'],
    [11, 9, 'eye'],
    [3, 10, 'cheek'],
    [12, 10, 'cheek'],
    [6, 11, 'eye'],
    [7, 12, 'eye'],
    [8, 12, 'eye'],
    [9, 11, 'eye'],
  ],
  sleepy: [
    [4, 9, 'eye'],
    [5, 9, 'eye'],
    [10, 9, 'eye'],
    [11, 9, 'eye'],
    [3, 10, 'cheek'],
    [12, 10, 'cheek'],
    [7, 12, 'eye'],
    [8, 12, 'eye'],
  ],
})

function inBody(x: number, y: number): boolean {
  const dx = (x + 0.5 - (BODY.cx + 0.5)) / BODY.rx
  const dy = (y + 0.5 - (BODY.cy + 0.5)) / BODY.ry
  return dx * dx + dy * dy <= 1
}

function bodyTone(x: number, y: number): SpriteTone {
  const isEdge = !inBody(x - 1, y) || !inBody(x + 1, y) || !inBody(x, y - 1) || !inBody(x, y + 1)
  if (isEdge) return 'outline'
  // 左上一小塊反光、右下一圈陰影，做出立體感
  if ((x === 3 && (y === 6 || y === 7)) || (x === 4 && y === 5)) return 'highlight'
  const dx = (x - BODY.cx) / BODY.rx
  const dy = (y - BODY.cy) / BODY.ry
  if (dx + dy > 0.75 && dx * dx + dy * dy > 0.45) return 'shade'
  return 'body'
}

export function buildTomatoSprite(mood: TomatoMood): SpritePixel[] {
  const grid = new Map<string, SpriteTone>()
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      if (inBody(x, y)) grid.set(`${x},${y}`, bodyTone(x, y))
    }
  }
  for (const [x, y, tone] of [...CALYX, ...FACES[mood]]) grid.set(`${x},${y}`, tone)

  return [...grid].map(([key, tone]) => {
    const [x, y] = key.split(',').map(Number)
    return { x, y, tone }
  })
}

/** 專注進度 0～1 → 成熟度 0～3（青、黃、橘、紅），一格一格變，比漸層更有像素感 */
export function ripenessStage(progress: number): 0 | 1 | 2 | 3 {
  if (progress < 0.25) return 0
  if (progress < 0.5) return 1
  if (progress < 0.75) return 2
  return 3
}
