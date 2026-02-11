import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PipeWrench() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.03, 0.35, 0.02]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
            <mesh position={[0, 0.15, 0.015]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
            <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.02, 0.08, 0.02]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
            <mesh position={[0.02, 0.18, 0.015]}>
        <boxGeometry args={[0.01, 0.04, 0.003]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>

    </group>
  );
}
