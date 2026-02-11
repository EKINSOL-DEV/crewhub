import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PresentationPointer() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) { groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15; groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02; } });
  return (
    <group ref={groupRef}>

            <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.015, 0.35, 6]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
            <mesh position={[0, 0.19, 0]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={2} />
      </mesh>
            <mesh position={[0, 0.05, 0.013]}>
        <boxGeometry args={[0.018, 0.025, 0.003]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
            <mesh position={[0, -0.05, 0.013]}>
        <boxGeometry args={[0.015, 0.02, 0.003]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>

    </group>
  );
}
