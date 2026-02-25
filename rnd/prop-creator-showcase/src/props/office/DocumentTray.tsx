import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function DocumentTray() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

      {[0, 0.13].map((y,i) => (
        <group key={`y-${i}`} position={[0, -0.15+y, i*0.02]}>
          <mesh><boxGeometry args={[0.35, 0.02, 0.25]} /><meshStandardMaterial color={i===0 ? '#555566':'#666677'} flatShading /></mesh>
          <mesh position={[0, 0.04, -0.12]}><boxGeometry args={[0.35, 0.06, 0.01]} /><meshStandardMaterial color={i===0 ? '#555566':'#666677'} flatShading /></mesh>
          {[0,1,2].map(j => (
            <mesh key={j} position={[0, 0.015+j*0.003, 0]}><boxGeometry args={[0.3, 0.002, 0.2]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
          ))}
        </group>
      ))}

    </group>
  );
}
