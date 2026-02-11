import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function StreamingMicrophone() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.15, 8]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.065, 0.065, 0.1, 8]} /><meshStandardMaterial color="#444455" flatShading /></mesh>
            <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 6]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
            <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.02, 8]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
            <mesh position={[0, 0.0, 0.065]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={2} />
      </mesh>

    </group>
  );
}
