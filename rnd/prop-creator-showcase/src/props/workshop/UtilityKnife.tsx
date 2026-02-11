import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function UtilityKnife() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.1, 0.04, 0.015]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0.06, -0.1, 0]}><boxGeometry args={[0.03, 0.02, 0.003]} /><meshStandardMaterial color="#ccccdd" metalness={0.8} roughness={0.1} /></mesh>
            <mesh position={[-0.03, -0.1, 0.009]}>
        <boxGeometry args={[0.02, 0.015, 0.003]} />
        <meshStandardMaterial color="#666677" flatShading />
      </mesh>
            <mesh position={[0, -0.1, -0.009]}>
        <boxGeometry args={[0.06, 0.008, 0.002]} />
        <meshStandardMaterial color="#eebb22" flatShading />
      </mesh>

    </group>
  );
}
