import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Keyboard() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.12; });
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[1.1, 0.06, 0.4]} />
        <meshStandardMaterial color="#2a2a3a" flatShading />
      </mesh>
      {/* Keys - rows */}
      {[0, 1, 2, 3].map(row =>
        Array.from({ length: 10 }, (_, col) => (
          <mesh key={`${row}-${col}`} position={[-0.45 + col * 0.1, -0.35, 0.12 - row * 0.08]}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color={row === 0 && col < 4 ? '#444466' : '#3a3a4e'} flatShading />
          </mesh>
        ))
      )}
      {/* Spacebar */}
      <mesh position={[0, -0.35, -0.22]}>
        <boxGeometry args={[0.5, 0.04, 0.06]} />
        <meshStandardMaterial color="#3a3a4e" flatShading />
      </mesh>
      {/* RGB strip */}
      <mesh position={[0, -0.37, 0.2]}>
        <boxGeometry args={[1.08, 0.01, 0.01]} />
        <meshStandardMaterial color="#ff44ff" emissive="#ff44ff" emissiveIntensity={2} />
      </mesh>
      {/* USB cable */}
      <mesh position={[0, -0.4, -0.25]}>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  );
}
