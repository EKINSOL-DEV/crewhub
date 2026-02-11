import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Autoclave() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 8]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
            <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 8]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
      <mesh position={[0, 0.12, 0.1]}><torusGeometry args={[0.03, 0.008, 4, 6]} /><meshStandardMaterial color="#999aaa" flatShading /></mesh>
            <mesh position={[0.1, 0, 0.15]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={1.5} />
      </mesh>
            <mesh position={[-0.1, 0, 0.15]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1.5} />
      </mesh>

    </group>
  );
}
