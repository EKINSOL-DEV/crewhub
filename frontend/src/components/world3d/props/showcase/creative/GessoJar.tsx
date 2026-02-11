import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GessoJar() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 8]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
            <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.105, 0.105, 0.02, 8]} />
        <meshStandardMaterial color="#dddddd" flatShading />
      </mesh>
            <mesh position={[0, -0.12, 0.102]}>
        <boxGeometry args={[0.1, 0.1, 0.002]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>

    </group>
  );
}
