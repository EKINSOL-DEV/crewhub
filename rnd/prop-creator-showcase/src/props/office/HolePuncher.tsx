import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function HolePuncher() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.25, 0.08, 0.12]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
            <mesh position={[0, -0.14, 0]}>
        <boxGeometry args={[0.25, 0.04, 0.12]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.22, 0.02, 0.1]} />
        <meshStandardMaterial color="#555566" flatShading />
      </mesh>
      {[-0.05, 0.05].map((x,i) => (
        <mesh key={`x-${i}`} position={[x, -0.15, 0]}><cylinderGeometry args={[0.015, 0.015, 0.12, 6]} /><meshStandardMaterial color="#888899" flatShading /></mesh>
      ))}
            <mesh position={[0, -0.27, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.06]} />
        <meshStandardMaterial color="#aaaacc" transparent opacity={0.4} flatShading />
      </mesh>

    </group>
  );
}
