import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function AIBrain() {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const pulseRef = useRef(0);

  const { nodePositions, connections } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 40; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 0.7 + Math.random() * 0.3;
      pts.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      ));
    }
    const conns: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i].distanceTo(pts[j]) < 0.7) {
          conns.push([pts[i], pts[j]]);
        }
      }
    }
    return { nodePositions: pts, connections: conns };
  }, []);

  const lineGeom = useMemo(() => {
    const positions: number[] = [];
    connections.forEach(([a, b]) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, [connections]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.008;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
    pulseRef.current = Math.sin(state.clock.elapsedTime * 2) * 0.5 + 0.5;
    if (nodesRef.current) {
      const dummy = new THREE.Object3D();
      const s = 0.03 + pulseRef.current * 0.02;
      nodePositions.forEach((pos, i) => {
        dummy.position.copy(pos);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        nodesRef.current!.setMatrixAt(i, dummy.matrix);
      });
      nodesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color="#00ffff" emissive="#00aaff" emissiveIntensity={0.8} transparent opacity={0.3} wireframe />
      </mesh>
      {/* Outer shell */}
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#0044ff" transparent opacity={0.08} wireframe />
      </mesh>
      {/* Neural nodes */}
      <instancedMesh ref={nodesRef} args={[undefined, undefined, nodePositions.length]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
      </instancedMesh>
      {/* Connections */}
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color="#00aaff" transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}
