import { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

// General (original 10)
import { AIBrain } from './props/AIBrain';
import { DataCrystal } from './props/DataCrystal';
import { CodeTerminal } from './props/CodeTerminal';
import { CoffeeMachine } from './props/CoffeeMachine';
import { Whiteboard } from './props/Whiteboard';
import { Plant } from './props/Plant';
import { ServerRack } from './props/ServerRack';
import { Hourglass } from './props/Hourglass';
import { Globe } from './props/Globe';
import { Rocket } from './props/Rocket';

// Office & Productivity
import { DeskLamp } from './props/office/DeskLamp';
import { Monitor } from './props/office/Monitor';
import { Keyboard } from './props/office/Keyboard';
import { CoffeeMug } from './props/office/CoffeeMug';
import { Printer } from './props/office/Printer';
import { FilingCabinet } from './props/office/FilingCabinet';
import { Bookshelf } from './props/office/Bookshelf';
import { Stapler } from './props/office/Stapler';
import { DeskClock } from './props/office/DeskClock';
import { Headphones } from './props/office/Headphones';
import { WaterBottle } from './props/office/WaterBottle';

// Tech & Developer
import { RaspberryPi } from './props/tech/RaspberryPi';
import { Router } from './props/tech/Router';
import { USBDrive } from './props/tech/USBDrive';
import { MechKeyboard } from './props/tech/MechKeyboard';
import { HardDrive } from './props/tech/HardDrive';
import { VRHeadset } from './props/tech/VRHeadset';
import { CircuitBoard } from './props/tech/CircuitBoard';
import { MonitorStand } from './props/tech/MonitorStand';
import { PowerStrip } from './props/tech/PowerStrip';
import { SolderingIron } from './props/tech/SolderingIron';

// Creative & Art
import { Easel } from './props/creative/Easel';
import { PaintPalette } from './props/creative/PaintPalette';
import { Camera } from './props/creative/Camera';
import { PenTablet } from './props/creative/PenTablet';
import { Sketchbook } from './props/creative/Sketchbook';
import { RingLight } from './props/creative/RingLight';
import { ColorWheel } from './props/creative/ColorWheel';
import { Scissors } from './props/creative/Scissors';
import { StickyNotes } from './props/creative/StickyNotes';
import { Tripod } from './props/creative/Tripod';

// Gaming & Entertainment
import { GameController } from './props/gaming/GameController';
import { GamingChair } from './props/gaming/GamingChair';
import { ArcadeStick } from './props/gaming/ArcadeStick';
import { Figurine } from './props/gaming/Figurine';
import { Dice } from './props/gaming/Dice';
import { RGBStrip } from './props/gaming/RGBStrip';
import { HeadsetStand } from './props/gaming/HeadsetStand';
import { EnergyDrink } from './props/gaming/EnergyDrink';
import { GamingMousePad } from './props/gaming/GamingMousePad';
import { Poster } from './props/gaming/Poster';

// Science & Lab
import { Microscope } from './props/science/Microscope';
import { TestTubes } from './props/science/TestTubes';
import { Beaker } from './props/science/Beaker';
import { BunsenBurner } from './props/science/BunsenBurner';
import { MolecularModel } from './props/science/MolecularModel';
import { Telescope } from './props/science/Telescope';
import { MagnifyingGlass } from './props/science/MagnifyingGlass';
import { SafetyGoggles } from './props/science/SafetyGoggles';
import { PetriDish } from './props/science/PetriDish';
import { Thermometer } from './props/science/Thermometer';

// Workshop & Tools
import { Hammer } from './props/workshop/Hammer';
import { Drill } from './props/workshop/Drill';
import { Toolbox } from './props/workshop/Toolbox';
import { MeasuringTape } from './props/workshop/MeasuringTape';
import { Wrench } from './props/workshop/Wrench';
import { PaintCan } from './props/workshop/PaintCan';
import { Workbench } from './props/workshop/Workbench';
import { SafetyHelmet } from './props/workshop/SafetyHelmet';
import { Screwdriver } from './props/workshop/Screwdriver';
import { WoodPlanks } from './props/workshop/WoodPlanks';

interface PropDef {
  name: string;
  Component: React.FC;
  color: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  props: PropDef[];
}

const categories: Category[] = [
  {
    id: 'general', name: 'General', icon: '🎨',
    props: [
      { name: 'AI Brain', Component: AIBrain, color: '#00ffff' },
      { name: 'Data Crystal', Component: DataCrystal, color: '#aa44ff' },
      { name: 'Code Terminal', Component: CodeTerminal, color: '#66ff66' },
      { name: 'Coffee Machine', Component: CoffeeMachine, color: '#ff6644' },
      { name: 'Whiteboard', Component: Whiteboard, color: '#ffee44' },
      { name: 'Plant', Component: Plant, color: '#44dd66' },
      { name: 'Server Rack', Component: ServerRack, color: '#4488ff' },
      { name: 'Hourglass', Component: Hourglass, color: '#ffcc44' },
      { name: 'Globe', Component: Globe, color: '#44ddff' },
      { name: 'Rocket', Component: Rocket, color: '#ff4444' },
    ],
  },
  {
    id: 'office', name: 'Office & Productivity', icon: '🏢',
    props: [
      { name: 'Desk Lamp', Component: DeskLamp, color: '#ffcc44' },
      { name: 'Monitor', Component: Monitor, color: '#4488ff' },
      { name: 'Keyboard', Component: Keyboard, color: '#ff44ff' },
      { name: 'Coffee Mug', Component: CoffeeMug, color: '#ff6644' },
      { name: 'Printer', Component: Printer, color: '#88dd88' },
      { name: 'Filing Cabinet', Component: FilingCabinet, color: '#7788aa' },
      { name: 'Bookshelf', Component: Bookshelf, color: '#aa8844' },
      { name: 'Stapler', Component: Stapler, color: '#ff2222' },
      { name: 'Desk Clock', Component: DeskClock, color: '#cc8833' },
      { name: 'Headphones', Component: Headphones, color: '#44ffaa' },
      { name: 'Water Bottle', Component: WaterBottle, color: '#4488dd' },
    ],
  },
  {
    id: 'tech', name: 'Tech & Developer', icon: '💻',
    props: [
      { name: 'Raspberry Pi', Component: RaspberryPi, color: '#228833' },
      { name: 'Router', Component: Router, color: '#44ff66' },
      { name: 'USB Drive', Component: USBDrive, color: '#4488ff' },
      { name: 'Mech Keyboard', Component: MechKeyboard, color: '#ff44ff' },
      { name: 'Hard Drive', Component: HardDrive, color: '#aaaacc' },
      { name: 'VR Headset', Component: VRHeadset, color: '#4488ff' },
      { name: 'Circuit Board', Component: CircuitBoard, color: '#44ff44' },
      { name: 'Monitor Stand', Component: MonitorStand, color: '#666688' },
      { name: 'Power Strip', Component: PowerStrip, color: '#ff4444' },
      { name: 'Soldering Iron', Component: SolderingIron, color: '#ff8844' },
    ],
  },
  {
    id: 'creative', name: 'Creative & Art', icon: '🎭',
    props: [
      { name: 'Easel', Component: Easel, color: '#ff4466' },
      { name: 'Paint Palette', Component: PaintPalette, color: '#ff8833' },
      { name: 'Camera', Component: Camera, color: '#444466' },
      { name: 'Pen Tablet', Component: PenTablet, color: '#4488ff' },
      { name: 'Sketchbook', Component: Sketchbook, color: '#884422' },
      { name: 'Ring Light', Component: RingLight, color: '#ffffaa' },
      { name: 'Color Wheel', Component: ColorWheel, color: '#ff00ff' },
      { name: 'Scissors', Component: Scissors, color: '#ff4444' },
      { name: 'Sticky Notes', Component: StickyNotes, color: '#ffee44' },
      { name: 'Tripod', Component: Tripod, color: '#666688' },
    ],
  },
  {
    id: 'gaming', name: 'Gaming & Entertainment', icon: '🎮',
    props: [
      { name: 'Game Controller', Component: GameController, color: '#4488ff' },
      { name: 'Gaming Chair', Component: GamingChair, color: '#ff2244' },
      { name: 'Arcade Stick', Component: ArcadeStick, color: '#ff4444' },
      { name: 'Figurine', Component: Figurine, color: '#ff4444' },
      { name: 'Dice', Component: Dice, color: '#4488ff' },
      { name: 'RGB Strip', Component: RGBStrip, color: '#ff00ff' },
      { name: 'Headset Stand', Component: HeadsetStand, color: '#ff44ff' },
      { name: 'Energy Drink', Component: EnergyDrink, color: '#44ff44' },
      { name: 'Gaming Mouse Pad', Component: GamingMousePad, color: '#ff00ff' },
      { name: 'Poster', Component: Poster, color: '#ff4444' },
    ],
  },
  {
    id: 'science', name: 'Science & Lab', icon: '🔬',
    props: [
      { name: 'Microscope', Component: Microscope, color: '#ffffdd' },
      { name: 'Test Tubes', Component: TestTubes, color: '#ff4466' },
      { name: 'Beaker', Component: Beaker, color: '#44ddaa' },
      { name: 'Bunsen Burner', Component: BunsenBurner, color: '#4488ff' },
      { name: 'Molecular Model', Component: MolecularModel, color: '#ff4444' },
      { name: 'Telescope', Component: Telescope, color: '#ddddee' },
      { name: 'Magnifying Glass', Component: MagnifyingGlass, color: '#cc8833' },
      { name: 'Safety Goggles', Component: SafetyGoggles, color: '#4488ff' },
      { name: 'Petri Dish', Component: PetriDish, color: '#44aa44' },
      { name: 'Thermometer', Component: Thermometer, color: '#ff2244' },
    ],
  },
  {
    id: 'workshop', name: 'Workshop & Tools', icon: '🔧',
    props: [
      { name: 'Hammer', Component: Hammer, color: '#aa7744' },
      { name: 'Drill', Component: Drill, color: '#22aa44' },
      { name: 'Toolbox', Component: Toolbox, color: '#cc2222' },
      { name: 'Measuring Tape', Component: MeasuringTape, color: '#ffcc22' },
      { name: 'Wrench', Component: Wrench, color: '#aaaacc' },
      { name: 'Paint Can', Component: PaintCan, color: '#4488ff' },
      { name: 'Workbench', Component: Workbench, color: '#aa8844' },
      { name: 'Safety Helmet', Component: SafetyHelmet, color: '#ffcc00' },
      { name: 'Screwdriver', Component: Screwdriver, color: '#ff6622' },
      { name: 'Wood Planks', Component: WoodPlanks, color: '#bb8844' },
    ],
  },
];

function PropCard({ name, Component, color, index }: {
  name: string;
  Component: React.FC;
  color: string;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        borderRadius: 16,
        background: 'linear-gradient(145deg, #12122a, #1a1a3a)',
        border: `1px solid ${hovered ? color : '#2a2a4a'}`,
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? `0 0 30px ${color}33` : 'none',
        overflow: 'hidden',
        cursor: 'grab',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0.5, 3]} fov={35} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 3]} intensity={1} />
        <pointLight position={[-2, 2, 2]} intensity={0.5} color={color} />
        <Suspense fallback={null}>
          <Component />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 0 10px',
          textAlign: 'center',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          color: hovered ? color : '#aaaacc',
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: 0.5,
          transition: 'color 0.3s ease',
          pointerEvents: 'none',
        }}
      >
        {name}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          color: '#555577',
          fontSize: 11,
          fontWeight: 500,
          pointerEvents: 'none',
        }}
      >
        #{String(index + 1).padStart(2, '0')}
      </div>
    </div>
  );
}

export default function PropShowcase() {
  const [activeTab, setActiveTab] = useState('general');
  const activeCategory = categories.find(c => c.id === activeTab)!;
  const totalProps = categories.reduce((sum, c) => sum + c.props.length, 0);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #0a0a1a, #0f0f2a)',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        padding: '16px 40px 8px',
        flexShrink: 0,
      }}>
        <h1 style={{
          color: '#eeeeff',
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          letterSpacing: 1,
        }}>
          🎨 PropCreator Design Showcase
        </h1>
        <p style={{
          color: '#6666aa',
          fontSize: 14,
          marginTop: 6,
        }}>
          {totalProps} unique prop designs across {categories.length} categories • CrewHub R&D
        </p>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '0 40px 12px',
        flexShrink: 0,
        overflowX: 'auto',
        justifyContent: 'center',
      }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.3,
              transition: 'all 0.25s ease',
              background: activeTab === cat.id
                ? 'linear-gradient(135deg, #3344aa, #4466cc)'
                : 'rgba(255,255,255,0.05)',
              color: activeTab === cat.id ? '#ffffff' : '#7777aa',
              boxShadow: activeTab === cat.id ? '0 2px 12px rgba(50,80,200,0.3)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.icon} {cat.name}
            <span style={{
              marginLeft: 6,
              fontSize: 11,
              opacity: 0.6,
            }}>
              ({cat.props.length})
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 40px 40px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {activeCategory.props.map((prop, i) => (
            <PropCard key={`${activeTab}-${prop.name}`} {...prop} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
