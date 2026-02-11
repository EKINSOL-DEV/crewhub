import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function TestTubes() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  const tubes = [
    { x: -0.15, color: '#ff4466', level: 0.6 },
    { x: -0.05, color: '#44ff88', level: 0.4 },
    { x: 0.05, color: '#4488ff', level: 0.7 },
    { x: 0.15, color: '#ffcc44', level: 0.3 },
  ];
  return (
    <group ref={groupRef}>
      {/* Rack */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.12]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.12]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      {/* Rack uprights */}
      {[-0.22, 0.22].map((x, i) => (
        <mesh key={i} position={[x, -0.2, 0]}>
          <boxGeometry args={[0.03, 0.25, 0.03]} />
          <meshStandardMaterial color="#aa8844" flatShading />
        </mesh>
      ))}
      {/* Test tubes */}
      {tubes.map((t, i) => (
        <group key={i}>
          {/* Glass */}
          <mesh position={[t.x, 0.05, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
            <meshStandardMaterial color="#aaccee" transparent opacity={0.3} />
          </mesh>
          {/* Liquid */}
          <mesh position={[t.x, -0.2 + t.level * 0.25, 0]}>
            <cylinderGeometry args={[0.025, 0.025, t.level * 0.35, 8]} />
            <meshStandardMaterial color={t.color} transparent opacity={0.6} />
          </mesh>
          {/* Rounded bottom */}
          <mesh position={[t.x, -0.2, 0]}>
            <sphereGeometry args={[0.03, 6, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#aaccee" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
      {/* Bubbles in one tube */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0.05, -0.1 + i * 0.08, 0.01]}>
          <sphereGeometry args={[0.008, 4, 4]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}
