import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Dice() {
  const d1Ref = useRef<THREE.Mesh>(null);
  const d2Ref = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2;
    if (d1Ref.current) { d1Ref.current.rotation.x += 0.01; d1Ref.current.rotation.z += 0.005; }
    if (d2Ref.current) { d2Ref.current.rotation.y += 0.008; d2Ref.current.rotation.z += 0.012; }
  });
  const Dots = ({ face, pos, rot }: { face: number; pos: [number,number,number]; rot: [number,number,number] }) => (
    <group position={pos} rotation={rot}>
      {Array.from({ length: face }, (_, i) => {
        const positions: [number,number,number][] = [
          [0, 0, 0], [-0.04, 0.04, 0], [0.04, -0.04, 0], [-0.04, -0.04, 0], [0.04, 0.04, 0], [0, 0.04, 0]
        ];
        return (
          <mesh key={i} position={positions[i]}>
            <sphereGeometry args={[0.015, 4, 4]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        );
      })}
    </group>
  );
  return (
    <group ref={groupRef}>
      {/* Die 1 */}
      <mesh ref={d1Ref} position={[-0.15, -0.2, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#ff2244" flatShading />
      </mesh>
      {/* Die 2 */}
      <mesh ref={d2Ref} position={[0.18, -0.25, 0.05]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {/* D20 */}
      <mesh position={[0, 0.1, 0]}>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
      {/* Number on D20 */}
      <mesh position={[0, 0.15, 0.12]}>
        <boxGeometry args={[0.04, 0.05, 0.001]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
