import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CoolingFan() {
  const groupRef = useRef<THREE.Group>(null);
  const bladeRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.05;
    if (bladeRef.current) bladeRef.current.rotation.z = s.clock.elapsedTime * 12;
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.25, 0.25, 0.03]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      <group ref={bladeRef} position={[0, -0.1, 0.02]}>
        {[0,1,2,3,4,5,6].map(i => (
          <mesh key={`item-${i}`} rotation={[0, 0, i*Math.PI*2/7]}><boxGeometry args={[0.02, 0.1, 0.003]} /><meshStandardMaterial color="#555577" transparent opacity={0.8} flatShading /></mesh>
        ))}
      </group>
            <mesh position={[0, -0.1, 0.02]}>
        <cylinderGeometry args={[0.02, 0.02, 0.01, 6]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>

    </group>
  );
}
