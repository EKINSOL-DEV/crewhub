import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LitmusPaper() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.12, 0.22, 0.005]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {Array.from({length: 5}).map((_,i) => (
        <mesh key={`item-${i}`} position={[0, -0.06+i*0.04, 0.004]}>
          <boxGeometry args={[0.08, 0.03, 0.002]} />
          <meshStandardMaterial color={['#ff2222','#ff8844','#ffff44','#44cc44','#4444ff'][i]} flatShading />
        </mesh>
      ))}

    </group>
  );
}
