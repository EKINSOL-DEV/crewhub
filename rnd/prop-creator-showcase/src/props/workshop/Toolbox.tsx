import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Toolbox() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef}>
      {/* Main box */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.8, 0.35, 0.4]} />
        <meshStandardMaterial color="#cc2222" flatShading />
      </mesh>
      {/* Lid (open) */}
      <mesh position={[0, -0.02, -0.18]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[0.82, 0.04, 0.42]} />
        <meshStandardMaterial color="#dd3333" flatShading />
      </mesh>
      {/* Top tray */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.7, 0.1, 0.3]} />
        <meshStandardMaterial color="#bb2222" flatShading />
      </mesh>
      {/* Handle */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.4, 0.03, 0.03]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Handle supports */}
      {[-0.18, 0.18].map((x, i) => (
        <mesh key={i} position={[x, -0.01, 0]}>
          <boxGeometry args={[0.03, 0.1, 0.03]} />
          <meshStandardMaterial color="#333344" />
        </mesh>
      ))}
      {/* Latches */}
      {[-0.25, 0.25].map((x, i) => (
        <mesh key={i} position={[x, -0.12, 0.21]}>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      ))}
      {/* Tools peeking out */}
      <mesh position={[0.2, 0, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.015, 0.02, 0.25, 6]} />
        <meshStandardMaterial color="#ffaa22" />
      </mesh>
      <mesh position={[-0.15, 0.02, 0.05]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.02, 0.2, 0.015]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
    </group>
  );
}
