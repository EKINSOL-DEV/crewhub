import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ThumbstickCaps() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3; });
  return (
    <group ref={groupRef}>

      {[['#ff4444',-0.08],['#4488ff',0],['#44ff44',0.08]].map(([c,x],i) => (
        <group key={`item-${i}`} position={[x as number, -0.2, 0]}>
          <mesh><cylinderGeometry args={[0.03, 0.025, 0.02, 8]} /><meshStandardMaterial color={c as string} flatShading /></mesh>
          <mesh position={[0, 0.015, 0]}><cylinderGeometry args={[0.028, 0.028, 0.005, 8]} /><meshStandardMaterial color={c as string} flatShading /></mesh>
        </group>
      ))}

    </group>
  );
}
