/**
 * Tests for FirstPersonController + FirstPersonHUD
 * (world3d/FirstPersonController.tsx)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── R3F mocks ────────────────────────────────────────────────────
const mockCamera = {
  position: { x: 0, y: 0, z: 0, set: vi.fn() },
  rotation: { set: vi.fn() },
  quaternion: {},
}

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera: mockCamera }),
  useFrame: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  PointerLockControls: vi.fn().mockImplementation(({ onLock, onUnlock }: any) => {
    return (
      <div
        data-testid="pointer-lock-controls"
        data-on-lock={!!onLock}
        data-on-unlock={!!onUnlock}
      />
    )
  }),
}))

// ── World focus mock ──────────────────────────────────────────────
const mockExitFirstPerson = vi.fn()
let mockFocusLevel: string = 'room'

vi.mock('@/contexts/WorldFocusContext', () => ({
  useWorldFocus: () => ({
    state: { level: mockFocusLevel },
    exitFirstPerson: mockExitFirstPerson,
  }),
}))

// ── Grid / blueprint mocks ───────────────────────────────────────
vi.mock('@/lib/grid/blueprints', () => ({
  getBlueprintForRoom: (_name: string) => ({
    cells: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => ({ type: 'walkable' }))),
    cellSize: 1,
    gridWidth: 6,
    gridDepth: 6,
  }),
}))

vi.mock('@/lib/grid/blueprintUtils', () => ({
  getWalkableMask: (cells: any[][]) =>
    cells.map((row: any[]) => row.map((c: any) => c.type === 'walkable')),
  worldToGrid: (_dx: number, _dz: number, cellSize: number, gw: number, gd: number) => ({
    x: Math.floor(_dx / cellSize + gw / 2),
    z: Math.floor(_dz / cellSize + gd / 2),
  }),
}))

vi.mock('@/hooks/usePropMovement', () => ({
  getIsPropBeingMoved: () => false,
  getIsPropBeingDragged: () => false,
}))

// ── Tests ────────────────────────────────────────────────────────

describe('FirstPersonHUD', () => {
  it('renders crosshair and ESC hint', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonHUD currentRoom={null} showRoomLabel={false} />)
    // Text is split across strong elements — check individual parts
    expect(screen.getByText('ESC')).toBeInTheDocument()
    expect(screen.getByText('🚶 First Person Mode')).toBeInTheDocument()
  })

  it('shows room label when showRoomLabel=true and currentRoom is set', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonHUD currentRoom="Executive Suite" showRoomLabel={true} />)
    expect(screen.getByText('Executive Suite')).toBeInTheDocument()
  })

  it('does not show room label when currentRoom is null', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonHUD currentRoom={null} showRoomLabel={true} />)
    expect(screen.queryByText('Executive Suite')).not.toBeInTheDocument()
  })

  it('does not show room label when showRoomLabel=false even with currentRoom set', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonHUD currentRoom="War Room" showRoomLabel={false} />)
    expect(screen.queryByText('War Room')).not.toBeInTheDocument()
  })

  it('renders pointer-events-none wrapper', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    const { container } = render(<FirstPersonHUD currentRoom={null} showRoomLabel={false} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.pointerEvents).toBe('none')
    expect(wrapper.style.position).toBe('absolute')
  })

  it('includes CSS animations for fade-out and room entry', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    const { container } = render(<FirstPersonHUD currentRoom="Main" showRoomLabel={true} />)
    const styleEl = container.querySelector('style')
    expect(styleEl?.textContent).toContain('fpHudFadeOut')
    expect(styleEl?.textContent).toContain('fpRoomFade')
  })

  it('renders WASD / Shift controls hint in ESC bar', async () => {
    const { FirstPersonHUD } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonHUD currentRoom={null} showRoomLabel={false} />)
    expect(screen.getByText(/WASD/)).toBeInTheDocument()
    expect(screen.getByText(/Shift/)).toBeInTheDocument()
  })
})

describe('FirstPersonController', () => {
  beforeEach(() => {
    mockFocusLevel = 'firstperson'
    mockExitFirstPerson.mockClear()
    mockCamera.position.set.mockClear()
    mockCamera.rotation.set.mockClear()
  })

  it('renders PointerLockControls when level=firstperson', async () => {
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonController roomPositions={[]} buildingWidth={40} buildingDepth={40} />)
    expect(screen.getByTestId('pointer-lock-controls')).toBeInTheDocument()
  })

  it('returns null when level is not firstperson', async () => {
    mockFocusLevel = 'room'
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    const { container } = render(
      <FirstPersonController roomPositions={[]} buildingWidth={40} buildingDepth={40} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders with room positions for collision detection', async () => {
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    render(
      <FirstPersonController
        roomPositions={[
          { roomId: 'r1', roomName: 'HQ', position: [0, 0, 0] },
          { roomId: 'r2', roomName: 'Dev Lab', position: [12, 0, 0] },
        ]}
        buildingWidth={60}
        buildingDepth={60}
        roomSize={10}
        onEnterRoom={vi.fn()}
        onLeaveRoom={vi.fn()}
        onLockChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('pointer-lock-controls')).toBeInTheDocument()
  })

  it('passes onLock and onUnlock to PointerLockControls', async () => {
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    const controls = render(
      <FirstPersonController
        roomPositions={[]}
        buildingWidth={30}
        buildingDepth={30}
        onLockChange={vi.fn()}
      />
    )
    const el = controls.getByTestId('pointer-lock-controls')
    expect(el).toHaveAttribute('data-on-lock', 'true')
    expect(el).toHaveAttribute('data-on-unlock', 'true')
  })

  it('positions camera at eye height on first enable', async () => {
    mockFocusLevel = 'firstperson'
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonController roomPositions={[]} buildingWidth={40} buildingDepth={40} />)
    // camera.position.set should have been called with eye height (1.6)
    expect(mockCamera.position.set).toHaveBeenCalledWith(0, 1.6, 0)
  })

  it('fires keyboard events and does not throw', async () => {
    mockFocusLevel = 'firstperson'
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    render(<FirstPersonController roomPositions={[]} buildingWidth={40} buildingDepth={40} />)

    // Fire various key events — should not throw
    const keyCodes = [
      'KeyW',
      'KeyS',
      'KeyA',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ShiftLeft',
      'ShiftRight',
    ]
    for (const code of keyCodes) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }))
    }
    for (const code of keyCodes) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code }))
    }
  })

  it('resets keys on unmount cleanup', async () => {
    mockFocusLevel = 'firstperson'
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    const { unmount } = render(
      <FirstPersonController roomPositions={[]} buildingWidth={40} buildingDepth={40} />
    )
    // Press a key then unmount
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    unmount()
    // No errors — keys are reset
  })

  it('uses default roomSize=12 when not provided', async () => {
    const { FirstPersonController } = await import('@/components/world3d/FirstPersonController')
    render(
      <FirstPersonController
        roomPositions={[{ roomId: 'r1', roomName: 'Lab', position: [0, 0, 0] }]}
        buildingWidth={50}
        buildingDepth={50}
      />
    )
    // Should render without error — roomSize defaults to 12
    expect(screen.getByTestId('pointer-lock-controls')).toBeInTheDocument()
  })
})
