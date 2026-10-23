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

// 直接把時鐘撥到 ms 之後再走一格，跟手機鎖屏一段時間後回來一樣；
// 不用一格一格模擬（50 分鐘要畫一萬多次畫面，慢的機器會逾時）。經過的總時間剛好是 ms
const TICK_MS = 250
async function jumpForward(ms: number): Promise<void> {
  vi.setSystemTime(Date.now() + ms - TICK_MS)
  await vi.advanceTimersByTimeAsync(TICK_MS)
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
    await jumpForward(10 * MIN)
    expect(clockLabel(wrapper)).toBe('剩下 15 分 0 秒')
    expect(document.title).toBe('15:00 專注中 · 像素蕃茄鐘')

    await jumpForward(15 * MIN + 500)
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
    await jumpForward(5 * MIN)
    await pressMain(wrapper)
    expect(wrapper.find('.control-bar .pixel-button--primary').text()).toBe('繼續')

    await jumpForward(3 * MIN)
    expect(clockLabel(wrapper)).toBe('剩下 20 分 0 秒')

    await pressMain(wrapper)
    await jumpForward(MIN)
    expect(clockLabel(wrapper)).toBe('剩下 19 分 0 秒')
    wrapper.unmount()
  })

  it('重新整理頁面：進行中的計時從上次的進度繼續', async () => {
    const first = mount(TimerPage)
    await pressMain(first)
    await jumpForward(10 * MIN)
    first.unmount()

    await jumpForward(2 * MIN)
    const second = mount(TimerPage)
    expect(clockLabel(second)).toBe('剩下 13 分 0 秒')
    expect(second.find('.control-bar .pixel-button--primary').text()).toBe('暫停')
    second.unmount()
  })

  it('改設定：專注改成 30 分鐘，畫面立刻變 30:00，重新整理後仍是 30', async () => {
    const first = mount(TimerPage)
    const plus = first.find('[aria-label="專注增加一分鐘"]')
    for (let i = 0; i < 5; i++) await plus.trigger('click')
    expect(clockLabel(first)).toBe('剩下 30 分 0 秒')
    first.unmount()

    const second = mount(TimerPage)
    expect(clockLabel(second)).toBe('剩下 30 分 0 秒')
    second.unmount()
  })

  it('點中央的 25:00 → 時間鍵盤，按 5、0、3、0 → 確定 → 變成 50:30，重新整理後仍是 50:30', async () => {
    const first = mount(TimerPage, { attachTo: document.body })
    await first.find('.timer-display__digits--editable').trigger('click')
    const keypad = first.find('.time-keypad')
    expect(keypad.exists()).toBe(true)
    for (const key of '5030') {
      const button = keypad.findAll('button').find((b) => b.text() === key)
      await button?.trigger('click')
    }
    expect(keypad.find('[role="img"]').attributes('aria-label')).toBe('目前輸入 50:30')
    await keypad
      .findAll('button')
      .find((b) => b.text() === '確定')
      ?.trigger('click')

    expect(first.find('.time-keypad').exists()).toBe(false)
    expect(clockLabel(first)).toBe('剩下 50 分 30 秒')
    first.unmount()

    const second = mount(TimerPage)
    expect(clockLabel(second)).toBe('剩下 50 分 30 秒')
    second.unmount()
  })

  it('設定裡點短休息的 05:00 → 用實體鍵盤打 130、Enter → 短休息變 1:30', async () => {
    const wrapper = mount(TimerPage, { attachTo: document.body })
    await wrapper.find('[aria-label^="短休息 5 分"]').trigger('click')
    for (const key of ['1', '3', '0', 'Enter']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key }))
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.time-keypad').exists()).toBe(false)
    expect(wrapper.find('[aria-label^="短休息 1 分 30 秒"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('計時中不能點數字改時間', async () => {
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)
    expect(wrapper.find('.timer-display__digits--editable').exists()).toBe(false)
    wrapper.unmount()
  })

  it('第一版存的設定（專注 50 分鐘）升級後照樣是 50:00', () => {
    localStorage.setItem('tomato:settings', JSON.stringify({ focusMinutes: 50, soundOn: false }))
    const wrapper = mount(TimerPage)
    expect(clockLabel(wrapper)).toBe('剩下 50 分 0 秒')
    wrapper.unmount()
  })

  it('專注 50:30 跑完：今日統計顯示 50 分', async () => {
    localStorage.setItem('tomato:settings', JSON.stringify({ focusSeconds: 3030 }))
    const wrapper = mount(TimerPage)
    await pressMain(wrapper)
    await jumpForward(3030 * 1000 + 500)
    expect(wrapper.find('.today-stats').attributes('aria-label')).toBe(
      '今天完成 1 顆蕃茄，專注 50 分鐘',
    )
    wrapper.unmount()
  })

  it('鍵盤開著時：在「取消」上按 Enter 是取消、Cmd+數字不會被當成輸入', async () => {
    const wrapper = mount(TimerPage, { attachTo: document.body })
    await wrapper.find('.timer-display__digits--editable').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '9', metaKey: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.time-keypad [role="img"]').attributes('aria-label')).toBe(
      '目前輸入 00:05',
    )

    const cancel = wrapper.find('.pixel-dialog__header button').element as HTMLButtonElement
    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    cancel.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.time-keypad').exists()).toBe(false)
    expect(clockLabel(wrapper)).toBe('剩下 25 分 0 秒')
    wrapper.unmount()
  })
})
