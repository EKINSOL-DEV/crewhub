import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PaintPalette() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3; });
  const colors = ['#ff2244', '#ff8833', '#ffee33', '#33cc44', '#3366ff', '#8833cc', '#ffffff', '#111111'];
  return (
    <group ref={groupRef}>
      {/* Palette shape (oval) */}
      <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.45, 0.04, 12]} />
        <meshStandardMaterial color="#cc9955" flatShading />
      </mesh>
      {/* Thumb hole */}
      <mesh position={[0.2, -0.2, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 8]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      {/* Paint blobs */}
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 1.5 - 0.5;
        const r = 0.3;
        return (
          <mesh key={i} position={[Math.cos(a) * r, -0.17, Math.sin(a) * r]}>
            <sphereGeometry args={[0.04 + (i % 3) * 0.01, 5, 5]} />
            <meshStandardMaterial color={c} flatShading />
          </mesh>
        );
      })}
      {/* Mixed paint in center */}
      <mesh position={[-0.05, -0.17, 0.05]}>
        <sphereGeometry args={[0.06, 5, 5]} />
        <meshStandardMaterial color="#aa6644" flatShading />
      </mesh>
    </group>
  );
}
