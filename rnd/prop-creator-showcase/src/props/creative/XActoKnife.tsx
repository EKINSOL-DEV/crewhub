import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function XActoKnife() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.008, 0.01, 0.2, 6]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
            <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.002, 0.008, 0.04, 3]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.012, 0.01, 0.04, 6]} />
        <meshStandardMaterial color="#cc8833" flatShading />
      </mesh>

    </group>
  );
}
