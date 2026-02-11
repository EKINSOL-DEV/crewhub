import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PHMeter() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.08, 0.22, 0.03]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
            <mesh position={[0, 0.02, 0.017]}>
        <boxGeometry args={[0.05, 0.04, 0.002]} />
        <meshStandardMaterial color="#44ccaa" emissive="#44ccaa" emissiveIntensity={0.8} />
      </mesh>
            <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.06, 4]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
            <mesh position={[0, -0.26, 0]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
            <mesh position={[-0.02, -0.04, 0.017]}>
        <boxGeometry args={[0.015, 0.015, 0.003]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
            <mesh position={[0.02, -0.04, 0.017]}>
        <boxGeometry args={[0.015, 0.015, 0.003]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>

    </group>
  );
}
