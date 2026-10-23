// 從完整的 Fusion Pixel 字型裡，只留下介面用到的字，產生小小的 woff2。
// 改了介面文字（新增中文字）後要重跑一次，不然新字會用系統字型顯示。
//
// 用法：node scripts/subset-font.mjs <完整字型.woff2>
// 完整字型下載：https://github.com/TakWolf/fusion-pixel-font/releases
//   （fusion-pixel-font-12px-proportional-otf.woff2 壓縮檔裡的 zh_tw 版本）

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import subsetFont from 'subset-font'

const SOURCE_DIRS = ['src']
const EXTRA_FILES = ['index.html']
const OUTPUT = 'src/assets/fonts/fusion-pixel-12px-tc-subset.woff2'

// 英數與常用符號全部保留，之後改文案不用每次重跑
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
const PUNCTUATION = '，。！？、：；「」『』（）…—～·×−'

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return listFiles(path)
      return ['.vue', '.ts'].includes(extname(path)) && !path.endsWith('.test.ts') ? [path] : []
    }),
  )
  return files.flat()
}

async function collectText() {
  const files = [...(await Promise.all(SOURCE_DIRS.map(listFiles))).flat(), ...EXTRA_FILES]
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')))
  // 只取非 ASCII 的字（中文、全形符號），英數已經整組保留
  const wide = contents.join('').match(/[^\x00-\x7f]/gu) ?? []
  return [...new Set([...ASCII, ...PUNCTUATION, ...wide])].join('')
}

const source = process.argv[2]
if (!source) {
  console.error('用法：node scripts/subset-font.mjs <完整字型.woff2>')
  process.exit(1)
}

const text = await collectText()
const subset = await subsetFont(await readFile(source), text, { targetFormat: 'woff2' })
await writeFile(OUTPUT, subset)
console.log(
  `保留 ${[...text].length} 個字，輸出 ${OUTPUT}（${(subset.length / 1024).toFixed(1)} KB）`,
)
