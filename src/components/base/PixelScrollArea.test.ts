import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PixelScrollArea from './PixelScrollArea.vue'

// 測試環境沒有真的版面，手動設定「可見高度 600、內容高度 1500」
function setSize(el: HTMLElement, scrollTop: number, scrollHeight = 1500, clientHeight = 600) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop })
  el.dispatchEvent(new Event('scroll'))
}

describe('捲動區的提示', () => {
  it('內容比畫面長、還在最上面：顯示「往下還有」，不顯示「回到最上方」', async () => {
    const wrapper = mount(PixelScrollArea, { slots: { default: '<p>很長的設定</p>' } })
    setSize(wrapper.find('.pixel-scroll-area__viewport').element as HTMLElement, 0)
    await nextTick()
    expect(wrapper.text()).toContain('往下還有')
    expect(wrapper.text()).not.toContain('回到最上方')
  })

  it('捲到一半：兩個都顯示；按「回到最上方」會捲回頂端', async () => {
    const wrapper = mount(PixelScrollArea, { slots: { default: '<p>很長的設定</p>' } })
    const viewport = wrapper.find('.pixel-scroll-area__viewport').element as HTMLElement
    viewport.scrollTo = vi.fn()
    setSize(viewport, 400)
    await nextTick()
    expect(wrapper.text()).toContain('往下還有')

    await wrapper.find('button').trigger('click')
    expect(viewport.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })

  it('捲到最底：「往下還有」消失，「回到最上方」還在', async () => {
    const wrapper = mount(PixelScrollArea, { slots: { default: '<p>很長的設定</p>' } })
    setSize(wrapper.find('.pixel-scroll-area__viewport').element as HTMLElement, 900)
    await nextTick()
    expect(wrapper.text()).not.toContain('往下還有')
    expect(wrapper.text()).toContain('回到最上方')
  })

  it('內容放得下：什麼提示都不顯示', async () => {
    const wrapper = mount(PixelScrollArea, { slots: { default: '<p>短短的</p>' } })
    setSize(wrapper.find('.pixel-scroll-area__viewport').element as HTMLElement, 0, 500, 600)
    await nextTick()
    expect(wrapper.text()).not.toContain('往下還有')
    expect(wrapper.text()).not.toContain('回到最上方')
  })

  it('內容只多一點點（多 100 px）、捲到底：也會出現「回到最上方」', async () => {
    const wrapper = mount(PixelScrollArea, { slots: { default: '<p>設定</p>' } })
    setSize(wrapper.find('.pixel-scroll-area__viewport').element as HTMLElement, 100, 754, 654)
    await nextTick()
    expect(wrapper.text()).not.toContain('往下還有')
    expect(wrapper.text()).toContain('回到最上方')
  })

  it('只能捲 40 px、捲到底：也會出現「回到最上方」', async () => {
    const wrapper = mount(PixelScrollArea, { slots: { default: '<p>設定</p>' } })
    setSize(wrapper.find('.pixel-scroll-area__viewport').element as HTMLElement, 40, 694, 654)
    await nextTick()
    expect(wrapper.text()).toContain('回到最上方')
  })
})
