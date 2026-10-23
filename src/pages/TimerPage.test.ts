import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimerPage from './TimerPage.vue'

const MIN = 60_000

function clockLabel(wrapper: VueWrapper): string | undefined {
  return wrapper.find('.timer-display [role="img"]').attributes('aria-label')
}

function selectedTab(wrapper: VueWrapper): string {
  return wrapper.find('[role="tab"][aria-selected="true"]').text()
}

async function pressMain(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('.control-bar .pixel-button--primary').trigger('click')
}

describe('蕃茄鐘頁面', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 23, 9, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('打開頁面：專注 25:00、開始按鈕、今日 0 顆', () => {
    const wrapper = mount(TimerPage)
    expect(clockLabel(wrapper)).toBe('剩下 25 分 0 秒')
    expect(selectedTab(wrapper)).toBe('專注')
    expect(wrapper.find('.control-bar .pixel-button--primary').text()).toBe('開始')
    expect(wrapper.find('.today-stats').attributes('aria-label')).toBe(
      '今天完成 0 顆蕃茄，專注 0 分鐘',
    )
    wrapper.unmount()
  })

  it('按開始、過 25 分鐘：時間到提示、今日蕃茄 +1、切到短休息 5:00', async () => {
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)
    await vi.advanceTimersByTimeAsync(10 * MIN)
    expect(clockLabel(wrapper)).toBe('剩下 15 分 0 秒')
    expect(document.title).toBe('15:00 專注中 · 像素蕃茄鐘')

    await vi.advanceTimersByTimeAsync(15 * MIN + 500)
    expect(document.title).toBe('⏰ 時間到！· 像素蕃茄鐘')
    expect(wrapper.find('[role="alert"]').text()).toContain('專注完成！休息一下吧')
    expect(wrapper.find('.today-stats').attributes('aria-label')).toBe(
      '今天完成 1 顆蕃茄，專注 25 分鐘',
    )
    expect(selectedTab(wrapper)).toBe('短休息')
    expect(clockLabel(wrapper)).toBe('剩下 5 分 0 秒')

    await wrapper.find('[role="alert"] button').trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(document.title).toBe('像素蕃茄鐘')
    wrapper.unmount()
  })

  it('暫停 3 分鐘：時間停住，繼續後接著倒數', async () => {
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)
    await vi.advanceTimersByTimeAsync(5 * MIN)
    await pressMain(wrapper)
    expect(wrapper.find('.control-bar .pixel-button--primary').text()).toBe('繼續')

    await vi.advanceTimersByTimeAsync(3 * MIN)
    expect(clockLabel(wrapper)).toBe('剩下 20 分 0 秒')

    await pressMain(wrapper)
    await vi.advanceTimersByTimeAsync(MIN)
    expect(clockLabel(wrapper)).toBe('剩下 19 分 0 秒')
    wrapper.unmount()
  })

  it('重新整理頁面：進行中的計時從上次的進度繼續', async () => {
    const first = mount(TimerPage)
    await pressMain(first)
    await vi.advanceTimersByTimeAsync(10 * MIN)
    first.unmount()

    await vi.advanceTimersByTimeAsync(2 * MIN)
    const second = mount(TimerPage)
    expect(clockLabel(second)).toBe('剩下 13 分 0 秒')
    expect(second.find('.control-bar .pixel-button--primary').text()).toBe('暫停')
    second.unmount()
  })

  it('改設定：專注改成 30 分鐘，畫面立刻變 30:00，重新整理後仍是 30', async () => {
    const first = mount(TimerPage)
    const plus = first.find('[aria-label="專注增加"]')
    for (let i = 0; i < 5; i++) await plus.trigger('click')
    expect(clockLabel(first)).toBe('剩下 30 分 0 秒')
    first.unmount()

    const second = mount(TimerPage)
    expect(clockLabel(second)).toBe('剩下 30 分 0 秒')
    second.unmount()
  })
})
