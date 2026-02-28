/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
/**
 * Tests for GridRoomRenderer (world3d/grid/GridRoomRenderer.tsx)
 *
 * Strategy: mock all R3F primitives + heavy deps; test component rendering
 * and the pure helpers exercised via internal logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { RoomBlueprint } from '@/lib/grid'

// ── R3F mocks ────────────────────────────────────────────────────
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  extend: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drei-html">{children}</div>
  ),
}))

vi.mock('three', () => {
  const Mesh = vi.fn().mockImplementation(() => ({
    material: { opacity: 1 },
    scale: { set: vi.fn() },
    position: { y: 0 },
  }))
  const Group = vi.fn().mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { y: 0 },
    add: vi.fn(),
    traverse: vi.fn(),
  }))
  return {
    __esModule: true,
    default: {},
    Mesh,
    Group,
    MeshBasicMaterial: vi.fn().mockReturnValue({ opacity: 1, transparent: false }),
    BoxGeometry: vi.fn(),
    DoubleSide: 2,
    Color: vi.fn().mockReturnValue({ getHexString: () => 'ffffff' }),
  }
})

// ── Hook mocks ───────────────────────────────────────────────────
vi.mock('@/hooks/useGridDebug', () => ({
  useGridDebug: () => [false],
}))

vi.mock('@/hooks/usePropMovement', () => ({
  usePropMovement: () => ({
    selectedProp: null,
    isMoving: false,
    isDragging: false,
    isOverInvalid: false,
    startLongPress: vi.fn(),
    cancelLongPress: vi.fn(),
    handlePointerUp: vi.fn(),
    handleDragMove: vi.fn(),
    startDrag: vi.fn(),
    endDrag: vi.fn(),
    rotateProp: vi.fn(),
    confirmMovement: vi.fn(),
    cancelMovement: vi.fn(),
    deleteProp: vi.fn(),
  }),
  getIsPropBeingMoved: () => false,
  getIsPropBeingDragged: () => false,
}))

// ── Lib mocks ────────────────────────────────────────────────────
vi.mock('@/lib/grid', async () => {
  const real = await vi.importActual<typeof import('@/lib/grid')>('@/lib/grid')
  return {
    ...real,
    gridToWorld: (x: number, z: number, cellSize: number, gw: number, gd: number) => {
      // Simplified: center-based
      const worldX = (x - gw / 2 + 0.5) * cellSize
      const worldZ = (z - gd / 2 + 0.5) * cellSize
      return [worldX, 0, worldZ]
    },
  }
})

// ── PropRegistry mock ─────────────────────────────────────────────
vi.mock('@/components/world3d/grid/PropRegistry', () => ({
  getPropEntry: (id: string) => {
    if (id === 'desk' || id === 'chair' || id === 'plant' || id === 'whiteboard') {
      return {
        component: ({ position }: { position: [number, number, number] }) => (
          <div data-testid={`prop-${id}`} data-pos={position.join(',')}>
            {id}
          </div>
        ),
        mountType: id === 'whiteboard' ? 'wall' : 'floor',
        yOffset: id === 'whiteboard' ? 1.2 : 0.16,
      }
    }
    return null
  },
  getPropComponent: vi.fn(),
  getPropYOffset: () => 0.16,
  getPropMountType: () => 'floor',
}))

// ── Blueprint fixtures ────────────────────────────────────────────

const makeBlueprint = (overrides: Partial<RoomBlueprint> = {}): RoomBlueprint => ({
  id: 'bp-test',
  cellSize: 1,
  gridWidth: 6,
  gridDepth: 6,
  cells: Array.from({ length: 6 }, () =>
    Array.from({ length: 6 }, () => ({ type: 'walkable' as const }))
  ),
  placements: [],
  ...overrides,
})

// ── Tests ────────────────────────────────────────────────────────

describe('GridRoomRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing with empty blueprint', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint()
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    // No errors — component renders a group with no prop children
  })

  it('renders props from blueprintPlacements', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [{ propId: 'desk', x: 2, z: 2, rotation: 0 }],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.getByTestId('prop-desk')).toBeInTheDocument()
  })

  it('renders multiple props from placements', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [
        { propId: 'desk', x: 1, z: 1, rotation: 0 },
        { propId: 'chair', x: 3, z: 2, rotation: 90 },
        { propId: 'plant', x: 5, z: 5, rotation: 0 },
      ],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.getByTestId('prop-desk')).toBeInTheDocument()
    expect(screen.getByTestId('prop-chair')).toBeInTheDocument()
    expect(screen.getByTestId('prop-plant')).toBeInTheDocument()
  })

  it('skips props with unknown propId (no registry entry)', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [{ propId: 'unknown-prop', x: 2, z: 2, rotation: 0 }],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.queryByTestId('prop-unknown-prop')).not.toBeInTheDocument()
  })

  it('falls back to extracting placements from cells when blueprintPlacements empty', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const cells = Array.from({ length: 6 }, (_, z) =>
      Array.from({ length: 6 }, (_, x) => {
        if (x === 2 && z === 2) {
          return { type: 'walkable' as const, propId: 'chair' as string | undefined }
        }
        return { type: 'walkable' as const }
      })
    )
    const bp = makeBlueprint({ cells, placements: [] })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.getByTestId('prop-chair')).toBeInTheDocument()
  })

  it('skips interaction-only placements', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [{ propId: 'desk', x: 2, z: 2, rotation: 0, type: 'interaction' as any }],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.queryByTestId('prop-desk')).not.toBeInTheDocument()
  })

  it('renders wall-mount props (whiteboard)', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [{ propId: 'whiteboard', x: 0, z: 3, rotation: 0 }],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.getByTestId('prop-whiteboard')).toBeInTheDocument()
  })

  it('renders with multi-cell span props', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [{ propId: 'desk', x: 2, z: 2, rotation: 0, span: { w: 2, d: 1 } }],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    expect(screen.getByTestId('prop-desk')).toBeInTheDocument()
  })

  it('accepts onBlueprintUpdate callback', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const onBlueprintUpdate = vi.fn()
    const bp = makeBlueprint({
      placements: [{ propId: 'desk', x: 2, z: 2, rotation: 0 }],
    })
    render(
      <GridRoomRenderer
        blueprint={bp}
        roomPosition={[5, 0, 5]}
        onBlueprintUpdate={onBlueprintUpdate}
      />
    )
    expect(screen.getByTestId('prop-desk')).toBeInTheDocument()
  })

  it('skips spanParent cells when extracting from cells', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const cells = Array.from({ length: 6 }, (_, z) =>
      Array.from({ length: 6 }, (_, x) => {
        if (x === 2 && z === 2) {
          return { type: 'walkable' as const, propId: 'desk' as string | undefined }
        }
        if (x === 3 && z === 2) {
          // spanParent = true → should be skipped
          return {
            type: 'walkable' as const,
            propId: 'desk' as string | undefined,
            spanParent: true,
          }
        }
        return { type: 'walkable' as const }
      })
    )
    const bp = makeBlueprint({ cells, placements: [] })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    // Only the anchor cell renders
    const desks = screen.getAllByTestId('prop-desk')
    expect(desks).toHaveLength(1)
  })

  it('renders correctly with multiple rotations (debug path)', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [
        { propId: 'desk', x: 2, z: 2, rotation: 90 },
        { propId: 'chair', x: 4, z: 4, rotation: 180 },
      ],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
    // Both props should render with their respective rotations
    expect(screen.getByTestId('prop-desk')).toBeInTheDocument()
    expect(screen.getByTestId('prop-chair')).toBeInTheDocument()
  })

  it('does not crash with undefined blueprint id', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({ id: undefined })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[0, 0, 0]} />)
  })

  it('handles non-zero room position offset', async () => {
    const { GridRoomRenderer } = await import('@/components/world3d/grid/GridRoomRenderer')
    const bp = makeBlueprint({
      placements: [{ propId: 'chair', x: 0, z: 0, rotation: 45 }],
    })
    render(<GridRoomRenderer blueprint={bp} roomPosition={[-8, 0, 4]} />)
    expect(screen.getByTestId('prop-chair')).toBeInTheDocument()
  })
})
