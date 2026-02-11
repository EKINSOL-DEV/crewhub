import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function WristRest() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[0.4, 0.03, 0.08]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, -0.24, 0]}><boxGeometry args={[0.38, 0.02, 0.07]} /><meshStandardMaterial color="#444466" flatShading /></mesh>
            <mesh position={[0, -0.235, 0.035]}>
        <boxGeometry args={[0.35, 0.003, 0.002]} />
        <meshStandardMaterial color="#ff44ff" emissive="#ff44ff" emissiveIntensity={0.8} />
      </mesh>

    </group>
  );
}
