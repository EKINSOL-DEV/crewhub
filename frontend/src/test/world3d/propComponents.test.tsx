/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// ─── Mock R3F / Three ─────────────────────────────────────────────

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}))

vi.mock('three', () => ({
  DoubleSide: 2,
}))

// ─── Mock toon materials ──────────────────────────────────────────

vi.mock('@/components/world3d/utils/toonMaterials', () => ({
  getToonMaterialProps: (color: string) => ({ color }),
  WARM_COLORS: ['#ff6b6b', '#ffa07a'],
}))

// ─── Mock prop wrapper components ─────────────────────────────────

vi.mock('@/components/world3d/props/Desk', () => ({
  Desk: ({ position, rotation }: any) => (
    <div
      data-testid="desk-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

vi.mock('@/components/world3d/props/Monitor', () => ({
  Monitor: ({ position, rotation }: any) => (
    <div
      data-testid="monitor-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

vi.mock('@/components/world3d/props/Chair', () => ({
  Chair: ({ position, rotation }: any) => (
    <div
      data-testid="chair-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

vi.mock('@/components/world3d/props/Lamp', () => ({
  Lamp: ({ position, lightColor, lightIntensity }: any) => (
    <div
      data-testid="lamp-prop"
      data-pos={JSON.stringify(position)}
      data-color={lightColor}
      data-intensity={lightIntensity}
    />
  ),
}))

vi.mock('@/components/world3d/props/Plant', () => ({
  Plant: ({ position, scale }: any) => (
    <div data-testid="plant-prop" data-pos={JSON.stringify(position)} data-scale={scale} />
  ),
}))

vi.mock('@/components/world3d/props/CoffeeMachine', () => ({
  CoffeeMachine: ({ position, rotation }: any) => (
    <div
      data-testid="coffee-machine-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

vi.mock('@/components/world3d/props/WaterCooler', () => ({
  WaterCooler: ({ position, rotation }: any) => (
    <div
      data-testid="water-cooler-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

vi.mock('@/components/world3d/props/NoticeBoard', () => ({
  NoticeBoard: ({ position, rotation }: any) => (
    <div
      data-testid="notice-board-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

vi.mock('@/components/world3d/props/Bench', () => ({
  Bench: ({ position, rotation }: any) => (
    <div
      data-testid="bench-prop"
      data-pos={JSON.stringify(position)}
      data-rot={JSON.stringify(rotation)}
    />
  ),
}))

// ─── Import after mocks ───────────────────────────────────────────

import {
  degToEuler,
  DeskProp,
  MonitorProp,
  ChairProp,
  LampProp,
  PlantProp,
  CoffeeMachineProp,
  WaterCoolerProp,
  NoticeBoardProp,
  BenchProp,
  WhiteboardProp,
  ServerRackProp,
} from '@/components/world3d/grid/props/propComponents'

// ─── Test Props ───────────────────────────────────────────────────

const defaultPos: [number, number, number] = [1, 0, 2]
const defaultRotation = 90

// ─── Tests ───────────────────────────────────────────────────────

describe('degToEuler', () => {
  it('converts 0 degrees to [0, 0, 0]', () => {
    const result = degToEuler(0)
    expect(result[0]).toBe(0)
    expect(result[1]).toBeCloseTo(0)
    expect(result[2]).toBe(0)
  })

  it('converts 90 degrees to approx π/2', () => {
    const result = degToEuler(90)
    expect(result[1]).toBeCloseTo(Math.PI / 2)
  })

  it('converts 180 degrees to approx π', () => {
    const result = degToEuler(180)
    expect(result[1]).toBeCloseTo(Math.PI)
  })

  it('converts 360 degrees to approx 2π', () => {
    const result = degToEuler(360)
    expect(result[1]).toBeCloseTo(2 * Math.PI)
  })

  it('returns array of length 3', () => {
    expect(degToEuler(45)).toHaveLength(3)
  })

  it('first and third elements are always 0', () => {
    const [x, , z] = degToEuler(270)
    expect(x).toBe(0)
    expect(z).toBe(0)
  })

  it('handles negative degrees', () => {
    const result = degToEuler(-90)
    expect(result[1]).toBeCloseTo(-Math.PI / 2)
  })
})

describe('DeskProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<DeskProp position={defaultPos} rotation={defaultRotation} />)
    expect(container).toBeTruthy()
  })

  it('renders the Desk component', () => {
    const { getByTestId } = render(<DeskProp position={defaultPos} rotation={0} />)
    expect(getByTestId('desk-prop')).toBeTruthy()
  })

  it('passes correct position', () => {
    const { getByTestId } = render(<DeskProp position={[3, 0, 4]} rotation={0} />)
    const el = getByTestId('desk-prop')
    expect(JSON.parse(el.getAttribute('data-pos') || '[]')).toEqual([3, 0, 4])
  })

  it('converts rotation via degToEuler', () => {
    const { getByTestId } = render(<DeskProp position={defaultPos} rotation={90} />)
    const el = getByTestId('desk-prop')
    const rot = JSON.parse(el.getAttribute('data-rot') || '[]')
    expect(rot[0]).toBe(0)
    expect(rot[1]).toBeCloseTo(Math.PI / 2)
    expect(rot[2]).toBe(0)
  })
})

describe('MonitorProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<MonitorProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders Monitor component', () => {
    const { getByTestId } = render(<MonitorProp position={defaultPos} rotation={0} />)
    expect(getByTestId('monitor-prop')).toBeTruthy()
  })

  it('offsets Y position by 0.78', () => {
    const { getByTestId } = render(<MonitorProp position={[1, 0, 2]} rotation={0} />)
    const el = getByTestId('monitor-prop')
    const pos = JSON.parse(el.getAttribute('data-pos') || '[]')
    expect(pos[1]).toBeCloseTo(0.78)
  })
})

describe('ChairProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<ChairProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders Chair component', () => {
    const { getByTestId } = render(<ChairProp position={defaultPos} rotation={0} />)
    expect(getByTestId('chair-prop')).toBeTruthy()
  })
})

describe('LampProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<LampProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders Lamp component', () => {
    const { getByTestId } = render(<LampProp position={defaultPos} rotation={0} />)
    expect(getByTestId('lamp-prop')).toBeTruthy()
  })

  it('passes gold light color', () => {
    const { getByTestId } = render(<LampProp position={defaultPos} rotation={0} />)
    const el = getByTestId('lamp-prop')
    expect(el.getAttribute('data-color')).toBe('#FFD700')
  })

  it('passes 0.4 light intensity', () => {
    const { getByTestId } = render(<LampProp position={defaultPos} rotation={0} />)
    const el = getByTestId('lamp-prop')
    expect(parseFloat(el.getAttribute('data-intensity') || '0')).toBeCloseTo(0.4)
  })
})

describe('PlantProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<PlantProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders Plant component with scale 1', () => {
    const { getByTestId } = render(<PlantProp position={defaultPos} rotation={0} />)
    const el = getByTestId('plant-prop')
    expect(el.getAttribute('data-scale')).toBe('1')
  })
})

describe('CoffeeMachineProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<CoffeeMachineProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders CoffeeMachine component', () => {
    const { getByTestId } = render(<CoffeeMachineProp position={defaultPos} rotation={0} />)
    expect(getByTestId('coffee-machine-prop')).toBeTruthy()
  })
})

describe('WaterCoolerProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<WaterCoolerProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders WaterCooler component', () => {
    const { getByTestId } = render(<WaterCoolerProp position={defaultPos} rotation={0} />)
    expect(getByTestId('water-cooler-prop')).toBeTruthy()
  })
})

describe('NoticeBoardProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<NoticeBoardProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders NoticeBoard component', () => {
    const { getByTestId } = render(<NoticeBoardProp position={defaultPos} rotation={0} />)
    expect(getByTestId('notice-board-prop')).toBeTruthy()
  })
})

describe('BenchProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<BenchProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders Bench component', () => {
    const { getByTestId } = render(<BenchProp position={defaultPos} rotation={0} />)
    expect(getByTestId('bench-prop')).toBeTruthy()
  })
})

// ─── Inline Mini-Props ────────────────────────────────────────────

describe('WhiteboardProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<WhiteboardProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders a group element', () => {
    const { container } = render(<WhiteboardProp position={[0, 0, 0]} rotation={0} />)
    // jsdom renders the R3F components as unknown HTML; check container is non-empty
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })
})

describe('ServerRackProp', () => {
  it('renders without crashing', () => {
    const { container } = render(<ServerRackProp position={defaultPos} rotation={0} />)
    expect(container).toBeTruthy()
  })

  it('renders non-empty content', () => {
    const { container } = render(<ServerRackProp position={[0, 0, 0]} rotation={0} />)
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })
})
