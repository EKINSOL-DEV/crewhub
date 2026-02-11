import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function RingLight() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1; });
  return (
    <group ref={groupRef}>
      {/* Ring */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.4, 0.04, 8, 24]} />
        <meshStandardMaterial color="#ffffee" emissive="#ffffdd" emissiveIntensity={2} />
      </mesh>
      {/* Inner ring */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.35, 0.02, 6, 24]} />
        <meshStandardMaterial color="#ddddcc" />
      </mesh>
      {/* Stand pole */}
      <mesh position={[0, -0.35, -0.1]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 6]} />
        <meshStandardMaterial color="#222233" />
      </mesh>
      {/* Stand base (tripod) */}
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.2, -0.75, -0.1 + Math.cos(a) * 0.2]} rotation={[Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]}>
            <cylinderGeometry args={[0.015, 0.02, 0.3, 4]} />
            <meshStandardMaterial color="#333344" />
          </mesh>
        );
      })}
      {/* Phone holder */}
      <mesh position={[0, 0.2, 0.02]}>
        <boxGeometry args={[0.08, 0.15, 0.02]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Phone */}
      <mesh position={[0, 0.2, 0.04]}>
        <boxGeometry args={[0.06, 0.12, 0.008]} />
        <meshStandardMaterial color="#111122" />
      </mesh>
      <mesh position={[0, 0.2, 0.046]}>
        <planeGeometry args={[0.05, 0.1]} />
        <meshStandardMaterial color="#2244aa" emissive="#1133aa" emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 0.2, 0.3]} intensity={0.5} color="#ffffdd" distance={2} />
    </group>
  );
}
