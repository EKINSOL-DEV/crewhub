import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function LEDMatrixDisplay() {
  const groupRef = useRef<THREE.Group>(null);
  const dotsRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1;
    if (dotsRef.current) dotsRef.current.children.forEach((dot, i) => {
      const x = i % 8; const y = Math.floor(i / 8);
      const on = Math.sin(s.clock.elapsedTime * 2 + x * 0.5 + y * 0.3) > 0;
      ((dot as THREE.Mesh).material as any).emissiveIntensity = on ? 2 : 0.05;
    });
  });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.22, 0.22, 0.02]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      <group ref={dotsRef}>
        {[...new Array(64)].map((_,i) => {
          const x = (i % 8) - 3.5; const y = Math.floor(i / 8) - 3.5;
          return (
            <mesh key={`item-${i}`} position={[x*0.024, y*0.024-0.12, 0.012]}><sphereGeometry args={[0.006, 4, 4]} /><meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={0.5} /></mesh>
          );
        })}
      </group>

    </group>
  );
}
