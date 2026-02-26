import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ServoMotors() {
  const groupRef = useRef<THREE.Group>(null);
  const hornRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15;
    if (hornRef.current) hornRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 1.5) * 1.2;
  });
  return (
    <group ref={groupRef}>

      {[0,1].map(i => (
        <group key={`item-${i}`} position={[-0.08+i*0.16, -0.18, 0]}>
          <mesh><boxGeometry args={[0.06, 0.05, 0.04]} /><meshStandardMaterial color={i===0?'#4488ff':'#222233'} flatShading /></mesh>
          <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.012, 0.012, 0.01, 6]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
        </group>
      ))}
      <mesh ref={hornRef} position={[0.08, -0.14, 0]}><boxGeometry args={[0.002, 0.04, 0.005]} /><meshStandardMaterial color="#ffffff" flatShading /></mesh>
      {Array.from({length: 3}).map((_,i) => (
        <mesh key={_} position={[-0.08, -0.22, -0.01+i*0.01]}><cylinderGeometry args={[0.003, 0.003, 0.08, 3]} /><meshStandardMaterial color={['#ff4444','#222222','#ffcc44'][i]} flatShading /></mesh>
      ))}

    </group>
  );
}
