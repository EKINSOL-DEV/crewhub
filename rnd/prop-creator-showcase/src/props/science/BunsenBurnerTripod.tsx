import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function BunsenBurnerTripod() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.02, 3]} />
        <meshStandardMaterial color="#777788" flatShading />
      </mesh>
      {[0,1,2].map(i => (
        <mesh key={i} position={[Math.cos(i*Math.PI*2/3)*0.14, -0.22, Math.sin(i*Math.PI*2/3)*0.14]}>
          <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
          <meshStandardMaterial color="#888899" flatShading />
        </mesh>
      ))}
      <mesh position={[0, -0.1, 0]}><torusGeometry args={[0.06, 0.005, 4, 8]} /><meshStandardMaterial color="#888899" flatShading /></mesh>

    </group>
  );
}
