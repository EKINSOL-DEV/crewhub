import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function MagnifyingGlass() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2; });
  return (
    <group ref={groupRef} rotation={[0, 0, -0.3]}>
      {/* Lens frame */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.25, 0.03, 8, 16]} />
        <meshStandardMaterial color="#cc8833" flatShading />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0.2, 0]}>
        <circleGeometry args={[0.24, 16]} />
        <meshStandardMaterial color="#aaccff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Lens glare */}
      <mesh position={[0.08, 0.28, 0.01]}>
        <circleGeometry args={[0.04, 6]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.035, 0.5, 8]} />
        <meshStandardMaterial color="#885522" flatShading />
      </mesh>
      {/* Handle end */}
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#774411" flatShading />
      </mesh>
      {/* Connection ring */}
      <mesh position={[0, -0.02, 0]}>
        <torusGeometry args={[0.04, 0.015, 6, 8]} />
        <meshStandardMaterial color="#cc8833" />
      </mesh>
    </group>
  );
}
