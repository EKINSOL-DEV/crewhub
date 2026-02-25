// ─── Built-in Prop Registration ─────────────────────────────────
// Data mapping: propId → component + config.
// Registers all built-in props through the same API that mods use.

import { propRegistry } from '@/lib/modding/registries'
import type { PropEntry } from './PropRegistry'

// Static prop components
import { MeetingTableProp } from '../../props/MeetingTable'

import {
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
  DeskLampProp,
  CableMessProp,
  EaselProp,
  ColorPaletteProp,
  MoodBoardProp,
  PresentationScreenProp,
  BarChartProp,
  MegaphoneProp,
  StandingDeskProp,
  RoundTableProp,
  BeanBagProp,
  BookshelfProp,
  SmallScreenProp,
  ConveyorBeltProp,
  ControlPanelProp,
  SatelliteDishProp,
  AntennaTowerProp,
  HeadsetProp,
  FilingCabinetProp,
  FireExtinguisherProp,
  DrawingTabletProp,
  StatusLightsProp,
  DeskWithMonitorProp,
  DeskWithDualMonitorsProp,
  StandingDeskWithMonitorProp,
  DeskWithMonitorHeadsetProp,
  DeskWithMonitorTabletProp,
  NullProp,
} from './propComponents'

// Animated prop components
import { WallClockProp, GearMechanismProp, SignalWavesProp } from './propAnimations'

/** Register all built-in props. Called once at module load. */
function registerBuiltinProps(): void {
  const builtins: Record<string, PropEntry> = {
    // ─── Floor props (sit on room floor, geometry builds upward from yOffset) ──
    desk: { component: DeskProp, mountType: 'floor', yOffset: 0.16 },
    monitor: { component: MonitorProp, mountType: 'floor', yOffset: 0.16 },
    chair: { component: ChairProp, mountType: 'floor', yOffset: 0.16 },
    lamp: { component: LampProp, mountType: 'floor', yOffset: 0.16 },
    plant: { component: PlantProp, mountType: 'floor', yOffset: 0.16 },
    'coffee-machine': { component: CoffeeMachineProp, mountType: 'floor', yOffset: 0.16 },
    'water-cooler': { component: WaterCoolerProp, mountType: 'floor', yOffset: 0.16 },
    bench: { component: BenchProp, mountType: 'floor', yOffset: 0.16 },
    'server-rack': { component: ServerRackProp, mountType: 'floor', yOffset: 0.16 },
    'desk-lamp': { component: DeskLampProp, mountType: 'floor', yOffset: 0.16 },
    'cable-mess': { component: CableMessProp, mountType: 'floor', yOffset: 0.16 },
    easel: { component: EaselProp, mountType: 'floor', yOffset: 0.16 },
    'color-palette': { component: ColorPaletteProp, mountType: 'floor', yOffset: 0.16 },
    'bar-chart': { component: BarChartProp, mountType: 'floor', yOffset: 0.16 },
    megaphone: { component: MegaphoneProp, mountType: 'floor', yOffset: 0.16 },
    'standing-desk': { component: StandingDeskProp, mountType: 'floor', yOffset: 0.16 },
    'round-table': { component: RoundTableProp, mountType: 'floor', yOffset: 0.16 },
    'bean-bag': { component: BeanBagProp, mountType: 'floor', yOffset: 0.16 },
    bookshelf: { component: BookshelfProp, mountType: 'floor', yOffset: 0.16 },
    'conveyor-belt': { component: ConveyorBeltProp, mountType: 'floor', yOffset: 0.16 },
    'control-panel': { component: ControlPanelProp, mountType: 'floor', yOffset: 0.16 },
    'antenna-tower': { component: AntennaTowerProp, mountType: 'floor', yOffset: 0.16 },
    headset: { component: HeadsetProp, mountType: 'floor', yOffset: 0.16 },
    'filing-cabinet': { component: FilingCabinetProp, mountType: 'floor', yOffset: 0.16 },
    'fire-extinguisher': { component: FireExtinguisherProp, mountType: 'floor', yOffset: 0.16 },
    'drawing-tablet': { component: DrawingTabletProp, mountType: 'floor', yOffset: 0.16 },

    // ─── Wall props (mounted on walls; yOffset = mount height from room base) ──
    'notice-board': { component: NoticeBoardProp, mountType: 'wall', yOffset: 1.3 },
    whiteboard: { component: WhiteboardProp, mountType: 'wall', yOffset: 1.2 },
    'mood-board': { component: MoodBoardProp, mountType: 'wall', yOffset: 1.2 },
    'presentation-screen': { component: PresentationScreenProp, mountType: 'wall', yOffset: 1.5 },
    'wall-clock': { component: WallClockProp, mountType: 'wall', yOffset: 2.2 },
    'small-screen': { component: SmallScreenProp, mountType: 'wall', yOffset: 1.5 },
    'gear-mechanism': { component: GearMechanismProp, mountType: 'wall', yOffset: 1.2 },
    'satellite-dish': { component: SatelliteDishProp, mountType: 'wall', yOffset: 2 },
    'signal-waves': { component: SignalWavesProp, mountType: 'wall', yOffset: 2 },
    'status-lights': { component: StatusLightsProp, mountType: 'wall', yOffset: 1.3 },

    // ─── Composite props (desk + accessory combos) ───────────────
    'desk-with-monitor': { component: DeskWithMonitorProp, mountType: 'floor', yOffset: 0.16 },
    'desk-with-dual-monitors': {
      component: DeskWithDualMonitorsProp,
      mountType: 'floor',
      yOffset: 0.16,
    },
    'standing-desk-with-monitor': {
      component: StandingDeskWithMonitorProp,
      mountType: 'floor',
      yOffset: 0.16,
    },
    'desk-with-monitor-headset': {
      component: DeskWithMonitorHeadsetProp,
      mountType: 'floor',
      yOffset: 0.16,
    },
    'desk-with-monitor-tablet': {
      component: DeskWithMonitorTabletProp,
      mountType: 'floor',
      yOffset: 0.16,
    },

    // ─── Meeting table (interactive) ────────────────────────────────
    'meeting-table': { component: MeetingTableProp, mountType: 'floor', yOffset: 0.16 },

    // ─── Interaction-only (no visual) ────────────────────────────
    'work-point': { component: NullProp, mountType: 'floor', yOffset: 0 },
    'work-point-1': { component: NullProp, mountType: 'floor', yOffset: 0 },
    'work-point-2': { component: NullProp, mountType: 'floor', yOffset: 0 },
    'coffee-point': { component: NullProp, mountType: 'floor', yOffset: 0 },
    'sleep-corner': { component: NullProp, mountType: 'floor', yOffset: 0 },
  }

  for (const [id, entry] of Object.entries(builtins)) {
    // Ensure proper namespace prefix for builtin props
    const namespacedId = id.includes(':') ? id : `builtin:${id}`
    propRegistry.register(namespacedId, entry, 'builtin')
  }
}

// Self-register all built-in props on module load
registerBuiltinProps()
