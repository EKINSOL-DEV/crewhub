import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PopFigure() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) { groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15; groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02; } });
  return (
    <group ref={groupRef}>

            <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#ffcc88" flatShading />
      </mesh>
            <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.1, 0.15, 0.06]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {[-0.07, 0.07].map((x,i) => (
        <mesh key={x} position={[x, -0.2, 0]}><cylinderGeometry args={[0.015, 0.015, 0.08, 4]} /><meshStandardMaterial color="#4488ff" flatShading /></mesh>
      ))}
      {[-0.03, 0.03].map((x,i) => (
        <mesh key={x} position={[x, 0.07, 0.09]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#222222" /></mesh>
      ))}
            <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.015, 6]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>

    </group>
  );
}
