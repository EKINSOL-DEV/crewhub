import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function SpecimenJar() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) { groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15; groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02; } });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 8]} />
        <meshStandardMaterial color="#ccddee" transparent opacity={0.25} flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 8]} />
        <meshStandardMaterial color="#ddcc88" transparent opacity={0.3} flatShading />
      </mesh>
            <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.02, 8]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, -0.08, 0]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#ccbb88" transparent opacity={0.5} flatShading /></mesh>

    </group>
  );
}
