import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LabNotebook() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.25, 0.32, 0.02]} />
        <meshStandardMaterial color="#222266" flatShading />
      </mesh>
            <mesh position={[0, -0.12, 0.012]}>
        <boxGeometry args={[0.23, 0.3, 0.002]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {[0,1,2,3].map(i => (
        <mesh key={i} position={[0, -0.02+i*0.06, 0.014]}><boxGeometry args={[0.15, 0.003, 0.001]} /><meshStandardMaterial color="#4444aa" /></mesh>
      ))}
            <mesh position={[-0.1, -0.12, 0.012]}>
        <boxGeometry args={[0.03, 0.3, 0.001]} />
        <meshStandardMaterial color="#cc4444" flatShading />
      </mesh>

    </group>
  );
}
