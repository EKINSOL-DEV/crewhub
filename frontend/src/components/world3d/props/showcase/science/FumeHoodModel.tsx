import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function FumeHoodModel() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
            <mesh position={[0, 0, 0.16]}>
        <boxGeometry args={[0.38, 0.35, 0.005]} />
        <meshStandardMaterial color="#aaddff" transparent opacity={0.2} flatShading />
      </mesh>
            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.32]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
            <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.32]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
            <mesh position={[0.15, 0.18, 0.1]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1} />
      </mesh>

    </group>
  );
}
