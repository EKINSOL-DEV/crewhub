import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function MagnifyingLamp() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.03, 8]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 6]} />
        <meshStandardMaterial color="#666677" flatShading />
      </mesh>
            <mesh position={[0.08, 0.1, 0]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
        <meshStandardMaterial color="#666677" flatShading />
      </mesh>
      <mesh position={[0.15, 0.18, 0]}><torusGeometry args={[0.08, 0.008, 6, 12]} /><meshStandardMaterial color="#777788" flatShading /></mesh>
      <mesh position={[0.15, 0.18, 0]}><cylinderGeometry args={[0.07, 0.07, 0.005, 12]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.15} emissive="#ffffcc" emissiveIntensity={1} /></mesh>

    </group>
  );
}
