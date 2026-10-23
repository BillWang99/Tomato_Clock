import { describe, expect, it } from 'vitest'
import { layoutPixelText } from './pixelFont'

describe('點陣數字', () => {
  it('--:-- 與 25:00 一樣寬：切到背景遮住數字、解鎖換回來時版面不會跳', () => {
    expect(layoutPixelText('--:--').width).toBe(layoutPixelText('25:00').width)
    expect(layoutPixelText('--:--').cells.length).toBeGreaterThan(0)
  })
})
