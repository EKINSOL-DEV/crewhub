import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function DeskFan() {
  const groupRef = useRef<THREE.Group>(null);
  const bladeRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.1;
    if (bladeRef.current) bladeRef.current.rotation.z = s.clock.elapsedTime * 8;
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.04, 8]} />
        <meshStandardMaterial color="#4488dd" flatShading />
      </mesh>
            <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
        <meshStandardMaterial color="#4488dd" flatShading />
      </mesh>
      <mesh position={[0, 0.1, 0]}><torusGeometry args={[0.2, 0.01, 6, 16]} /><meshStandardMaterial color="#aabbcc" flatShading /></mesh>
      <group ref={bladeRef} position={[0, 0.1, 0.02]}>
        {[0,1,2,3].map(i => (
          <mesh key={i} rotation={[0, 0, i*Math.PI/2]}>
            <boxGeometry args={[0.04, 0.16, 0.005]} />
            <meshStandardMaterial color="#ddeeff" transparent opacity={0.7} flatShading />
          </mesh>
        ))}
      </group>
            <mesh position={[0, 0.1, 0.03]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#4488dd" flatShading />
      </mesh>

    </group>
  );
}
