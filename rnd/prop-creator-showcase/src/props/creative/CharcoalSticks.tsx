import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CharcoalSticks() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.2, 0.01, 0.12]} />
        <meshStandardMaterial color="#aa8855" flatShading />
      </mesh>
      {[0,1,2,3,4].map(i => (
        <mesh key={`item-${i}`} position={[-0.06+i*0.03, -0.19, 0]} rotation={[0, 0, (i-2)*0.08]}><cylinderGeometry args={[0.008, 0.008, 0.15, 4]} /><meshStandardMaterial color="#222222" flatShading /></mesh>
      ))}

    </group>
  );
}
