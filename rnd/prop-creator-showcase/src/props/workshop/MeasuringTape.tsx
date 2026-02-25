import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function MeasuringTape() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2; });
  return (
    <group ref={groupRef}>
      {/* Housing */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.12]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      {/* Rounded edges */}
      <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.12, 12]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      {/* Lock button */}
      <mesh position={[0, -0.05, 0.07]}>
        <boxGeometry args={[0.08, 0.04, 0.02]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Tape coming out */}
      <mesh position={[0.2, -0.01, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.06]} />
        <meshStandardMaterial color="#ffee88" />
      </mesh>
      {/* Tape marks */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={`item-${i}`} position={[0.1 + i * 0.06, -0.01, 0.031]}>
          <boxGeometry args={[0.002, 0.015, 0.001]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}
      {/* Hook */}
      <mesh position={[0.36, -0.01, 0]}>
        <boxGeometry args={[0.02, 0.04, 0.08]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Belt clip */}
      <mesh position={[0, -0.15, -0.08]}>
        <boxGeometry args={[0.12, 0.15, 0.02]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </group>
  );
}
