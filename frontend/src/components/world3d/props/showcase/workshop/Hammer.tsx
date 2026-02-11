import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Hammer() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2; });
  return (
    <group ref={groupRef} rotation={[0, 0, -0.3]}>
      {/* Handle */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.6, 8]} />
        <meshStandardMaterial color="#aa7744" flatShading />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.25, 8]} />
        <meshStandardMaterial color="#777788" flatShading />
      </mesh>
      {/* Face (striking surface) */}
      <mesh position={[0.13, 0.2, 0]}>
        <cylinderGeometry args={[0.055, 0.06, 0.02, 8]} />
        <meshStandardMaterial color="#999aaa" />
      </mesh>
      {/* Claw */}
      <mesh position={[-0.12, 0.22, 0.02]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.02, 0.08, 0.02]} />
        <meshStandardMaterial color="#777788" />
      </mesh>
      <mesh position={[-0.12, 0.22, -0.02]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.02, 0.08, 0.02]} />
        <meshStandardMaterial color="#777788" />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.15, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
}
