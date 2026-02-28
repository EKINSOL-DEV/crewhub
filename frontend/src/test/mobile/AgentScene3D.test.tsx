/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AgentScene3D from '@/components/mobile/AgentScene3D'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, camera }: any) => (
    <div data-testid="canvas" data-camera={JSON.stringify(camera)}>
      {children}
    </div>
  ),
  useFrame: () => {},
}))

vi.mock('@react-three/drei', () => ({
  RoundedBox: ({ children }: any) => <div data-testid="rounded-box">{children}</div>,
}))

vi.mock('three', () => ({
  DoubleSide: 2,
  Color: class {
    value: string
    constructor(v: string) {
      this.value = v
    }
    multiplyScalar() {
      return this
    }
    getHexString() {
      return '123456'
    }
  },
}))

describe('AgentScene3D', () => {
  const botConfig = {
    color: '#6366f1',
    expression: 'happy' as const,
    icon: '🤖',
    variant: 'worker' as const,
    accessory: 'crown' as const,
    chestDisplay: 'tool' as const,
    label: 'Bot',
  }

  it('renders mini mode with close camera', () => {
    render(<AgentScene3D botConfig={botConfig} agentStatus="active" mini />)
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-camera')).toContain('"fov":35')
    expect(screen.getAllByTestId('rounded-box').length).toBeGreaterThan(0)
  })

  it('renders full mode with wider camera', () => {
    render(<AgentScene3D botConfig={botConfig} agentStatus="sleeping" />)
    const canvas = screen.getByTestId('canvas')
    expect(canvas.getAttribute('data-camera')).toContain('"fov":45')
  })
})
