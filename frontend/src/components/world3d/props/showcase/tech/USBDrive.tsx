import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function USBDrive() {
  const groupRef = useRef<THREE.Group>(null);
  const ledRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.5;
    if (ledRef.current) (ledRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(s.clock.elapsedTime * 6) > 0 ? 3 : 0.2;
  });
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.5]} />
        <meshStandardMaterial color="#2244aa" flatShading />
      </mesh>
      {/* Metal connector */}
      <mesh position={[0, 0, 0.32]}>
        <boxGeometry args={[0.12, 0.04, 0.15]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Cap */}
      <mesh position={[0, 0, -0.3]}>
        <boxGeometry args={[0.22, 0.09, 0.1]} />
        <meshStandardMaterial color="#1a3388" flatShading />
      </mesh>
      {/* LED */}
      <mesh ref={ledRef} position={[0, 0.045, 0.15]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#00aaff" emissive="#00aaff" emissiveIntensity={2} />
      </mesh>
      {/* Keyring hole */}
      <mesh position={[0, 0, -0.38]}>
        <torusGeometry args={[0.04, 0.01, 4, 8]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
    </group>
  );
}
