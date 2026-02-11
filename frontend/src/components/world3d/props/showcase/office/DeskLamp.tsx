import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function DeskLamp() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.08, 8]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {/* Arm lower */}
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* Joint */}
      <mesh position={[0.06, 0.05, 0]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Arm upper */}
      <mesh position={[0.2, 0.35, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.03, 0.03, 0.55, 6]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* Shade */}
      <mesh position={[0.28, 0.6, 0]} rotation={[0, 0, 0.1]}>
        <coneGeometry args={[0.25, 0.2, 8, 1, true]} />
        <meshStandardMaterial color="#ffcc44" side={THREE.DoubleSide} flatShading />
      </mesh>
      {/* Bulb */}
      <mesh position={[0.28, 0.52, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#ffffdd" emissive="#ffeeaa" emissiveIntensity={3} />
      </mesh>
      {/* Light cone effect */}
      <pointLight position={[0.28, 0.5, 0]} intensity={0.8} color="#ffeeaa" distance={2} />
    </group>
  );
}
