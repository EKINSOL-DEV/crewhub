import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { BotAccessory } from '@/components/world3d/BotAccessory'

vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }))

describe('BotAccessory', () => {
  it('renders all accessory variants without crashing', () => {
    const variants = ['crown', 'lightbulb', 'clock', 'signal', 'gear'] as const
    for (const type of variants) {
      const { container, unmount } = render(<BotAccessory type={type} color="#3366ff" />)
      expect(container).toBeTruthy()
      unmount()
    }
  })
})
