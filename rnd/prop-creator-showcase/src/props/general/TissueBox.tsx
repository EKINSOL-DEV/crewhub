import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function TissueBox() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.25, 0.1, 0.13]} />
        <meshStandardMaterial color="#88ccff" flatShading />
      </mesh>
            <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.1, 0.01, 0.04]} />
        <meshStandardMaterial color="#6699cc" flatShading />
      </mesh>
            <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.002]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {Array.from({length: 3}).map((_,i) => (
        <mesh key={JSON.stringify(_)} position={[-0.06+i*0.06, -0.18, 0.066]}>
          <sphereGeometry args={[0.015, 4, 4]} />
          <meshStandardMaterial color="#66aadd" flatShading />
        </mesh>
      ))}

    </group>
  );
}
