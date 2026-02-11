import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PictureFrame() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.5, 0.02]} />
        <meshStandardMaterial color="#aa7744" flatShading />
      </mesh>
            <mesh position={[0, 0, 0.011]}>
        <boxGeometry args={[0.32, 0.42, 0.005]} />
        <meshStandardMaterial color="#88bbdd" flatShading />
      </mesh>
      <mesh position={[0, 0, 0.015]}><boxGeometry args={[0.32, 0.42, 0.002]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.1} /></mesh>
            <mesh position={[0, -0.2, -0.08]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.04, 0.3, 0.01]} />
        <meshStandardMaterial color="#aa7744" flatShading />
      </mesh>

    </group>
  );
}
