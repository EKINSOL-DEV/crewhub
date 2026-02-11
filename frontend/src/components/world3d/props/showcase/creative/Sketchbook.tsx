import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Sketchbook() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15; });
  return (
    <group ref={groupRef}>
      {/* Cover */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.55, 0.05, 0.7]} />
        <meshStandardMaterial color="#884422" flatShading />
      </mesh>
      {/* Pages */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.65]} />
        <meshStandardMaterial color="#fffff0" />
      </mesh>
      {/* Open page */}
      <mesh position={[0.28, -0.2, 0]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.5, 0.005, 0.65]} />
        <meshStandardMaterial color="#fffff5" />
      </mesh>
      {/* Sketches on page */}
      <mesh position={[0.3, -0.19, -0.1]} rotation={[0, 0, 0.4]}>
        <circleGeometry args={[0.08, 12]} />
        <meshStandardMaterial color="#333333" wireframe />
      </mesh>
      <mesh position={[0.25, -0.19, 0.1]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.1, 0.001, 0.12]} />
        <meshStandardMaterial color="#666666" wireframe />
      </mesh>
      {/* Spiral binding */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-0.26, -0.28, -0.28 + i * 0.08]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.025, 0.005, 4, 8, Math.PI]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      ))}
      {/* Pencil */}
      <mesh position={[0.1, -0.25, 0.3]} rotation={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 6]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0.2, -0.25, 0.35]} rotation={[0, 0.5, 0]}>
        <coneGeometry args={[0.015, 0.04, 6]} />
        <meshStandardMaterial color="#ddb088" />
      </mesh>
    </group>
  );
}
