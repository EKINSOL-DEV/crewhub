import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PowerStrip() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15; });
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[1, 0.08, 0.18]} />
        <meshStandardMaterial color="#eeeeee" flatShading />
      </mesh>
      {/* Outlets */}
      {[-0.35, -0.15, 0.05, 0.25].map((x, i) => (
        <group key={i}>
          <mesh position={[x, -0.35, 0.09]}>
            <boxGeometry args={[0.12, 0.04, 0.01]} />
            <meshStandardMaterial color="#dddddd" />
          </mesh>
          {/* Socket holes */}
          <mesh position={[x - 0.02, -0.35, 0.095]}>
            <cylinderGeometry args={[0.008, 0.008, 0.01, 4]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          <mesh position={[x + 0.02, -0.35, 0.095]}>
            <cylinderGeometry args={[0.008, 0.008, 0.01, 4]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        </group>
      ))}
      {/* Power switch */}
      <mesh position={[0.42, -0.35, 0.09]}>
        <boxGeometry args={[0.06, 0.04, 0.02]} />
        <meshStandardMaterial color="#ff4444" />
      </mesh>
      {/* LED */}
      <mesh position={[0.42, -0.33, 0.095]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} />
      </mesh>
      {/* Cable */}
      <mesh position={[-0.52, -0.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 4]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  );
}
