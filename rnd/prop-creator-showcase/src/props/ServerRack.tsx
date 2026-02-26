import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ServerRack() {
  const groupRef = useRef<THREE.Group>(null);
  const ledsRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
    if (ledsRef.current) {
      ledsRef.current.children.forEach((led, i) => {
        const mat = (led as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const blink = Math.sin(state.clock.elapsedTime * (3 + i * 1.7) + i * 2) > 0;
        mat.emissiveIntensity = blink ? 3 : 0.2;
      });
    }
  });

  const servers = [0.5, 0.2, -0.1, -0.4];

  return (
    <group ref={groupRef}>
      {/* Rack frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.9, 1.4, 0.5]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      {/* Server units */}
      {servers.map((y, i) => (
        <group key={`y-${i}`}>
          <mesh position={[0, y, 0.05]}>
            <boxGeometry args={[0.8, 0.22, 0.45]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#2a2a3e' : '#252538'} />
          </mesh>
          {/* Ventilation lines */}
          {[-0.15, 0, 0.15].map((x, j) => (
            <mesh key={x} position={[x, y, 0.276]}>
              <boxGeometry args={[0.08, 0.12, 0.001]} />
              <meshStandardMaterial color="#1a1a28" />
            </mesh>
          ))}
        </group>
      ))}
      {/* LEDs */}
      <group ref={ledsRef}>
        {servers.flatMap((y, si) =>
          [0, 1, 2, 3].map(li => (
            <mesh key={`${si}-${li}`} position={[0.28 + li * 0.04, y + 0.07, 0.276]}>
              <sphereGeometry args={[0.012, 4, 4]} />
              <meshStandardMaterial
                color={li < 2 ? '#00ff44' : '#ff8800'}
                emissive={li < 2 ? '#00ff44' : '#ff8800'}
                emissiveIntensity={2}
              />
            </mesh>
          ))
        )}
      </group>
      {/* Top vent */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.85, 0.02, 0.45]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Cables on side */}
      {[0, 1, 2].map(i => (
        <mesh key={`item-${i}`} position={[0.46, 0.2 - i * 0.3, 0.1]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 4]} />
          <meshStandardMaterial color={['#ff4444', '#44ff44', '#4488ff'][i]} />
        </mesh>
      ))}
    </group>
  );
}
