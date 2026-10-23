import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimerPage from './TimerPage.vue'

// 記下每一次播放，不真的出聲
const played: string[] = []
vi.mock('@/composables/useSound', () => ({
  useSound: () => ({
    play: (cue: string) => played.push(cue),
    unlock: async () => undefined,
  }),
}))

const MIN = 60_000

async function pressMain(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('.control-bar .pixel-button--primary').trigger('click')
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('提示音只在時間到時響', () => {
  beforeEach(() => {
    localStorage.clear()
    played.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 24, 9, 0, 0))
  })

  afterEach(() => {
    setVisibility('visible')
    vi.useRealTimers()
  })

  it('按開始、暫停、繼續：完全不出聲，讓使用者專注', async () => {
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)
    await vi.advanceTimersByTimeAsync(1000)
    await pressMain(wrapper)
    await pressMain(wrapper)
    expect(played).toEqual([])
    wrapper.unmount()
  })

  it('App 開著、時間準時到：響一次提示音', async () => {
    localStorage.setItem('tomato:settings', JSON.stringify({ focusSeconds: 30 }))
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)
    await vi.advanceTimersByTimeAsync(30_000 + 500)
    expect(played).toEqual(['finish'])
    wrapper.unmount()
  })

  it('鎖屏時已經到時間（推播通知響過了），解鎖回到 App：只顯示時間到，不再補播', async () => {
    localStorage.setItem('tomato:settings', JSON.stringify({ focusSeconds: 30 }))
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)

    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 5 * MIN)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.find('[role="alert"]').text()).toContain('專注完成')
    expect(played).toEqual([])
    wrapper.unmount()
  })

  it('解鎖回到 App 之後點畫面：也不會突然冒出提示音', async () => {
    localStorage.setItem('tomato:settings', JSON.stringify({ focusSeconds: 30 }))
    const wrapper = mount(TimerPage, { attachTo: document.body })
    await pressMain(wrapper)
    setVisibility('hidden')
    vi.setSystemTime(Date.now() + 5 * MIN)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)

    await wrapper.find('[role="alert"] button').trigger('pointerdown')
    await wrapper.find('[role="alert"] button').trigger('click')
    expect(played).toEqual([])
    wrapper.unmount()
  })
})
