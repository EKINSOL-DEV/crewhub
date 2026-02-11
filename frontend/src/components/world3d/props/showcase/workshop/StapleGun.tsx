import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function StapleGun() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.06, 0.12, 0.04]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
            <mesh position={[0, -0.2, 0.04]}>
        <boxGeometry args={[0.04, 0.08, 0.03]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
            <mesh position={[0, -0.16, -0.01]}>
        <boxGeometry args={[0.05, 0.04, 0.005]} />
        <meshStandardMaterial color="#777788" flatShading />
      </mesh>
            <mesh position={[0, -0.06, 0.025]}>
        <boxGeometry args={[0.04, 0.02, 0.005]} />
        <meshStandardMaterial color="#666677" flatShading />
      </mesh>

    </group>
  );
}
