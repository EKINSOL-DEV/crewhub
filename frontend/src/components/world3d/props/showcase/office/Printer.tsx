import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Printer() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.9, 0.35, 0.6]} />
        <meshStandardMaterial color="#e8e8ee" flatShading />
      </mesh>
      {/* Top lid */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.92, 0.04, 0.62]} />
        <meshStandardMaterial color="#d8d8e0" flatShading />
      </mesh>
      {/* Paper tray out */}
      <mesh position={[0, -0.18, 0.35]}>
        <boxGeometry args={[0.5, 0.02, 0.15]} />
        <meshStandardMaterial color="#d0d0d8" />
      </mesh>
      {/* Paper */}
      <mesh position={[0, -0.16, 0.38]}>
        <boxGeometry args={[0.4, 0.01, 0.2]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Paper feed */}
      <mesh position={[0, 0.15, -0.2]}>
        <boxGeometry args={[0.5, 0.15, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Control panel */}
      <mesh position={[0.25, 0.05, 0.31]}>
        <boxGeometry args={[0.2, 0.08, 0.01]} />
        <meshStandardMaterial color="#222244" emissive="#112233" emissiveIntensity={0.5} />
      </mesh>
      {/* LED */}
      <mesh position={[0.38, 0.05, 0.31]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}
