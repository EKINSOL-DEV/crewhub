import { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
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

const PROPS = [
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
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #0a0a1a, #0f0f2a)',
      overflow: 'auto',
      padding: '20px 40px 40px',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: 24,
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
          10 unique prop designs for CrewHub workspaces • R&D
        </p>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 16,
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {PROPS.map((prop, i) => (
          <PropCard key={prop.name} {...prop} index={i} />
        ))}
      </div>
    </div>
  );
}
