import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ControllerGrip() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.12]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {[-0.06, 0.06].map((x,i) => (
        <mesh key={`x-${i}`} position={[x, -0.2, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}><cylinderGeometry args={[0.025, 0.03, 0.12, 6]} /><meshStandardMaterial color="#444455" flatShading /></mesh>
      ))}
            <mesh position={[0, -0.12, 0.06]}>
        <cylinderGeometry args={[0.015, 0.015, 0.005, 8]} />
        <meshStandardMaterial color="#44ff44" flatShading />
      </mesh>
            <mesh position={[0.03, -0.12, 0.06]}>
        <boxGeometry args={[0.02, 0.02, 0.005]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>

    </group>
  );
}
