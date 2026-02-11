import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function EnergyDrink() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.5) * 0.2; });
  return (
    <group ref={groupRef}>
      {/* Can body */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.45, 12]} />
        <meshStandardMaterial color="#00aa44" flatShading />
      </mesh>
      {/* Top rim */}
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.12, 0.11, 0.02, 12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -0.33, 0]}>
        <cylinderGeometry args={[0.11, 0.12, 0.02, 12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Tab */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.04, 0.005, 0.08]} />
        <meshStandardMaterial color="#bbbbbb" />
      </mesh>
      {/* Logo - lightning bolt */}
      <mesh position={[0, -0.05, 0.121]}>
        <boxGeometry args={[0.03, 0.12, 0.001]} />
        <meshStandardMaterial color="#ffee00" emissive="#ffee00" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.02, -0.12, 0.121]}>
        <boxGeometry args={[0.04, 0.08, 0.001]} />
        <meshStandardMaterial color="#ffee00" emissive="#ffee00" emissiveIntensity={1} />
      </mesh>
      {/* Brand text placeholder */}
      <mesh position={[0, 0.02, 0.122]}>
        <boxGeometry args={[0.1, 0.02, 0.001]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
