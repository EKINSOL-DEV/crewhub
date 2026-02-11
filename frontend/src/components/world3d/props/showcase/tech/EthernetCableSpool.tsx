import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function EthernetCableSpool() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 12]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 12]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0]}><torusGeometry args={[0.15, 0.02, 6, 12]} /><meshStandardMaterial color="#4488ff" flatShading /></mesh>

    </group>
  );
}
