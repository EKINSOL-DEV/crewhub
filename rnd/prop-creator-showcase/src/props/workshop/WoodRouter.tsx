import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function WoodRouter() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.18, 8]} />
        <meshStandardMaterial color="#44aa44" flatShading />
      </mesh>
            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.15]} />
        <meshStandardMaterial color="#338833" flatShading />
      </mesh>
            <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.04, 4]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
            <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.03]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
            <mesh position={[0.05, 0, 0.06]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#ff8844" emissive="#ff8844" emissiveIntensity={1} />
      </mesh>

    </group>
  );
}
