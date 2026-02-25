import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function USBHub() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.08]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {[...new Array(4)].map((_,i) => (
        <mesh key={`item-${i}`} position={[-0.1+i*0.07, -0.22, 0.045]}>
          <boxGeometry args={[0.03, 0.015, 0.01]} />
          <meshStandardMaterial color="#4488ff" flatShading />
        </mesh>
      ))}
            <mesh position={[0.12, -0.195, 0.04]}>
        <sphereGeometry args={[0.008, 4, 4]} />
        <meshStandardMaterial color="#44ff88" emissive="#44ff88" emissiveIntensity={2} />
      </mesh>
            <mesh position={[-0.18, -0.22, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 4]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>

    </group>
  );
}
