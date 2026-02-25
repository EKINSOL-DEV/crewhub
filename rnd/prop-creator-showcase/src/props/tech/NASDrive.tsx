import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function NASDrive() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.25, 0.3, 0.18]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
            <mesh position={[0, -0.05, 0.092]}>
        <boxGeometry args={[0.22, 0.12, 0.005]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {[0,1,2,3].map(i => (
        <mesh key={`item-${i}`} position={[-0.08+i*0.02, 0.1, 0.092]}><sphereGeometry args={[0.006, 4, 4]} /><meshStandardMaterial color={i<2?'#44ff44':'#ffcc44'} emissive={i<2?'#44ff44':'#ffcc44'} emissiveIntensity={1} /></mesh>
      ))}

    </group>
  );
}
