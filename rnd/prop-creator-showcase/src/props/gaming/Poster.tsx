import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Poster() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1; });
  return (
    <group ref={groupRef}>
      {/* Frame */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.7, 0.95, 0.03]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Poster paper */}
      <mesh position={[0, 0.05, 0.016]}>
        <boxGeometry args={[0.6, 0.85, 0.005]} />
        <meshStandardMaterial color="#1a0a2e" />
      </mesh>
      {/* Art - pixel character */}
      <mesh position={[0, 0.15, 0.02]}>
        <boxGeometry args={[0.15, 0.15, 0.001]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={0.5} />
      </mesh>
      {/* Sword */}
      <mesh position={[0.12, 0.2, 0.02]}>
        <boxGeometry args={[0.02, 0.2, 0.001]} />
        <meshStandardMaterial color="#ffcc44" />
      </mesh>
      {/* Title text */}
      <mesh position={[0, 0.38, 0.02]}>
        <boxGeometry args={[0.35, 0.05, 0.001]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={0.8} />
      </mesh>
      {/* Stars */}
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, -0.2, 0.02]}>
          <sphereGeometry args={[0.015, 4, 4]} />
          <meshStandardMaterial color="#ffcc44" emissive="#ffcc44" emissiveIntensity={1} />
        </mesh>
      ))}
      {/* Rating */}
      <mesh position={[0, -0.3, 0.02]}>
        <boxGeometry args={[0.15, 0.04, 0.001]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
