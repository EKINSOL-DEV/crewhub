import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PortfolioCase() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.04]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
            <mesh position={[0, -0.05, 0.022]}>
        <boxGeometry args={[0.48, 0.58, 0.002]} />
        <meshStandardMaterial color="#333355" flatShading />
      </mesh>
            <mesh position={[0.22, 0, 0.025]}>
        <boxGeometry args={[0.02, 0.12, 0.005]} />
        <meshStandardMaterial color="#ccbb44" flatShading />
      </mesh>
            <mesh position={[0, 0.28, 0.022]}>
        <boxGeometry args={[0.15, 0.02, 0.005]} />
        <meshStandardMaterial color="#444466" flatShading />
      </mesh>

    </group>
  );
}
