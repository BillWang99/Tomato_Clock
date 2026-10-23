// 計時數字用的 5×7 點陣字。自己畫而不用字型，是為了在任何尺寸都保持銳利的方塊感。

const GLYPHS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.', '.', '#', '.', '#', '.', '.'],
  // 跟數字一樣 5 格寬：--:-- 與 25:00 一樣長，換回數字時版面不會跳
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
})

export const GLYPH_HEIGHT = 7
const LETTER_GAP = 1

export interface PixelCell {
  x: number
  y: number
}

export interface PixelText {
  width: number
  height: number
  cells: PixelCell[]
}

/** 把 "25:00" 排成點陣格子；不認得的字元當空白 */
export function layoutPixelText(text: string): PixelText {
  const cells: PixelCell[] = []
  let cursor = 0
  for (const char of text) {
    const glyph = GLYPHS[char]
    if (!glyph) {
      cursor += 3 + LETTER_GAP
      continue
    }
    glyph.forEach((row, y) => {
      ;[...row].forEach((mark, x) => {
        if (mark === '#') cells.push({ x: cursor + x, y })
      })
    })
    cursor += glyph[0].length + LETTER_GAP
  }
  return { width: Math.max(0, cursor - LETTER_GAP), height: GLYPH_HEIGHT, cells }
}
