import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function WoodPlanks() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef}>
      {/* Planks stacked */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={`item-${i}`} position={[i * 0.02 - 0.04, -0.4 + i * 0.06, i * 0.01]}>
          <boxGeometry args={[0.8, 0.04, 0.15]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#bb8844' : '#aa7733'} flatShading />
        </mesh>
      ))}
      {/* Cross plank */}
      <mesh position={[0, -0.15, 0.1]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.04, 0.12]} />
        <meshStandardMaterial color="#cc9955" flatShading />
      </mesh>
      {/* Sawdust pile */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={`item-${i}`} position={[(Math.random() - 0.5) * 0.3, -0.45, (Math.random() - 0.5) * 0.2 + 0.15]}>
          <sphereGeometry args={[0.01 + Math.random() * 0.015, 3, 3]} />
          <meshStandardMaterial color="#ddaa66" flatShading />
        </mesh>
      ))}
      {/* Wood grain lines */}
      {[0, 2, 4].map(i => (
        <mesh key={`item-${i}`} position={[0, -0.37 + i * 0.06, 0.076]}>
          <boxGeometry args={[0.6, 0.005, 0.001]} />
          <meshStandardMaterial color="#996633" />
        </mesh>
      ))}
    </group>
  );
}
