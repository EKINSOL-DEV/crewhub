import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CalligraphyPens() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

      {[0,1,2].map(i => (
        <mesh key={i} position={[-0.05+i*0.05, -0.1, 0]} rotation={[0, 0, (i-1)*0.1]}>
          <cylinderGeometry args={[0.006, 0.008, 0.35, 6]} />
          <meshStandardMaterial color={['#222222','#884422','#666644'][i]} flatShading />
        </mesh>
      ))}
      {[0,1,2].map(i => (
        <mesh key={i} position={[-0.05+i*0.05, 0.08, 0]} rotation={[0, 0, (i-1)*0.1]}>
          <cylinderGeometry args={[0.001, 0.006, 0.04, 3]} />
          <meshStandardMaterial color={['#ccbb88','#ccbb88','#ccbb88'][i]} metalness={0.6} roughness={0.3} flatShading />
        </mesh>
      ))}

    </group>
  );
}
