import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function StirringRod() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>
            <mesh position={[0, -0.24, 0]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>

    </group>
  );
}
