import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function SpaceHeater() {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1;
    if (glowRef.current) { const i = 1.5 + Math.sin(s.clock.elapsedTime * 3) * 0.5; (glowRef.current.material as any).emissiveIntensity = i; }
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.3, 0.4, 0.12]} />
        <meshStandardMaterial color="#ff6644" flatShading />
      </mesh>
      <mesh ref={glowRef} position={[0, 0, 0.07]}>
        <boxGeometry args={[0.22, 0.25, 0.01]} />
        <meshStandardMaterial color="#ff4422" emissive="#ff4422" emissiveIntensity={1.5} flatShading />
      </mesh>
      {[...Array(5)].map((_,i) => (
        <mesh key={`item-${i}`} position={[0, -0.1+i*0.06, 0.07]}>
          <boxGeometry args={[0.25, 0.008, 0.005]} />
          <meshStandardMaterial color="#cc4422" flatShading />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x,i) => (
        <mesh key={`item-${i}`} position={[x, -0.27, 0]}>
          <boxGeometry args={[0.04, 0.02, 0.14]} />
          <meshStandardMaterial color="#444455" flatShading />
        </mesh>
      ))}

    </group>
  );
}
