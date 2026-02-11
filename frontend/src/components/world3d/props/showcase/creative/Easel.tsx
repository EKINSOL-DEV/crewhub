import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Easel() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef}>
      {/* Front legs */}
      {[-0.25, 0.25].map((x, i) => (
        <mesh key={i} position={[x, -0.1, 0.1]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.04, 1.4, 0.04]} />
          <meshStandardMaterial color="#aa7744" flatShading />
        </mesh>
      ))}
      {/* Back leg */}
      <mesh position={[0, -0.1, -0.25]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.04, 1.3, 0.04]} />
        <meshStandardMaterial color="#aa7744" flatShading />
      </mesh>
      {/* Cross bar */}
      <mesh position={[0, -0.3, 0.1]}>
        <boxGeometry args={[0.55, 0.04, 0.04]} />
        <meshStandardMaterial color="#aa7744" flatShading />
      </mesh>
      {/* Shelf */}
      <mesh position={[0, -0.1, 0.14]}>
        <boxGeometry args={[0.5, 0.03, 0.08]} />
        <meshStandardMaterial color="#997744" flatShading />
      </mesh>
      {/* Canvas */}
      <mesh position={[0, 0.25, 0.12]}>
        <boxGeometry args={[0.55, 0.65, 0.03]} />
        <meshStandardMaterial color="#fffff0" flatShading />
      </mesh>
      {/* Painting on canvas - abstract art */}
      <mesh position={[-0.1, 0.3, 0.14]}>
        <circleGeometry args={[0.12, 8]} />
        <meshStandardMaterial color="#ff4466" />
      </mesh>
      <mesh position={[0.1, 0.15, 0.14]}>
        <circleGeometry args={[0.08, 6]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>
      <mesh position={[0, 0.4, 0.14]}>
        <circleGeometry args={[0.06, 5]} />
        <meshStandardMaterial color="#ffcc44" />
      </mesh>
    </group>
  );
}
