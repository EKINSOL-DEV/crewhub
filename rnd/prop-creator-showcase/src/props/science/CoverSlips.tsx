import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CoverSlips() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.06, 0.015, 0.06]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      {[...Array(6)].map((_,i) => (
        <mesh key={i} position={[0, -0.24+i*0.003, 0]}>
          <boxGeometry args={[0.05, 0.001, 0.05]} />
          <meshStandardMaterial color="#eeeeff" transparent opacity={0.2} />
        </mesh>
      ))}

    </group>
  );
}
