import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Workbench() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1; });
  return (
    <group ref={groupRef} scale={0.65}>
      {/* Top surface */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.6]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      {/* Legs */}
      {[[-0.6, -0.2], [0.6, -0.2], [-0.6, 0.2], [0.6, 0.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.35, z]}>
          <boxGeometry args={[0.06, 0.8, 0.06]} />
          <meshStandardMaterial color="#886633" flatShading />
        </mesh>
      ))}
      {/* Lower shelf */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1.3, 0.04, 0.5]} />
        <meshStandardMaterial color="#997744" flatShading />
      </mesh>
      {/* Vice */}
      <mesh position={[-0.5, 0.2, 0.25]}>
        <boxGeometry args={[0.15, 0.12, 0.1]} />
        <meshStandardMaterial color="#555566" flatShading />
      </mesh>
      <mesh position={[-0.5, 0.2, 0.32]}>
        <boxGeometry args={[0.12, 0.1, 0.04]} />
        <meshStandardMaterial color="#666677" />
      </mesh>
      {/* Screw handle */}
      <mesh position={[-0.5, 0.2, 0.38]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Items on bench */}
      <mesh position={[0.2, 0.18, 0]}>
        <boxGeometry args={[0.08, 0.06, 0.08]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      <mesh position={[0.4, 0.2, 0.1]} rotation={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
        <meshStandardMaterial color="#ffaa22" />
      </mesh>
    </group>
  );
}
