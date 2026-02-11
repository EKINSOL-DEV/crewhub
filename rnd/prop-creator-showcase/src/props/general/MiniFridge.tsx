import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function MiniFridge() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15; });
  return (
    <group ref={groupRef}>

            <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.3, 0.4, 0.25]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
            <mesh position={[0, -0.05, 0.13]}>
        <boxGeometry args={[0.28, 0.38, 0.01]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
            <mesh position={[0.12, -0.05, 0.145]}>
        <boxGeometry args={[0.015, 0.12, 0.015]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
            <mesh position={[0.1, 0.12, 0.14]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#44ccff" emissive="#44ccff" emissiveIntensity={1.5} />
      </mesh>
            <mesh position={[0, 0.1, 0.14]}>
        <boxGeometry args={[0.1, 0.03, 0.002]} />
        <meshStandardMaterial color="#4488cc" flatShading />
      </mesh>
      {[[-0.1,-0.1],[0.1,-0.1],[-0.1,0.1],[0.1,0.1]].map(([x,z],i) => (
        <mesh key={i} position={[x, -0.27, z]}>
          <cylinderGeometry args={[0.015, 0.015, 0.02, 4]} />
          <meshStandardMaterial color="#444455" flatShading />
        </mesh>
      ))}

    </group>
  );
}
