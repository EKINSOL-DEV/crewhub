import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ColorWheel() {
  const wheelRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1;
    if (wheelRef.current) wheelRef.current.rotation.z += 0.005;
  });
  const colors = ['#ff0000', '#ff8800', '#ffff00', '#88ff00', '#00ff00', '#00ff88', '#00ffff', '#0088ff', '#0000ff', '#8800ff', '#ff00ff', '#ff0088'];
  return (
    <group ref={groupRef}>
      {/* Wheel segments */}
      <group ref={wheelRef} position={[0, 0, 0]}>
        {colors.map((c, i) => {
          const a = (i / colors.length) * Math.PI * 2;
          const na = ((i + 1) / colors.length) * Math.PI * 2;
          const mid = (a + na) / 2;
          return (
            <mesh key={`c-${i}`} position={[Math.cos(mid) * 0.3, Math.sin(mid) * 0.3, 0]}>
              <boxGeometry args={[0.18, 0.18, 0.04]} />
              <meshStandardMaterial color={c} flatShading />
            </mesh>
          );
        })}
      </group>
      {/* Center circle */}
      <mesh position={[0, 0, 0.03]}>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {/* Outer ring */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.5, 0.02, 6, 24]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Stand */}
      <mesh position={[0, -0.55, -0.05]}>
        <boxGeometry args={[0.08, 0.2, 0.08]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      <mesh position={[0, -0.65, -0.05]}>
        <boxGeometry args={[0.3, 0.03, 0.2]} />
        <meshStandardMaterial color="#555566" flatShading />
      </mesh>
    </group>
  );
}
