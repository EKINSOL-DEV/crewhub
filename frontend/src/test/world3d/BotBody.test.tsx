import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BotBody } from '@/components/world3d/BotBody'

vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }))
vi.mock('@react-three/drei', () => ({
  RoundedBox: ({ children }: { children: ReactNode }) => (
    <div data-testid="rounded-box">{children}</div>
  ),
}))

describe('BotBody', () => {
  it('renders head/body/limbs structure', () => {
    const { getAllByTestId } = render(<BotBody color="#ff0000" status="idle" />)
    expect(getAllByTestId('rounded-box').length).toBe(3)
  })

  it('accepts walkPhaseRef prop', () => {
    const walkPhaseRef = { current: 2 }
    render(<BotBody color="#00ff00" status="sleeping" walkPhaseRef={walkPhaseRef} />)
    expect(walkPhaseRef.current).toBe(2)
  })
})
