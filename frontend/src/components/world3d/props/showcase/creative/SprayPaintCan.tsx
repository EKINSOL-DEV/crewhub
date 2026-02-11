import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function SprayPaintCan() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.25, 8]} />
        <meshStandardMaterial color="#ff4488" flatShading />
      </mesh>
            <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
            <mesh position={[0, -0.05, 0.062]}>
        <boxGeometry args={[0.08, 0.12, 0.002]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
            <mesh position={[0, -0.17, 0]}>
        <cylinderGeometry args={[0.058, 0.06, 0.02, 8]} />
        <meshStandardMaterial color="#cc3366" flatShading />
      </mesh>

    </group>
  );
}
