import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GamingChair() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef} scale={0.7}>
      {/* Seat */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
        <meshStandardMaterial color="#1a1a2a" flatShading />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.4, -0.22]}>
        <boxGeometry args={[0.5, 0.9, 0.08]} />
        <meshStandardMaterial color="#1a1a2a" flatShading />
      </mesh>
      {/* Racing stripes */}
      <mesh position={[0, 0.4, -0.17]}>
        <boxGeometry args={[0.08, 0.7, 0.01]} />
        <meshStandardMaterial color="#ff2244" />
      </mesh>
      {[-0.18, 0.18].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, 0.4, -0.17]}>
          <boxGeometry args={[0.04, 0.7, 0.01]} />
          <meshStandardMaterial color="#ff2244" />
        </mesh>
      ))}
      {/* Headrest */}
      <mesh position={[0, 0.85, -0.2]}>
        <boxGeometry args={[0.25, 0.12, 0.1]} />
        <meshStandardMaterial color="#222233" />
      </mesh>
      {/* Armrests */}
      {[-0.28, 0.28].map((x, i) => (
        <group key={`x-${i}`}>
          <mesh position={[x, 0.05, -0.05]}>
            <boxGeometry args={[0.05, 0.2, 0.05]} />
            <meshStandardMaterial color="#333344" />
          </mesh>
          <mesh position={[x, 0.16, 0]}>
            <boxGeometry args={[0.06, 0.03, 0.2]} />
            <meshStandardMaterial color="#444455" />
          </mesh>
        </group>
      ))}
      {/* Gas lift */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Base star */}
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={`item-${i}`} position={[Math.sin(a) * 0.2, -0.5, Math.cos(a) * 0.2]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.04, 0.03, 0.35]} />
            <meshStandardMaterial color="#333344" />
          </mesh>
        );
      })}
      {/* Wheels */}
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={`item-${i}`} position={[Math.sin(a) * 0.35, -0.55, Math.cos(a) * 0.35]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
        );
      })}
    </group>
  );
}
