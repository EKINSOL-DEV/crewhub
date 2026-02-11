import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function OrbitalSander() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 8]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
            <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.06, 0.1, 0.05]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
            <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.03]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
            <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.01, 8]} />
        <meshStandardMaterial color="#aa8855" flatShading />
      </mesh>

    </group>
  );
}
