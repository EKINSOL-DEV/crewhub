import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function WorkLight() {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1;
    if (lightRef.current) { const i = 1.5 + Math.sin(s.clock.elapsedTime * 2) * 0.5; (lightRef.current.material as any).emissiveIntensity = i; }
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 8]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
            <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
            <mesh position={[0, 0.08, 0.05]}>
        <boxGeometry args={[0.2, 0.15, 0.02]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh ref={lightRef} position={[0, 0.08, 0.065]}><boxGeometry args={[0.16, 0.1, 0.005]} /><meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={2} /></mesh>
      <mesh position={[0, 0.02, 0.02]}><boxGeometry args={[0.03, 0.03, 0.015]} /><meshStandardMaterial color="#444455" flatShading /></mesh>

    </group>
  );
}
