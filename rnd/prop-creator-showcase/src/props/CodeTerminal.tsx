import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const CODE_LINES = [
  'const bot = new CrewBot();',
  'bot.think("hello world");',
  'await bot.execute(task);',
  'if (bot.happy) dance();',
  'return { success: true };',
  'bot.learn(new Skill());',
  'console.log("✨ done!");',
  'export default bot;',
];

export function CodeTerminal() {
  const groupRef = useRef<THREE.Group>(null);
  const scrollRef = useRef(0);
  const textGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
    scrollRef.current = (state.clock.elapsedTime * 0.3) % CODE_LINES.length;
    if (textGroupRef.current) {
      textGroupRef.current.position.y = (scrollRef.current % 1) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Monitor body */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.4, 1, 0.15]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Screen bezel */}
      <mesh position={[0, 0.1, 0.076]}>
        <boxGeometry args={[1.25, 0.85, 0.01]} />
        <meshStandardMaterial color="#0d1117" emissive="#001122" emissiveIntensity={0.3} />
      </mesh>
      {/* Screen glow */}
      <mesh position={[0, 0.1, 0.08]}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshStandardMaterial color="#0d1117" emissive="#112233" emissiveIntensity={0.5} transparent opacity={0.9} />
      </mesh>
      {/* Code text */}
      <group ref={textGroupRef} position={[0, 0.1, 0.09]}>
        {CODE_LINES.slice(0, 5).map((line, i) => (
          <Text
            key={`line-${i}`}
            position={[-0.5, 0.25 - i * 0.15, 0]}
            fontSize={0.07}
            color={(() => {
              if (i === 0) return '#66ff66'
              if (i === 1) return '#ffcc44'
              return '#44aaff'
            })()}
            anchorX="left"
            font={undefined}
          >
            {line}
          </Text>
        ))}
      </group>
      {/* Cursor blink */}
      <mesh position={[-0.5, -0.28, 0.09]}>
        <boxGeometry args={[0.04, 0.08, 0.001]} />
        <meshStandardMaterial color="#66ff66" emissive="#66ff66" emissiveIntensity={2} />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      {/* Stand base */}
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.05, 8]} />
        <meshStandardMaterial color="#2a2a3e" />
      </mesh>
      {/* Power LED */}
      <mesh position={[0.55, -0.3, 0.076]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}
