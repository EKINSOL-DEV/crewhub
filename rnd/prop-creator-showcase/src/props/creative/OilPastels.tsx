import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function OilPastels() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.12]} />
        <meshStandardMaterial color="#ddcc88" flatShading />
      </mesh>
      {['#ff2244','#ff8833','#ffee44','#44cc44','#4488ff','#8844ff','#ff44aa','#ffffff','#884422','#222222'].map((c,i) => (
        <mesh key={i} position={[-0.12+i*0.027, -0.16, 0]}><cylinderGeometry args={[0.008, 0.008, 0.06, 4]} /><meshStandardMaterial color={c} flatShading /></mesh>
      ))}

    </group>
  );
}
