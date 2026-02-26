import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Bookshelf() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => { if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12; });
  const bookColors = ['#cc3333', '#3355aa', '#44aa44', '#dd8833', '#8844aa', '#33aaaa', '#dd4488', '#6644cc'];
  return (
    <group ref={groupRef}>
      {/* Frame */}
      <mesh position={[0, 0, 0]}><boxGeometry args={[1, 1.3, 0.35]} /><meshStandardMaterial color="#8B6914" flatShading /></mesh>
      {/* Shelves */}
      {[0.45, 0.05, -0.35].map((y, i) => (
        <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.95, 0.04, 0.33]} /><meshStandardMaterial color="#9B7924" flatShading /></mesh>
      ))}
      {/* Books row 1 */}
      {bookColors.slice(0, 4).map((c, i) => (
        <mesh key={y} position={[-0.3 + i * 0.18, 0.28, 0]}>
          <boxGeometry args={[0.12, 0.3 + (i % 2) * 0.05, 0.22]} />
          <meshStandardMaterial color={c} flatShading />
        </mesh>
      ))}
      {/* Books row 2 */}
      {bookColors.slice(4).map((c, i) => (
        <mesh key={`c-${i}`} position={[-0.3 + i * 0.2, -0.12, 0]}>
          <boxGeometry args={[0.14, 0.28 + (i % 2) * 0.04, 0.22]} />
          <meshStandardMaterial color={c} flatShading />
        </mesh>
      ))}
      {/* Small plant on top */}
      <mesh position={[0.3, 0.7, 0]}><cylinderGeometry args={[0.06, 0.05, 0.08, 6]} /><meshStandardMaterial color="#cc6633" flatShading /></mesh>
      <mesh position={[0.3, 0.78, 0]}><sphereGeometry args={[0.08, 5, 5]} /><meshStandardMaterial color="#44bb44" flatShading /></mesh>
    </group>
  );
}
