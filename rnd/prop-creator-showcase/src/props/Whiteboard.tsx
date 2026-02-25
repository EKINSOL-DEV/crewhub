import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const STICKY_NOTES = [
  { x: -0.35, y: 0.25, color: '#ffee44', text: 'TODO' },
  { x: 0.1, y: 0.3, color: '#ff8844', text: 'SHIP IT' },
  { x: 0.45, y: 0.15, color: '#44ddff', text: 'v2.0' },
  { x: -0.2, y: -0.1, color: '#88ff66', text: 'DONE ✓' },
  { x: 0.3, y: -0.15, color: '#ff66aa', text: 'BUG?' },
];

export function Whiteboard() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Board frame */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.5, 1.1, 0.05]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* White surface */}
      <mesh position={[0, 0.05, 0.026]}>
        <boxGeometry args={[1.4, 1.0, 0.01]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>
      {/* Sticky notes */}
      {STICKY_NOTES.map((note, i) => (
        <group key={`note-${i}`} position={[note.x, note.y, 0.04]} rotation={[0, 0, (Math.random() - 0.5) * 0.15]}>
          <mesh>
            <boxGeometry args={[0.22, 0.18, 0.005]} />
            <meshStandardMaterial color={note.color} />
          </mesh>
          <Text position={[0, 0, 0.004]} fontSize={0.04} color="#333333">
            {note.text}
          </Text>
        </group>
      ))}
      {/* Sketch lines (simple drawing) */}
      {/* Arrow */}
      <mesh position={[-0.05, -0.3, 0.035]}>
        <boxGeometry args={[0.4, 0.015, 0.002]} />
        <meshStandardMaterial color="#3344aa" />
      </mesh>
      <mesh position={[0.15, -0.27, 0.035]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.08, 0.015, 0.002]} />
        <meshStandardMaterial color="#3344aa" />
      </mesh>
      {/* Marker tray */}
      <mesh position={[0, -0.55, 0.05]}>
        <boxGeometry args={[0.6, 0.04, 0.06]} />
        <meshStandardMaterial color="#666677" />
      </mesh>
      {/* Markers */}
      {['#ff3333', '#3366ff', '#33aa33'].map((c, i) => (
        <mesh key={`c-${i}`} position={[-0.15 + i * 0.12, -0.53, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}
