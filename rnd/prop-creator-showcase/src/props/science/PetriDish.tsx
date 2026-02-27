import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function PetriDish() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15; });
  return (
    <group ref={groupRef}>
      {/* Bottom dish */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 16]} />
        <meshStandardMaterial color="#ddddee" transparent opacity={0.3} flatShading />
      </mesh>
      {/* Agar medium */}
      <mesh position={[0, -0.31, 0]}>
        <cylinderGeometry args={[0.37, 0.37, 0.03, 16]} />
        <meshStandardMaterial color="#ffeecc" transparent opacity={0.6} />
      </mesh>
      {/* Colonies */}
      {[
        [-0.1, 0.05, '#44aa44', 0.06],
        [0.12, -0.08, '#44aa44', 0.05],
        [-0.05, -0.15, '#ffffff', 0.04],
        [0.15, 0.12, '#ffcc44', 0.035],
        [-0.18, -0.05, '#ff8844', 0.03],
        [0.05, 0.15, '#44aa44', 0.045],
      ].map(([x, z, c, r], i) => (
        <mesh key={`colony-${x}-${z}-${String(c)}`} position={[x as number, -0.28, z as number]}>
          <cylinderGeometry args={[r as number, (r as number) * 1.1, 0.01, 8]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
      {/* Lid (offset) */}
      <mesh position={[0.05, -0.25, 0.05]}>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 16]} />
        <meshStandardMaterial color="#ccccdd" transparent opacity={0.15} />
      </mesh>
      {/* Label */}
      <mesh position={[0, -0.35, 0.38]}>
        <boxGeometry args={[0.15, 0.04, 0.005]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
