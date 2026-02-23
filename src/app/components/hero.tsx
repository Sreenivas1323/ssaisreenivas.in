"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";

const PARTICLE_COUNT = 1014; // Exactly chosen for perfect grid math

// --- 1. THE MATH ENGINE ---

// Helper: Shuffles the order of particles so they "swarm" chaotically during transitions
const shuffleArray = (array: Float32Array) => {
  for (let i = PARTICLE_COUNT - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmpX = array[i * 3],
      tmpY = array[i * 3 + 1],
      tmpZ = array[i * 3 + 2];
    array[i * 3] = array[j * 3];
    array[i * 3 + 1] = array[j * 3 + 1];
    array[i * 3 + 2] = array[j * 3 + 2];
    array[j * 3] = tmpX;
    array[j * 3 + 1] = tmpY;
    array[j * 3 + 2] = tmpZ;
  }
  return array;
};

// 1. Perfect Fibonacci Sphere
const getSpherePositions = () => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta); // x
    positions[i * 3 + 1] = Math.cos(phi); // y
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta); // z
  }
  return shuffleArray(positions);
};

// 2. Cartesian Grid Cube (13x13 dots per face = 169 * 6 = 1014)
const getCubePositions = () => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const grid = 13;
  const step = 2 / (grid - 1);
  const r = 0.8;
  let idx = 0;

  for (let face = 0; face < 6; face++) {
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const u = (col * step - 1) * r;
        const v = (row * step - 1) * r;
        let x = 0,
          y = 0,
          z = 0;

        switch (face) {
          case 0:
            x = r;
            y = v;
            z = u;
            break; // Right
          case 1:
            x = -r;
            y = v;
            z = u;
            break; // Left
          case 2:
            x = u;
            y = r;
            z = v;
            break; // Top
          case 3:
            x = u;
            y = -r;
            z = v;
            break; // Bottom
          case 4:
            x = u;
            y = v;
            z = r;
            break; // Front
          case 5:
            x = u;
            y = v;
            z = -r;
            break; // Back
        }
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;
        idx++;
      }
    }
  }
  return shuffleArray(positions);
};

// 3. React Logo (Fibonacci Core + 3 Evenly Spaced Rings)
const getReactPositions = () => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const coreN = 150;
  const ringN = (PARTICLE_COUNT - coreN) / 3; // 288 dots per ring

  // Core Sphere
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < coreN; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / coreN);
    const r = 0.35;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Intersecting Dotted Rings
  for (let ring = 0; ring < 3; ring++) {
    for (let i = 0; i < ringN; i++) {
      const idx = coreN + ring * ringN + i;
      const t = (i / ringN) * Math.PI * 2; // perfectly even spacing
      const angle = ring * (Math.PI / 3); // 0, 60, 120 degrees

      const rx = Math.cos(t) * 1.5;
      const ry = Math.sin(t) * 0.45;

      positions[idx * 3] = rx * Math.cos(angle) - ry * Math.sin(angle);
      positions[idx * 3 + 1] = rx * Math.sin(angle) + ry * Math.cos(angle);
      positions[idx * 3 + 2] = 0; // Flat rings (let the camera tilt show 3D)
    }
  }
  return shuffleArray(positions);
};

// 4. Flat Filled Heart (2D silhouette with concentric layers + outline)
const getHeartPositions = () => {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const scale = 0.065;

  // Heart outline parametric: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
  const heartX = (t: number) => 16 * Math.pow(Math.sin(t), 3);
  const heartY = (t: number) =>
    13 * Math.cos(t) -
    5 * Math.cos(2 * t) -
    2 * Math.cos(3 * t) -
    Math.cos(4 * t);

  // Place ~40% on the outline for a crisp edge, ~60% filling the interior at varying scales
  const outlineCount = Math.floor(PARTICLE_COUNT * 0.4);
  const fillCount = PARTICLE_COUNT - outlineCount;
  let idx = 0;

  // Outline dots — evenly spaced around the heart contour
  for (let i = 0; i < outlineCount; i++) {
    const t = (i / outlineCount) * Math.PI * 2;
    positions[idx * 3] = heartX(t) * scale;
    positions[idx * 3 + 1] = heartY(t) * scale + 0.15;
    positions[idx * 3 + 2] = 0;
    idx++;
  }

  // Fill dots — concentric scaled copies of the outline, shrinking toward center
  const layers = 12;
  const perLayer = Math.floor(fillCount / layers);
  for (let layer = 0; layer < layers; layer++) {
    const r = 1 - (layer + 1) / (layers + 1); // scale 0.92 → 0.08
    const count = layer === layers - 1 ? fillCount - (layers - 1) * perLayer : perLayer;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      positions[idx * 3] = heartX(t) * scale * r;
      positions[idx * 3 + 1] = heartY(t) * scale * r + 0.15;
      positions[idx * 3 + 2] = 0;
      idx++;
    }
  }

  return shuffleArray(positions);
};

// Pre-compute the "idle" scattered positions at module level (avoids Math.random in render)
const IDLE_POSITIONS = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
  // Deterministic pseudo-random scatter using sine
  IDLE_POSITIONS[i] = (Math.sin(i * 9301 + 49297) % 1) * 0.1 - 0.05;
}

// --- 2. THE WEBGL COMPONENT ---
type ShapeType = "design" | "focused" | "react" | "animations" | null;

const Particles = ({
  activeShape,
  beatTrigger,
}: {
  activeShape: ShapeType;
  beatTrigger: number;
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const sourcePositions = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const particleDelays = useRef(new Float32Array(PARTICLE_COUNT));
  const isMorphing = useRef(false);
  const morphStartTime = useRef(0);

  // Generates a programmatic crisp circle texture for the dots
  const dotTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);

  const targets = useMemo(
    () => ({
      design: getSpherePositions(),
      focused: getCubePositions(),
      react: getReactPositions(),
      animations: getHeartPositions(),
      null: IDLE_POSITIONS,
    }),
    [],
  );

  useEffect(() => {
    if (geometryRef.current) {
      const currentPos = geometryRef.current.attributes.position
        .array as Float32Array;
      sourcePositions.current.set(currentPos);
      // Per-particle stagger: each particle gets a small random delay (0–150ms)
      // so they don't all move in lockstep — creates an organic swarm feel
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particleDelays.current[i] =
          Math.abs(Math.sin(i * 7919 + performance.now() * 0.001) % 1) * 150;
      }
      morphStartTime.current = performance.now();
      isMorphing.current = true;
    }
  }, [activeShape]);

  // Smooth cubic ease-in-out (much gentler than the previous expo-20)
  const easeInOutCubic = (x: number) => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };

  useFrame((_, delta) => {
    if (!pointsRef.current || !geometryRef.current) return;

    // 1. Morph Physics (per-particle staggered with cubic easing)
    if (isMorphing.current) {
      const now = performance.now();
      const globalElapsed = now - morphStartTime.current;
      const morphDuration = 900; // ms

      const targetPos = targets[activeShape || "null"];
      const positions = geometryRef.current.attributes.position
        .array as Float32Array;

      let allDone = true;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particleElapsed = globalElapsed - particleDelays.current[i];
        const progress = Math.max(0, Math.min(particleElapsed / morphDuration, 1));
        if (progress < 1) allDone = false;
        const eased = easeInOutCubic(progress);

        const i3 = i * 3;
        positions[i3] = sourcePositions.current[i3] + (targetPos[i3] - sourcePositions.current[i3]) * eased;
        positions[i3 + 1] = sourcePositions.current[i3 + 1] + (targetPos[i3 + 1] - sourcePositions.current[i3 + 1]) * eased;
        positions[i3 + 2] = sourcePositions.current[i3 + 2] + (targetPos[i3 + 2] - sourcePositions.current[i3 + 2]) * eased;
      }
      geometryRef.current.attributes.position.needsUpdate = true;

      if (allDone) isMorphing.current = false;
    }

    // 2. Continuous Fixed-Axis Rotation
    pointsRef.current.rotation.y += delta * 0.4;
    pointsRef.current.rotation.x = 0.25; // Permanent downward tilt for 3D depth
    pointsRef.current.rotation.z = 0;

    // 3. Heartbeat
    if (activeShape === "animations" && beatTrigger > 0) {
      const elapsed = performance.now() - beatTrigger;
      if (elapsed < 250) {
        const bump = Math.sin((elapsed / 250) * Math.PI) * 0.3;
        pointsRef.current.scale.set(1 + bump, 1 + bump, 1 + bump);
      } else {
        pointsRef.current.scale.set(1, 1, 1);
      }
    } else {
      const targetScale = activeShape ? 1 : 0;
      pointsRef.current.scale.x +=
        (targetScale - pointsRef.current.scale.x) * 0.1;
      pointsRef.current.scale.y +=
        (targetScale - pointsRef.current.scale.y) * 0.1;
      pointsRef.current.scale.z +=
        (targetScale - pointsRef.current.scale.z) * 0.1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={targets.null}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05} // Adjusted for crisp look
        map={dotTexture} // Using our perfect circle texture
        color="#ffffff"
        transparent
        alphaTest={0.5} // Discards blurred edges
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// --- 3. UI LAYOUT ---
function HoverSpan({
  id,
  isActive,
  children,
  onEnter,
  onLeave,
  onClick,
}: {
  id: ShapeType;
  isActive: boolean;
  children: React.ReactNode;
  onEnter: () => void;
  onLeave: () => void;
  onClick?: () => void;
}) {
  return (
    <span
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`cursor-pointer transition-colors duration-300 ${
        isActive ? "text-gray-100" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </span>
  );
}

export default function PortfolioHeader() {
  const [hoveredWord, setHoveredWord] = useState<ShapeType>(null);
  const [beatTrigger, setBeatTrigger] = useState(0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex justify-center pt-32 font-sans selection:bg-gray-800">
      <div className="w-full max-w-lg relative pl-20">
        <div className="absolute left-[-20px] top-[-20px] h-[100px] w-[100px] pointer-events-none">
          <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }}>
            <Particles activeShape={hoveredWord} beatTrigger={beatTrigger} />
          </Canvas>
        </div>

        <div className="flex flex-col gap-1 z-10 relative">
          <h1 className="text-base font-medium text-gray-100 tracking-wide mb-1">
            Enzo Manuel Mangano
          </h1>
          <p className="text-sm">
            <HoverSpan id="design" isActive={hoveredWord === "design"} onEnter={() => setHoveredWord("design")} onLeave={() => setHoveredWord(null)}>Design Engineer</HoverSpan>{" "}
            <HoverSpan id="focused" isActive={hoveredWord === "focused"} onEnter={() => setHoveredWord("focused")} onLeave={() => setHoveredWord(null)}>focused on</HoverSpan>{" "}
            <HoverSpan id="react" isActive={hoveredWord === "react"} onEnter={() => setHoveredWord("react")} onLeave={() => setHoveredWord(null)}>React Native</HoverSpan>{" "}
            <HoverSpan id="animations" isActive={hoveredWord === "animations"} onEnter={() => setHoveredWord("animations")} onLeave={() => setHoveredWord(null)} onClick={() => setBeatTrigger(performance.now())}>animations.</HoverSpan>
          </p>
        </div>

        <div className="mt-16 space-y-6">
          <h2 className="text-xs font-semibold text-gray-600 tracking-widest uppercase mb-4">
            Projects
          </h2>
          <div className="flex justify-between text-sm text-gray-300">
            <span>Reanimate.dev</span>
            <span className="text-gray-600">Course</span>
          </div>
          <div className="flex justify-between text-sm text-gray-300">
            <span>Demos</span>
            <span className="text-gray-600">Open Source</span>
          </div>
        </div>
      </div>
    </div>
  );
}
