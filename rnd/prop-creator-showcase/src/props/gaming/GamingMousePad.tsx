import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GamingMousePad() {
  const groupRef = useRef<THREE.Group>(null);
  const rgbRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12;
    if (rgbRef.current) {
      const hue = (s.clock.elapsedTime * 0.2) % 1;
      const c = new THREE.Color().setHSL(hue, 1, 0.5);
      (rgbRef.current.material as THREE.MeshStandardMaterial).color.copy(c);
      (rgbRef.current.material as THREE.MeshStandardMaterial).emissive.copy(c);
    }
  });
  return (
    <group ref={groupRef}>
      {/* Pad */}
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[1, 0.02, 0.5]} />
        <meshStandardMaterial color="#1a1a2a" flatShading />
      </mesh>
      {/* Surface texture */}
      <mesh position={[0, -0.435, 0]}>
        <boxGeometry args={[0.95, 0.005, 0.45]} />
        <meshStandardMaterial color="#222244" />
      </mesh>
      {/* RGB edge strip */}
      <mesh ref={rgbRef} position={[0, -0.44, 0]}>
        <boxGeometry args={[1.02, 0.01, 0.52]} />
        <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={2} />
      </mesh>
      {/* Logo */}
      <mesh position={[0.3, -0.43, 0.15]}>
        <boxGeometry args={[0.08, 0.005, 0.04]} />
        <meshStandardMaterial color="#444466" />
      </mesh>
      {/* Mouse on pad */}
      <mesh position={[0.2, -0.38, 0]}>
        <boxGeometry args={[0.12, 0.05, 0.2]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {/* Mouse buttons */}
      <mesh position={[0.18, -0.35, -0.05]}>
        <boxGeometry args={[0.04, 0.01, 0.08]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      <mesh position={[0.22, -0.35, -0.05]}>
        <boxGeometry args={[0.04, 0.01, 0.08]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      {/* Scroll wheel */}
      <mesh position={[0.2, -0.34, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.02, 6]} />
        <meshStandardMaterial color="#666677" />
      </mesh>
    </group>
  );
}
