import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PenTablet() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  return (
    <group ref={groupRef}>
      {/* Tablet body */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.9, 0.04, 0.6]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Active area */}
      <mesh position={[0.05, -0.325, 0]}>
        <boxGeometry args={[0.65, 0.01, 0.45]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      {/* Express keys */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={`item-${i}`} position={[-0.38, -0.32, 0.1 - i * 0.08]}>
          <boxGeometry args={[0.06, 0.02, 0.06]} />
          <meshStandardMaterial color="#3a3a4e" />
        </mesh>
      ))}
      {/* Touch ring */}
      <mesh position={[-0.38, -0.32, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.04, 0.01, 6, 12]} />
        <meshStandardMaterial color="#4a4a5e" />
      </mesh>
      {/* Stylus */}
      <mesh position={[0.2, -0.2, 0.2]} rotation={[0.3, 0.2, -0.8]}>
        <cylinderGeometry args={[0.015, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Stylus tip */}
      <mesh position={[0.38, -0.32, 0.35]} rotation={[0.3, 0.2, -0.8]}>
        <coneGeometry args={[0.015, 0.04, 4]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
      {/* Stylus button */}
      <mesh position={[0.25, -0.18, 0.24]} rotation={[0.3, 0.2, -0.8]}>
        <boxGeometry args={[0.02, 0.015, 0.06]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* LED indicator */}
      <mesh position={[0.05, -0.32, 0.3]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#00aaff" emissive="#00aaff" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}
