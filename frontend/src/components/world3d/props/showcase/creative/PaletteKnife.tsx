import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PaletteKnife() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

      <mesh><boxGeometry args={[0.04, 0.18, 0.003]} /><meshStandardMaterial color="#ccccdd" metalness={0.7} roughness={0.2} flatShading /></mesh>
            <mesh position={[0, -0.13, 0]}>
        <cylinderGeometry args={[0.015, 0.012, 0.12, 6]} />
        <meshStandardMaterial color="#884422" flatShading />
      </mesh>
            <mesh position={[0.01, 0.06, 0.003]}>
        <boxGeometry args={[0.02, 0.04, 0.003]} />
        <meshStandardMaterial color="#ff6644" flatShading />
      </mesh>

    </group>
  );
}
