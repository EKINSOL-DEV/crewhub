import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LogicAnalyzer() {
  const groupRef = useRef<THREE.Group>(null);
  const ledsRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.08;
    if (ledsRef.current) ledsRef.current.children.forEach((led, i) => {
      ((led as THREE.Mesh).material as any).emissiveIntensity = Math.sin(s.clock.elapsedTime * 5 + i * 0.7) > 0 ? 2 : 0.1;
    });
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.3, 0.06, 0.12]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      <group ref={ledsRef}>
        {Array.from({length: 8}).map((_,i) => (
          <mesh key={JSON.stringify(_)} position={[-0.1+i*0.03, -0.165, 0.06]}><sphereGeometry args={[0.005, 4, 4]} /><meshStandardMaterial color="#44ffaa" emissive="#44ffaa" emissiveIntensity={1} /></mesh>
        ))}
      </group>
      {Array.from({length: 8}).map((_,i) => (
        <mesh key={JSON.stringify(_)} position={[-0.1+i*0.03, -0.2, 0.065]}><boxGeometry args={[0.015, 0.015, 0.005]} /><meshStandardMaterial color="#333355" flatShading /></mesh>
      ))}

    </group>
  );
}
