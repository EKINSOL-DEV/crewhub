import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Telescope() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef} scale={0.8}>
      {/* Main tube */}
      <mesh position={[0, 0.15, 0]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.8, 8]} />
        <meshStandardMaterial color="#eeeeee" flatShading />
      </mesh>
      {/* Front lens cover */}
      <mesh position={[0, 0.47, -0.17]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 8]} />
        <meshStandardMaterial color="#dddddd" />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0.48, -0.18]} rotation={[0.4, 0, 0]}>
        <circleGeometry args={[0.09, 12]} />
        <meshStandardMaterial color="#3355aa" transparent opacity={0.3} />
      </mesh>
      {/* Eyepiece */}
      <mesh position={[0, -0.17, 0.15]} rotation={[0.4 + Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.1, 6]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Finder scope */}
      <mesh position={[0.1, 0.2, -0.05]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.015, 0.2, 6]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Mount */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.08, 0.08, 0.08]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Tripod legs */}
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={`item-${i}`} position={[Math.sin(a) * 0.15, -0.45, Math.cos(a) * 0.15]} rotation={[Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35]}>
            <cylinderGeometry args={[0.02, 0.015, 0.65, 6]} />
            <meshStandardMaterial color="#444455" />
          </mesh>
        );
      })}
    </group>
  );
}
