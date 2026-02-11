import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Hourglass() {
  const groupRef = useRef<THREE.Group>(null);
  const sandTopRef = useRef<THREE.Mesh>(null);
  const sandBottomRef = useRef<THREE.Mesh>(null);

  const sandParticles = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      offset: i * 0.15,
      x: (Math.random() - 0.5) * 0.03,
      z: (Math.random() - 0.5) * 0.03,
    }));
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
    }
    const t = (state.clock.elapsedTime * 0.15) % 1;
    if (sandTopRef.current) {
      sandTopRef.current.scale.set(1, Math.max(0.1, 1 - t), 1);
      sandTopRef.current.position.y = 0.2 + (1 - t) * 0.15;
    }
    if (sandBottomRef.current) {
      sandBottomRef.current.scale.set(1, Math.max(0.1, t), 1);
      sandBottomRef.current.position.y = -0.5 + t * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Top frame */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 6]} />
        <meshStandardMaterial color="#ccaa44" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Bottom frame */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 6]} />
        <meshStandardMaterial color="#ccaa44" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Glass top bulb */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.35, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#aaddff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Glass bottom bulb */}
      <mesh position={[0, -0.35, 0]}>
        <sphereGeometry args={[0.35, 8, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#aaddff" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.15, 8]} />
        <meshStandardMaterial color="#aaddff" transparent opacity={0.15} />
      </mesh>
      {/* Sand top */}
      <mesh ref={sandTopRef} position={[0, 0.3, 0]}>
        <coneGeometry args={[0.25, 0.35, 6]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ff8800" emissiveIntensity={0.3} flatShading />
      </mesh>
      {/* Sand bottom */}
      <mesh ref={sandBottomRef} position={[0, -0.5, 0]}>
        <coneGeometry args={[0.25, 0.3, 6]} />
        <meshStandardMaterial color="#ffcc44" emissive="#ff8800" emissiveIntensity={0.3} flatShading />
      </mesh>
      {/* Falling sand stream */}
      {sandParticles.map((p, i) => (
        <mesh key={i} position={[p.x, -0.05 - i * 0.02, p.z]}>
          <sphereGeometry args={[0.008, 4, 4]} />
          <meshStandardMaterial color="#ffdd66" emissive="#ffaa22" emissiveIntensity={1} />
        </mesh>
      ))}
      {/* Corner pillars */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const r = 0.3;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <cylinderGeometry args={[0.025, 0.025, 1.35, 4]} />
            <meshStandardMaterial color="#ccaa44" metalness={0.6} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}
