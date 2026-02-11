import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Projector() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.35, 0.1, 0.25]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh position={[0.18, -0.15, 0]}><cylinderGeometry args={[0.04, 0.05, 0.04, 8]} /><meshStandardMaterial color="#222244" emissive="#ffffcc" emissiveIntensity={1.5} /></mesh>
            <mesh position={[0.21, -0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.005, 8]} />
        <meshStandardMaterial color="#aaddff" transparent opacity={0.5} flatShading />
      </mesh>
      {[...Array(3)].map((_,i) => (
        <mesh key={i} position={[-0.1+i*0.05, -0.12, 0.126]}><boxGeometry args={[0.03, 0.02, 0.002]} /><meshStandardMaterial color="#888899" flatShading /></mesh>
      ))}

    </group>
  );
}
