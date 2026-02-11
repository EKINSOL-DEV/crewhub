import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function TimeClock() {
  const groupRef = useRef<THREE.Group>(null);
  const handRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.08;
    if (handRef.current) handRef.current.rotation.z = -s.clock.elapsedTime * 0.5;
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.25, 0.35, 0.1]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
            <mesh position={[0, 0.05, 0.055]}>
        <cylinderGeometry args={[0.07, 0.07, 0.005, 12]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh ref={handRef} position={[0, 0.05, 0.06]}><boxGeometry args={[0.003, 0.05, 0.002]} /><meshStandardMaterial color="#222222" /></mesh>
            <mesh position={[0, -0.12, 0.055]}>
        <boxGeometry args={[0.15, 0.02, 0.005]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
            <mesh position={[0, -0.18, 0.055]}>
        <boxGeometry args={[0.1, 0.04, 0.002]} />
        <meshStandardMaterial color="#44cc44" emissive="#44cc44" emissiveIntensity={0.5} />
      </mesh>

    </group>
  );
}
