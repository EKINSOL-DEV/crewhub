import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function BusinessCardHolder() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.22, 0]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.15, 0.08, 0.06]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {[0,1,2].map(i => (
        <mesh key={`item-${i}`} position={[0, -0.16+i*0.008, 0.01+i*0.005]} rotation={[-0.2, 0, 0]}><boxGeometry args={[0.12, 0.002, 0.07]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
      ))}
            <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.16, 0.01, 0.08]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>

    </group>
  );
}
