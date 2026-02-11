import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Wrench() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.4; });
  return (
    <group ref={groupRef} rotation={[0, 0, -0.2]}>
      {/* Shaft */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.06, 0.7, 0.025]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
      {/* Open end jaw */}
      <mesh position={[-0.05, 0.35, 0]}>
        <boxGeometry args={[0.06, 0.08, 0.025]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
      <mesh position={[0.05, 0.35, 0]}>
        <boxGeometry args={[0.06, 0.08, 0.025]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
      {/* Box end */}
      <mesh position={[0, -0.38, 0]}>
        <torusGeometry args={[0.06, 0.025, 6, 8]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
      {/* Inner hex of box end */}
      <mesh position={[0, -0.38, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.03, 6]} />
        <meshStandardMaterial color="#777788" />
      </mesh>
    </group>
  );
}
