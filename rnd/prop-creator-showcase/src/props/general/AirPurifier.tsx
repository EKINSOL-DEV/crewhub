import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function AirPurifier() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.5, 8]} />
        <meshStandardMaterial color="#eeeeff" flatShading />
      </mesh>
            <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 8]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      {[0,1,2,3].map(i => (
        <mesh key={`item-${i}`} position={[0, -0.1+i*0.08, 0.19]}>
          <boxGeometry args={[0.2, 0.015, 0.01]} />
          <meshStandardMaterial color="#bbbbcc" flatShading />
        </mesh>
      ))}
            <mesh position={[0, 0.15, 0.19]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#44ff88" emissive="#44ff88" emissiveIntensity={1.5} />
      </mesh>
            <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.02, 8]} />
        <meshStandardMaterial color="#aaaabb" flatShading />
      </mesh>

    </group>
  );
}
