import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Centrifuge() {
  const groupRef = useRef<THREE.Group>(null);
  const rotorRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.05;
    if (rotorRef.current) rotorRef.current.rotation.y = s.clock.elapsedTime * 4;
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.15, 8]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
            <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 8]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <group ref={rotorRef} position={[0, -0.1, 0]}>
        {[0,1,2,3].map(i => (
          <mesh key={`item-${i}`} position={[Math.cos(i*Math.PI/2)*0.08, 0, Math.sin(i*Math.PI/2)*0.08]}>
            <cylinderGeometry args={[0.02, 0.015, 0.06, 4]} />
            <meshStandardMaterial color="#4488ff" flatShading />
          </mesh>
        ))}
      </group>
            <mesh position={[0, -0.05, 0.17]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1} />
      </mesh>

    </group>
  );
}
