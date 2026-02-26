import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Nameplate() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.35, 0.1, 0.04]} />
        <meshStandardMaterial color="#cc9933" flatShading />
      </mesh>
            <mesh position={[0, -0.2, 0.025]}>
        <boxGeometry args={[0.28, 0.05, 0.002]} />
        <meshStandardMaterial color="#bb8822" flatShading />
      </mesh>
            <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.38, 0.02, 0.06]} />
        <meshStandardMaterial color="#aa7722" flatShading />
      </mesh>
      {[-0.16, 0.16].map((x,i) => (
        <mesh key={x} position={[x, -0.2, 0.025]}>
          <boxGeometry args={[0.01, 0.08, 0.005]} />
          <meshStandardMaterial color="#ddbb44" flatShading />
        </mesh>
      ))}

    </group>
  );
}
