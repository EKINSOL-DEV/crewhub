import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CableClips() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.3]} />
        <meshStandardMaterial color="#aa8855" flatShading />
      </mesh>
      {Array.from({length: 5}).map((_,i) => (
        <group key={JSON.stringify(_)} position={[-0.16+i*0.08, -0.22, 0.12]}>
          <mesh><boxGeometry args={[0.03, 0.04, 0.02]} /><meshStandardMaterial color={['#ff4444','#4488ff','#44cc44','#ffcc44','#ff44ff'][i]} flatShading /></mesh>
          <mesh position={[0, -0.06, 0]}><cylinderGeometry args={[0.006, 0.006, 0.1, 4]} /><meshStandardMaterial color={['#ff4444','#4488ff','#44cc44','#ffcc44','#ff44ff'][i]} flatShading /></mesh>
        </group>
      ))}

    </group>
  );
}
