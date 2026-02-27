import { describe, it, expect, beforeEach, vi } from 'vitest'

const subscribeMock = vi.fn()
vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: subscribeMock,
  },
}))

const notifyMock = vi.fn()
const invokeMock = vi.fn(async () => undefined)
vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: notifyMock,
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

describe('notificationManager', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Object.defineProperty(globalThis, '__TAURI__', { value: {}, configurable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('initializes in tauri and subscribes/listens', async () => {
    subscribeMock.mockImplementation(() => vi.fn())
    const addDocSpy = vi.spyOn(document, 'addEventListener')
    const addWinSpy = vi.spyOn(window, 'addEventListener')

    const { init, destroy } = await import('../../lib/notificationManager')
    await init()

    expect(subscribeMock).toHaveBeenCalledTimes(3)
    expect(addDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(addWinSpy).toHaveBeenCalledWith('focus', expect.any(Function))
    expect(addWinSpy).toHaveBeenCalledWith('blur', expect.any(Function))

    destroy()
  })

  it('sends notification + badge increment when hidden and updatedAt increases', async () => {
    const handlers = new Map<string, (e: MessageEvent) => void>()
    subscribeMock.mockImplementation((event: string, h: (e: MessageEvent) => void) => {
      handlers.set(event, h)
      return vi.fn()
    })

    const { init, destroy } = await import('../../lib/notificationManager')
    await init()

    window.dispatchEvent(new Event('blur'))

    const updated = handlers.get('session-updated')!

    updated({
      data: JSON.stringify({ session: { key: 's1', updatedAt: 1, displayName: 'Agent X' } }),
    } as MessageEvent)
    expect(notifyMock).not.toHaveBeenCalled() // first seen only tracked

    updated({
      data: JSON.stringify({
        session: {
          key: 's1',
          updatedAt: 2,
          displayName: 'Agent X',
          messages: [{ role: 'assistant', content: 'done message that will be used' }],
        },
      }),
    } as MessageEvent)

    expect(notifyMock).toHaveBeenCalledWith({
      title: 'Agent X is klaar',
      body: 'done message that will be used',
    })
    expect(invokeMock).toHaveBeenCalledWith('update_tray_badge', { count: 1 })

    destroy()
  })

  it('reset badge on focus and cleans session on remove', async () => {
    const handlers = new Map<string, (e: MessageEvent) => void>()
    const unsubs = [vi.fn(), vi.fn(), vi.fn()]
    let i = 0
    subscribeMock.mockImplementation((event: string, h: (e: MessageEvent) => void) => {
      handlers.set(event, h)
      return unsubs[i++]
    })

    const { init, destroy } = await import('../../lib/notificationManager')
    await init()

    window.dispatchEvent(new Event('blur'))
    handlers.get('session-created')!({
      data: JSON.stringify({ session: { key: 's2', updatedAt: 1 } }),
    } as MessageEvent)
    handlers.get('session-updated')!({
      data: JSON.stringify({ session: { key: 's2', updatedAt: 2, key2: 'x' } }),
    } as MessageEvent)

    window.dispatchEvent(new Event('focus'))
    expect(invokeMock).toHaveBeenCalledWith('update_tray_badge', { count: 0 })

    handlers.get('session-removed')!({ data: JSON.stringify({ key: 's2' }) } as MessageEvent)

    destroy()
    expect(unsubs[0]).toHaveBeenCalled()
    expect(unsubs[1]).toHaveBeenCalled()
    expect(unsubs[2]).toHaveBeenCalled()
  })
})
