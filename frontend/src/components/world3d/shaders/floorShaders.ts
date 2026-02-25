/**
 * Procedural floor shader materials for room floor textures.
 * All shaders incorporate toon shading (3-step gradient) to match the art style.
 *
 * Each shader outputs a cel-shaded look with procedural patterns.
 */
import * as THREE from 'three'

// ─── Shared toon lighting chunk ──────────────────────────────────────
// A minimal toon fragment: 3-step discretized diffuse lighting.
const TOON_LIGHTING_PARS = /* glsl */ `
  // 3-step toon ramp
  float toonStep(float NdotL) {
    if (NdotL > 0.6) return 1;
    if (NdotL > 0.25) return 0.7;
    return 0.45;
  }
`

// ─── Common vertex shader ────────────────────────────────────────────
const FLOOR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// ─── Helper: create a ShaderMaterial with common setup ───────────────
function makeFloorMaterial(
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERTEX,
    fragmentShader,
    uniforms: {
      uLightDir: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
      ...uniforms,
    },
    side: THREE.FrontSide,
  })
}

// ═══════════════════════════════════════════════════════════════════════
// TILES — checkerboard pattern (2 alternating colors from accent)
// ═══════════════════════════════════════════════════════════════════════
const TILES_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uScale;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Checkerboard
    vec2 grid = floor(vUv * uScale);
    float checker = mod(grid.x + grid.y, 2);

    // Thin grout lines
    vec2 f = fract(vUv * uScale);
    float grout = 1 - step(0.03, f.x) * step(0.03, f.y) *
                  step(f.x, 0.97) * step(f.y, 0.97);

    vec3 tileColor = mix(uColor1, uColor2, checker);
    vec3 groutColor = tileColor * 0.7;
    vec3 baseColor = mix(tileColor, groutColor, grout);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createTilesFloorMaterial(accentColor: string): THREE.ShaderMaterial {
  const accent = new THREE.Color(accentColor)
  // Lighter and darker variants
  const color1 = accent.clone().lerp(new THREE.Color('#ffffff'), 0.5)
  const color2 = accent.clone().lerp(new THREE.Color('#ffffff'), 0.25)
  return makeFloorMaterial(TILES_FRAGMENT, {
    uColor1: { value: color1 },
    uColor2: { value: color2 },
    uScale: { value: 12 },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// WOOD — horizontal plank pattern (warm browns)
// ═══════════════════════════════════════════════════════════════════════
const WOOD_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uScale;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  // Simple pseudo-random
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Horizontal planks
    float plankY = floor(vUv.y * uScale);
    float plankF = fract(vUv.y * uScale);

    // Each plank gets a slightly different shade
    float plankVariation = hash(vec2(plankY, 0)) * 0.15;
    vec3 plankColor = mix(uColor1, uColor2, 0.5 + plankVariation - 0.075);

    // Subtle grain lines along X
    float grain = hash(vec2(floor(vUv.x * uScale * 8), plankY));
    plankColor *= (0.95 + grain * 0.05);

    // Gap between planks
    float gap = 1 - smoothstep(0, 0.04, plankF) * smoothstep(0, 0.04, 1 - plankF);
    vec3 gapColor = plankColor * 0.55;
    vec3 baseColor = mix(plankColor, gapColor, gap);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createWoodFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(WOOD_FRAGMENT, {
    uColor1: { value: new THREE.Color('#8B6914') },
    uColor2: { value: new THREE.Color('#A5822E') },
    uScale: { value: 10 },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// CONCRETE — solid with subtle noise
// ═══════════════════════════════════════════════════════════════════════
const CONCRETE_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uBaseColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3 - 2 * f);
    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Multi-octave noise for concrete variation
    float n = noise(vUv * 20) * 0.5 + noise(vUv * 40) * 0.3 + noise(vUv * 80) * 0.2;
    vec3 baseColor = uBaseColor * (0.9 + n * 0.15);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createConcreteFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(CONCRETE_FRAGMENT, {
    uBaseColor: { value: new THREE.Color('#9E9684') },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// CARPET — muted accent color with subtle texture
// ═══════════════════════════════════════════════════════════════════════
const CARPET_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uBaseColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Fine carpet fibre noise
    float fibre = hash(floor(vUv * 120));
    vec3 baseColor = uBaseColor * (0.92 + fibre * 0.08);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createCarpetFloorMaterial(accentColor: string): THREE.ShaderMaterial {
  // Muted version of accent
  const accent = new THREE.Color(accentColor)
  const muted = accent.clone().lerp(new THREE.Color('#9E9684'), 0.45)
  return makeFloorMaterial(CARPET_FRAGMENT, {
    uBaseColor: { value: muted },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// LAB — clean white tiles with thin gray grout lines
// ═══════════════════════════════════════════════════════════════════════
const LAB_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uTileColor;
  uniform vec3 uGroutColor;
  uniform float uScale;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    vec2 f = fract(vUv * uScale);

    // Thin grout lines
    float grout = 1 - step(0.025, f.x) * step(0.025, f.y) *
                  step(f.x, 0.975) * step(f.y, 0.975);

    vec3 baseColor = mix(uTileColor, uGroutColor, grout);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createLabFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(LAB_FRAGMENT, {
    uTileColor: { value: new THREE.Color('#F0EDE8') },
    uGroutColor: { value: new THREE.Color('#B0ADA6') },
    uScale: { value: 16 },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// MARBLE — white/light grey with subtle veining (Scandinavian style)
// ═══════════════════════════════════════════════════════════════════════
const MARBLE_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uBaseColor;
  uniform vec3 uVeinColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3 - 2 * f);
    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0;
    float a = 0.5;
    vec2 shift = vec2(100);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Marble veining: warped noise for organic streaks
    vec2 uv = vUv * 8;
    float warp = fbm(uv * 2);
    float vein = fbm(uv + warp * 1.5);
    // Sharpen veins into thin streaks
    vein = smoothstep(0.35, 0.55, vein);

    vec3 baseColor = mix(uBaseColor, uVeinColor, vein * 0.35);
    // Subtle surface variation
    float surf = noise(vUv * 30) * 0.03;
    baseColor += surf;

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createMarbleFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(MARBLE_FRAGMENT, {
    uBaseColor: { value: new THREE.Color('#F5F2EE') }, // warm white
    uVeinColor: { value: new THREE.Color('#C8C0B8') }, // light warm grey
  })
}

// ═══════════════════════════════════════════════════════════════════════
// LIGHT WOOD — birch/pine blonde planks (Scandinavian)
// ═══════════════════════════════════════════════════════════════════════
const LIGHT_WOOD_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uScale;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Horizontal planks
    float plankY = floor(vUv.y * uScale);
    float plankF = fract(vUv.y * uScale);

    // Each plank gets a slightly different shade
    float plankVariation = hash(vec2(plankY, 0)) * 0.1;
    vec3 plankColor = mix(uColor1, uColor2, 0.5 + plankVariation - 0.05);

    // Subtle grain lines along X
    float grain = hash(vec2(floor(vUv.x * uScale * 8), plankY));
    plankColor *= (0.97 + grain * 0.03);

    // Gap between planks (narrower, lighter gap for light wood)
    float gap = 1 - smoothstep(0, 0.03, plankF) * smoothstep(0, 0.03, 1 - plankF);
    vec3 gapColor = plankColor * 0.82;
    vec3 baseColor = mix(plankColor, gapColor, gap);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createLightWoodFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(LIGHT_WOOD_FRAGMENT, {
    uColor1: { value: new THREE.Color('#E2D3B8') }, // light birch
    uColor2: { value: new THREE.Color('#D4C4A0') }, // warm pine
    uScale: { value: 10 },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// LIGHT TILES — white/cream checkerboard (modern office)
// ═══════════════════════════════════════════════════════════════════════
const LIGHT_TILES_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uGroutColor;
  uniform float uScale;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Checkerboard
    vec2 grid = floor(vUv * uScale);
    float checker = mod(grid.x + grid.y, 2);

    // Grout lines
    vec2 f = fract(vUv * uScale);
    float grout = 1 - step(0.025, f.x) * step(0.025, f.y) *
                  step(f.x, 0.975) * step(f.y, 0.975);

    vec3 tileColor = mix(uColor1, uColor2, checker);
    vec3 baseColor = mix(tileColor, uGroutColor, grout);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createLightTilesFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(LIGHT_TILES_FRAGMENT, {
    uColor1: { value: new THREE.Color('#F7F4F0') }, // near white
    uColor2: { value: new THREE.Color('#EDE8E0') }, // cream
    uGroutColor: { value: new THREE.Color('#D0CBC4') }, // light warm grey grout
    uScale: { value: 12 },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// SAND — warm beige with subtle grain texture
// ═══════════════════════════════════════════════════════════════════════
const SAND_FRAGMENT = /* glsl */ `
  ${TOON_LIGHTING_PARS}
  uniform vec3 uBaseColor;
  uniform vec3 uLightDir;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3 - 2 * f);
    float a = hash(i);
    float b = hash(i + vec2(1, 0));
    float c = hash(i + vec2(0, 1));
    float d = hash(i + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float NdotL = dot(vNormal, uLightDir);
    float toon = toonStep(NdotL);

    // Soft multi-scale noise for natural sand look
    float n = noise(vUv * 15) * 0.4 + noise(vUv * 35) * 0.35 + noise(vUv * 70) * 0.25;
    vec3 baseColor = uBaseColor * (0.95 + n * 0.08);

    gl_FragColor = vec4(baseColor * toon, 1);
  }
`

export function createSandFloorMaterial(): THREE.ShaderMaterial {
  return makeFloorMaterial(SAND_FRAGMENT, {
    uBaseColor: { value: new THREE.Color('#E8DCC8') }, // warm beige
  })
}
