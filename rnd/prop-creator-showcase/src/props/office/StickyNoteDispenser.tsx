import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function StickyNoteDispenser() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      {[0,1,2,3,4].map(i => (
        <mesh key={`item-${i}`} position={[0, -0.06+i*0.005, 0.076]}><boxGeometry args={[0.12, 0.002, 0.002]} /><meshStandardMaterial color="#ffee44" flatShading /></mesh>
      ))}
            <mesh position={[0, -0.02, 0.1]}>
        <boxGeometry args={[0.1, 0.06, 0.002]} />
        <meshStandardMaterial color="#ffee44" flatShading />
      </mesh>

    </group>
  );
}
