import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GamingChairFootrest() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[0.35, 0.04, 0.18]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
            <mesh position={[0, -0.21, 0]}>
        <boxGeometry args={[0.33, 0.02, 0.16]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {[-0.14, 0.14].map((x,i) => (
        <mesh key={x} position={[x, -0.28, 0]}><boxGeometry args={[0.03, 0.02, 0.16]} /><meshStandardMaterial color="#ff4444" flatShading /></mesh>
      ))}
            <mesh position={[0, -0.215, 0.08]}>
        <boxGeometry args={[0.2, 0.003, 0.002]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={0.8} />
      </mesh>

    </group>
  );
}
