import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function HardDrive() {
  const diskRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15;
    if (diskRef.current) diskRef.current.rotation.y += 0.1;
  });
  return (
    <group ref={groupRef}>
      {/* Case */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.7, 0.12, 0.5]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      {/* Top cover (transparent) */}
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.68, 0.02, 0.48]} />
        <meshStandardMaterial color="#aaaacc" transparent opacity={0.3} />
      </mesh>
      {/* Platter */}
      <mesh ref={diskRef} position={[-0.05, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.01, 16]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Spindle */}
      <mesh position={[-0.05, -0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
        <meshStandardMaterial color="#666677" />
      </mesh>
      {/* Read arm */}
      <mesh position={[0.15, -0.14, 0.05]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.25, 0.02, 0.03]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* SATA connector */}
      <mesh position={[0.3, -0.2, -0.22]}>
        <boxGeometry args={[0.15, 0.06, 0.04]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* Label */}
      <mesh position={[0.15, -0.13, -0.1]}>
        <boxGeometry args={[0.2, 0.005, 0.15]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
    </group>
  );
}
