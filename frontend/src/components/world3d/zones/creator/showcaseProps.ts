import { lazy, type ComponentType } from 'react'

export interface ShowcaseProp {
  id: string
  name: string
  description: string
  component: React.LazyExoticComponent<ComponentType>
  techniques: string[]
  codeLines: number
  qualityScore: number
  category: 'tech' | 'home' | 'abstract' | 'display'
}

export const showcaseProps: ShowcaseProp[] = [
  {
    id: 'ai-brain',
    name: 'AI Brain',
    description: 'Glowing crystalline brain with pulsing neural nodes and synapse connections. Features instanced meshes for 40+ neurons with dynamic scaling.',
    component: lazy(() => import('../../props/showcase/AIBrain').then(m => ({ default: m.AIBrain }))),
    techniques: [
      'IcosahedronGeometry for outer shell',
      'InstancedMesh for 40 neural nodes',
      'LineSegments for synapse connections',
      'Pulsing emissive glow animation',
    ],
    codeLines: 85,
    qualityScore: 96,
    category: 'abstract',
  },
  {
    id: 'coffee-machine',
    name: 'Coffee Machine',
    description: 'Detailed espresso machine with steam particles, glowing power button, drip tray, and a freshly brewed cup of coffee.',
    component: lazy(() => import('../../props/showcase/CoffeeMachine').then(m => ({ default: m.CoffeeMachine }))),
    techniques: [
      'Multi-part assembly (body, tank, spout)',
      'Particle system for steam',
      'Emissive LED power button',
      'Subtle idle rotation animation',
    ],
    codeLines: 79,
    qualityScore: 94,
    category: 'home',
  },
  {
    id: 'code-terminal',
    name: 'Code Terminal',
    description: 'Retro-style coding monitor with scrolling code lines, blinking cursor, and a glowing power LED. Shows real code snippets.',
    component: lazy(() => import('../../props/showcase/CodeTerminal').then(m => ({ default: m.CodeTerminal }))),
    techniques: [
      '@react-three/drei Text for code lines',
      'Scrolling text animation',
      'Emissive screen glow',
      'Blinking cursor effect',
    ],
    codeLines: 86,
    qualityScore: 92,
    category: 'tech',
  },
  {
    id: 'data-crystal',
    name: 'Data Crystal',
    description: 'Mystical floating crystal with orbiting data streams and glowing inner core. Features procedural tube geometry for energy flows.',
    component: lazy(() => import('../../props/showcase/DataCrystal').then(m => ({ default: m.DataCrystal }))),
    techniques: [
      'OctahedronGeometry for crystal form',
      'CatmullRomCurve3 + TubeGeometry for data streams',
      'Floating data bit particles',
      'Pulsing inner core animation',
    ],
    codeLines: 72,
    qualityScore: 95,
    category: 'abstract',
  },
  {
    id: 'globe',
    name: 'Globe',
    description: 'Spinning Earth with low-poly landmasses, dual orbit rings, and tiny satellite objects. Clean minimalist style.',
    component: lazy(() => import('../../props/showcase/Globe').then(m => ({ default: m.Globe }))),
    techniques: [
      'IcosahedronGeometry for planet surface',
      'TorusGeometry for orbit rings',
      'Multiple landmass patches',
      'Continuous rotation animation',
    ],
    codeLines: 61,
    qualityScore: 88,
    category: 'display',
  },
  {
    id: 'hourglass',
    name: 'Hourglass',
    description: 'Elegant hourglass with animated falling sand, transparent glass bulbs, golden metal frame, and corner support pillars.',
    component: lazy(() => import('../../props/showcase/Hourglass').then(m => ({ default: m.Hourglass }))),
    techniques: [
      'Dynamic sand level animation (scale + position)',
      'Transparent glass with DoubleSide',
      'Metallic gold frame materials',
      'Falling sand particle stream',
    ],
    codeLines: 90,
    qualityScore: 93,
    category: 'display',
  },
  {
    id: 'plant',
    name: 'Potted Plant',
    description: 'Cheerful potted plant with terracotta pot, soil, stem, and seven procedural leaves that gently sway in the breeze.',
    component: lazy(() => import('../../props/showcase/Plant').then(m => ({ default: m.Plant }))),
    techniques: [
      'ConeGeometry for leaf shapes',
      'Per-leaf sway animation via useFrame',
      'Multi-layer pot (body, rim, soil)',
      'DoubleSide material for thin leaves',
    ],
    codeLines: 73,
    qualityScore: 89,
    category: 'home',
  },
  {
    id: 'rocket',
    name: 'Rocket',
    description: 'Classic cartoon rocket with red nose cone, four fins, a porthole window, and animated flickering exhaust flame.',
    component: lazy(() => import('../../props/showcase/Rocket').then(m => ({ default: m.Rocket }))),
    techniques: [
      'Multi-cone flame with emissive materials',
      'CylinderGeometry + ConeGeometry assembly',
      'TorusGeometry for window frame',
      'Flame flicker animation (scale oscillation)',
    ],
    codeLines: 79,
    qualityScore: 91,
    category: 'abstract',
  },
  {
    id: 'server-rack',
    name: 'Server Rack',
    description: 'Data center server rack with four server units, blinking status LEDs, ventilation slots, and colored cable runs.',
    component: lazy(() => import('../../props/showcase/ServerRack').then(m => ({ default: m.ServerRack }))),
    techniques: [
      'Dynamic LED blinking via useFrame',
      'Repeating server unit pattern',
      'Material emissiveIntensity animation',
      'Colored cable side details',
    ],
    codeLines: 76,
    qualityScore: 90,
    category: 'tech',
  },
  {
    id: 'whiteboard',
    name: 'Whiteboard',
    description: 'Office whiteboard with colorful sticky notes, hand-drawn arrow sketch, marker tray, and three colored markers.',
    component: lazy(() => import('../../props/showcase/Whiteboard').then(m => ({ default: m.Whiteboard }))),
    techniques: [
      '@react-three/drei Text for sticky labels',
      'Random rotation for natural look',
      'Sketch lines as thin boxes',
      'Multi-color marker set',
    ],
    codeLines: 71,
    qualityScore: 87,
    category: 'display',
  },
]
