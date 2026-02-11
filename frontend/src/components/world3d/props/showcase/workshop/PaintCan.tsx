import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PaintCan() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15; });
  return (
    <group ref={groupRef}>
      {/* Can body */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.5, 12]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.25, 0.015, 6, 12]} />
        <meshStandardMaterial color="#999aaa" />
      </mesh>
      {/* Lid (off, leaning) */}
      <mesh position={[0.35, -0.35, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 12]} />
        <meshStandardMaterial color="#aaaabb" />
      </mesh>
      {/* Paint inside */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.02, 12]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>
      {/* Paint drip */}
      <mesh position={[0.2, 0, 0.15]}>
        <boxGeometry args={[0.04, 0.15, 0.02]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>
      {/* Label */}
      <mesh position={[0, -0.1, 0.251]}>
        <boxGeometry args={[0.3, 0.2, 0.001]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Label color swatch */}
      <mesh position={[0, -0.05, 0.253]}>
        <boxGeometry args={[0.15, 0.08, 0.001]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>
      {/* Handle */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.15, 0.01, 4, 12, Math.PI]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
    </group>
  );
}
