import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BossHudButton } from '@/components/world3d/BossHudButton'

const focusBot = vi.fn()
const openChat = vi.fn()
vi.mock('@/contexts/WorldFocusContext', () => ({
  useWorldFocus: () => ({ state: { level: 'room' }, focusBot }),
}))
vi.mock('@/contexts/ChatContext', () => ({
  useChatContext: () => ({ openChat }),
}))

const baseSession = {
  key: 'agent:main:main',
  kind: 'agent',
  channel: 'whatsapp',
  updatedAt: Date.now(),
  sessionId: 'id',
  label: 'main-assistant',
}

describe('BossHudButton', () => {
  it('renders and triggers focus/chat actions on click', () => {
    render(
      <BossHudButton
        sessions={[baseSession as any]}
        getBotConfig={() => ({ icon: '🤖', color: '#3366ff', expression: 'happy' }) as any}
        getRoomForSession={() => 'room-1'}
        isActivelyRunning={() => true}
      />
    )

    const btn = screen.getByTitle('Fly to Assistent')
    fireEvent.click(btn)
    expect(focusBot).toHaveBeenCalledWith('agent:main:main', 'room-1')
    expect(openChat).toHaveBeenCalled()
  })

  it('hides when boss session is missing', () => {
    const { container } = render(
      <BossHudButton
        sessions={[]}
        getBotConfig={() => ({ icon: '🤖', color: '#3366ff', expression: 'happy' }) as any}
        getRoomForSession={() => 'room-1'}
        isActivelyRunning={() => false}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
