import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LabelMaker() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.12]} />
        <meshStandardMaterial color="#4488dd" flatShading />
      </mesh>
            <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.25, 0.04, 0.1]} />
        <meshStandardMaterial color="#3377cc" flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0.05]}>
        <boxGeometry args={[0.12, 0.02, 0.002]} />
        <meshStandardMaterial color="#88ffaa" emissive="#88ffaa" emissiveIntensity={1} />
      </mesh>
      {[...Array(6)].map((_,i) => (
        <mesh key={i} position={[-0.06+i*0.025, -0.14, 0.06]}><boxGeometry args={[0.02, 0.02, 0.005]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
      ))}
            <mesh position={[0.18, -0.17, 0]}>
        <boxGeometry args={[0.03, 0.005, 0.06]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>

    </group>
  );
}
