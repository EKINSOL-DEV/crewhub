import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function InkBottles() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

      {[['#111122',-0.1],['#ff2244',0],['#4488ff',0.1]].map(([c,x],i) => (
        <group key={`item-${i}`} position={[x as number, -0.15, 0]}>
          <mesh><cylinderGeometry args={[0.04, 0.04, 0.12, 6]} /><meshStandardMaterial color={c as string} transparent opacity={0.6} flatShading /></mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.02, 0.025, 0.03, 6]} /><meshStandardMaterial color="#222222" flatShading /></mesh>
        </group>
      ))}

    </group>
  );
}
