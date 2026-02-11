import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Scissors() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.4; });
  return (
    <group ref={groupRef}>
      {/* Blade 1 */}
      <mesh position={[-0.05, 0.2, 0]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.04, 0.5, 0.015]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Blade 2 */}
      <mesh position={[0.05, 0.2, 0]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.04, 0.5, 0.015]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Pivot */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.03, 8]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Handle 1 */}
      <mesh position={[-0.12, -0.22, 0]}>
        <torusGeometry args={[0.1, 0.025, 6, 12]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {/* Handle 2 */}
      <mesh position={[0.12, -0.22, 0]}>
        <torusGeometry args={[0.1, 0.025, 6, 12]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {/* Handle connectors */}
      <mesh position={[-0.08, -0.1, 0]}>
        <boxGeometry args={[0.04, 0.15, 0.02]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      <mesh position={[0.08, -0.1, 0]}>
        <boxGeometry args={[0.04, 0.15, 0.02]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
    </group>
  );
}
