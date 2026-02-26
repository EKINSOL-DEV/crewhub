import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Oscilloscope() {
  const groupRef = useRef<THREE.Group>(null);
  const traceRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.08;
    if (traceRef.current) traceRef.current.position.x = Math.sin(s.clock.elapsedTime * 2) * 0.02;
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.4, 0.3, 0.15]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <mesh position={[-0.05, 0, 0.08]}><boxGeometry args={[0.22, 0.18, 0.005]} /><meshStandardMaterial color="#112211" /></mesh>
      {Array.from({length: 4}).map((_,i) => (
        <mesh key={JSON.stringify(_)} position={[-0.05, -0.06+i*0.04, 0.083]}><boxGeometry args={[0.2, 0.001, 0.001]} /><meshStandardMaterial color="#224422" /></mesh>
      ))}
      <mesh ref={traceRef} position={[-0.05, 0, 0.084]}><boxGeometry args={[0.18, 0.003, 0.001]} /><meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={2} /></mesh>
      {[0,1,2].map(i => (
        <mesh key={`item-${i}`} position={[0.14, 0.05-i*0.06, 0.08]}><cylinderGeometry args={[0.015, 0.015, 0.01, 8]} /><meshStandardMaterial color={['#ff4444','#4488ff','#ffcc44'][i]} flatShading /></mesh>
      ))}

    </group>
  );
}
