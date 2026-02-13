import { ComponentType } from 'react'
import { TheRing } from './TheRing'
import { TheCantilever } from './TheCantilever'
import { TheAtrium } from './TheAtrium'
import { TheHelix } from './TheHelix'
import { ThePavilions } from './ThePavilions'

export interface DesignEntry {
  name: string
  description: string
  component: ComponentType
  cameraPos: [number, number, number]
}

export const designs: DesignEntry[] = [
  {
    name: 'The Ring',
    description: 'Inspired by Apple Park — a curved, ring-shaped building enclosing a central courtyard garden with reflecting pool. Two stories with cantilevered upper floor. The inner courtyard features trees and landscaping visible through glass panels.',
    component: TheRing,
    cameraPos: [14, 10, 14],
  },
  {
    name: 'The Cantilever',
    description: 'Inspired by OMA / CCTV HQ Beijing — two offset towers of different heights connected by a dramatic bridging volume. Angular meeting pods jut out from the facade. Exposed structural cross-bracing expresses engineering boldness.',
    component: TheCantilever,
    cameraPos: [16, 12, 16],
  },
  {
    name: 'The Atrium',
    description: 'Inspired by the Guggenheim — a 4-story building with a dramatic central void running through all floors. Balconied walkways wrap the atrium, glass bridges cross at different levels, and a skylight floods the core with natural light.',
    component: TheAtrium,
    cameraPos: [18, 12, 18],
  },
  {
    name: 'The Helix',
    description: 'Inspired by Zaha Hadid / BIG — a spiraling structure that wraps 2.5 rotations around a central core. The continuous floor plate ramps upward with workspaces along the outer edge. A translucent canopy crowns the top observation deck.',
    component: TheHelix,
    cameraPos: [14, 10, 14],
  },
  {
    name: 'The Pavilions',
    description: 'Inspired by Google Campus / Renzo Piano — four distinct pavilions connected by enclosed sky bridges. Each has unique character: main office, creative hub, tech lab, and social lounge. Sheltered courtyards with landscaping between buildings.',
    component: ThePavilions,
    cameraPos: [18, 14, 18],
  },
]
