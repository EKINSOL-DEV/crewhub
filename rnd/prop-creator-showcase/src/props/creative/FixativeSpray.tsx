import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function FixativeSpray() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
            <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.03, 6]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
            <mesh position={[0, -0.05, 0.042]}>
        <boxGeometry args={[0.06, 0.12, 0.002]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
            <mesh position={[0, -0.19, 0]}>
        <cylinderGeometry args={[0.038, 0.04, 0.02, 8]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>

    </group>
  );
}
