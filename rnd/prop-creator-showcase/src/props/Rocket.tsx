import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Rocket() {
  const groupRef = useRef<THREE.Group>(null);
  const flameRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.01;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
    if (flameRef.current) {
      const s = 0.8 + Math.sin(state.clock.elapsedTime * 15) * 0.2;
      flameRef.current.scale.set(1, s, 1);
    }
  });

  return (
    <group ref={groupRef} rotation={[0, 0, 0.15]}>
      {/* Body */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.8, 8]} />
        <meshStandardMaterial color="#eeeeee" flatShading />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 0.65, 0]}>
        <coneGeometry args={[0.18, 0.4, 8]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {/* Window */}
      <mesh position={[0, 0.3, 0.19]}>
        <circleGeometry args={[0.07, 8]} />
        <meshStandardMaterial color="#44ccff" emissive="#2288cc" emissiveIntensity={0.5} />
      </mesh>
      {/* Window frame */}
      <mesh position={[0, 0.3, 0.185]}>
        <torusGeometry args={[0.08, 0.015, 6, 8]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Fins */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`item-${i}`}
            position={[Math.cos(angle) * 0.22, -0.35, Math.sin(angle) * 0.22]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.02, 0.3, 0.15]} />
            <meshStandardMaterial color="#ff6644" flatShading />
          </mesh>
        );
      })}
      {/* Engine bell */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.15, 0.22, 0.12, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Flame */}
      <group ref={flameRef} position={[0, -0.55, 0]}>
        <mesh>
          <coneGeometry args={[0.12, 0.35, 6]} />
          <meshStandardMaterial color="#ff8800" emissive="#ff4400" emissiveIntensity={2} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <coneGeometry args={[0.07, 0.25, 6]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={3} transparent opacity={0.9} />
        </mesh>
      </group>
      {/* Stripe */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.06, 8]} />
        <meshStandardMaterial color="#ff4444" />
      </mesh>
    </group>
  );
}
