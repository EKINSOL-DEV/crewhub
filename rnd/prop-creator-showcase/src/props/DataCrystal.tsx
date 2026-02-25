import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function DataCrystal() {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  const streamPositions = useMemo(() => {
    const streams: THREE.Vector3[][] = [];
    for (let s = 0; s < 6; s++) {
      const angle = (s / 6) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector3(
          Math.cos(angle) * (0.5 + t * 0.8),
          -0.8 + t * 1.6,
          Math.sin(angle) * (0.5 + t * 0.8)
        ));
      }
      streams.push(pts);
    }
    return streams;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.012;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.08;
    }
    if (innerRef.current) {
      const s = 0.95 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      innerRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main crystal */}
      <mesh>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#aa44ff" emissive="#6622cc" emissiveIntensity={0.5} transparent opacity={0.6} flatShading />
      </mesh>
      {/* Inner glow */}
      <mesh ref={innerRef}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#ff66ff" emissive="#ff44ff" emissiveIntensity={1.5} transparent opacity={0.8} />
      </mesh>
      {/* Data streams */}
      {streamPositions.map((pts, si) => {
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeom = new THREE.TubeGeometry(curve, 20, 0.01, 4, false);
        return (
          <mesh key={si} geometry={tubeGeom}>
            <meshStandardMaterial color="#cc88ff" emissive="#aa66ff" emissiveIntensity={1} transparent opacity={0.5} />
          </mesh>
        );
      })}
      {/* Floating data bits */}
      {[...new Array(8)].map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={`bit-${i}`} position={[Math.cos(a) * 1.1, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.1]}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshStandardMaterial color="#ff88ff" emissive="#ff88ff" emissiveIntensity={2} />
          </mesh>
        );
      })}
    </group>
  );
}
