import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function MemoryCard() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.08, 0.1, 0.005]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
            <mesh position={[0, -0.15, 0.004]}>
        <boxGeometry args={[0.06, 0.04, 0.002]} />
        <meshStandardMaterial color="#333366" flatShading />
      </mesh>
            <mesh position={[0.02, -0.12, 0.004]}>
        <sphereGeometry args={[0.004, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1} />
      </mesh>
            <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.06, 0.01, 0.004]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>

    </group>
  );
}
