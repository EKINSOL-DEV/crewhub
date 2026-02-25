import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GameCaseStorage() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.08, 0.35, 0.25]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      {[...new Array(5)].map((_,i) => (
        <mesh key={`item-${i}`} position={[0.042, -0.12+i*0.06, 0]}>
          <boxGeometry args={[0.002, 0.05, 0.2]} />
          <meshStandardMaterial color={['#4488ff','#ff4444','#44cc44','#ffcc44','#ff44ff'][i]} flatShading />
        </mesh>
      ))}

    </group>
  );
}
