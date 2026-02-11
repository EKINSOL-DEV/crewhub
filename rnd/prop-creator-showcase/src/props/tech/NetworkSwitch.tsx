import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function NetworkSwitch() {
  const groupRef = useRef<THREE.Group>(null);
  const ledsRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.25) * 0.08;
    if (ledsRef.current) ledsRef.current.children.forEach((led, i) => {
      ((led as THREE.Mesh).material as any).emissiveIntensity = Math.sin(s.clock.elapsedTime * 3 + i * 0.5) > 0 ? 2 : 0.2;
    });
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.45, 0.04, 0.15]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {[...Array(8)].map((_,i) => (
        <mesh key={i} position={[-0.16+i*0.046, -0.22, 0.076]}><boxGeometry args={[0.025, 0.02, 0.005]} /><meshStandardMaterial color="#444455" flatShading /></mesh>
      ))}
      <group ref={ledsRef}>
        {[...Array(8)].map((_,i) => (
          <mesh key={i} position={[-0.16+i*0.046, -0.195, 0.076]}><sphereGeometry args={[0.005, 4, 4]} /><meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1} /></mesh>
        ))}
      </group>
            <mesh position={[0.18, -0.22, 0.076]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={1} />
      </mesh>

    </group>
  );
}
