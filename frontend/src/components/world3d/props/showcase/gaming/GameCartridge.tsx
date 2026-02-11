import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GameCartridge() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.2, 0.25, 0.04]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
            <mesh position={[0, -0.02, 0.022]}>
        <boxGeometry args={[0.14, 0.1, 0.002]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.18, 0.03, 0.03]} />
        <meshStandardMaterial color="#666677" flatShading />
      </mesh>
            <mesh position={[-0.06, 0.02, 0.022]}>
        <boxGeometry args={[0.05, 0.03, 0.002]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>

    </group>
  );
}
