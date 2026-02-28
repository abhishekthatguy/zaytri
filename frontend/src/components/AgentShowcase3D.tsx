"use client";

import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    Html,
    Sparkles,
} from "@react-three/drei";
import * as THREE from "three";
import { siteConfig } from "@/lib/siteConfig";

// ─── Orbital System Config ─────────────────────────────────────────────────
// Level 1: Core (Master Intelligence)
// Level 2: Active Agents (inner ring) — Content Creator, Scheduler Bot, Publisher Bot
// Level 3: Functional Agents (mid ring) — Hashtag Generator, Review Agent, Engagement Bot
// Level 4: Analytics Agent (outer ring — data layer)

interface AgentOrbital {
    agentIndex: number;
    ring: 1 | 2 | 3;
    orbitRadius: number;
    orbitSpeed: number;       // rad/s
    orbitTilt: number;        // radians
    orbitPhaseOffset: number; // starting angle
    yOffset: number;
    size: number;
    color: string;
    emissive: string;
    shape: "icosahedron" | "octahedron" | "dodecahedron" | "sphere" | "box" | "torus" | "cone";
}

const ORBITAL_AGENTS: AgentOrbital[] = [
    // Ring 1 (inner) — Core operational agents closest to the brain
    { agentIndex: 0, ring: 1, orbitRadius: 3.0, orbitSpeed: 0.22, orbitTilt: 0.15, orbitPhaseOffset: 0, yOffset: 0, size: 0.32, color: "#22d3ee", emissive: "#0e7490", shape: "octahedron" },
    { agentIndex: 3, ring: 1, orbitRadius: 3.2, orbitSpeed: 0.20, orbitTilt: 0.15, orbitPhaseOffset: Math.PI * 2 / 3, yOffset: 0.15, size: 0.30, color: "#38bdf8", emissive: "#0284c7", shape: "box" },
    { agentIndex: 4, ring: 1, orbitRadius: 2.8, orbitSpeed: 0.24, orbitTilt: 0.15, orbitPhaseOffset: Math.PI * 4 / 3, yOffset: -0.1, size: 0.30, color: "#818cf8", emissive: "#4f46e5", shape: "cone" },
    // Ring 2 (mid) — Functional processing agents
    { agentIndex: 1, ring: 2, orbitRadius: 4.8, orbitSpeed: -0.14, orbitTilt: -0.20, orbitPhaseOffset: 0, yOffset: 0.2, size: 0.28, color: "#c084fc", emissive: "#7c3aed", shape: "icosahedron" },
    { agentIndex: 2, ring: 2, orbitRadius: 5.0, orbitSpeed: -0.12, orbitTilt: -0.20, orbitPhaseOffset: Math.PI * 2 / 3, yOffset: -0.15, size: 0.28, color: "#fb7185", emissive: "#e11d48", shape: "dodecahedron" },
    { agentIndex: 5, ring: 2, orbitRadius: 4.6, orbitSpeed: -0.16, orbitTilt: -0.20, orbitPhaseOffset: Math.PI * 4 / 3, yOffset: 0.1, size: 0.28, color: "#2dd4bf", emissive: "#0d9488", shape: "torus" },
    // Ring 3 (outer) — Data / Analytics layer
    { agentIndex: 6, ring: 3, orbitRadius: 6.5, orbitSpeed: 0.08, orbitTilt: 0.35, orbitPhaseOffset: 0, yOffset: 0, size: 0.35, color: "#a78bfa", emissive: "#6d28d9", shape: "sphere" },
];

// ─── Bot Node (Chatbot Visual) ─────────────────────────────────────────────

function BotNode({ icon, color, size = 0.35, active, dimmed }: {
    icon: string;
    color: string;
    size?: number;
    active: boolean;
    dimmed: boolean;
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
            // Float animation
            meshRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 2) * 0.05;
        }
    });

    return (
        <group>
            {/* Inner Glow Core */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[size, 32, 32]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={active ? 4 : 0.5}
                    transparent
                    opacity={active ? 0.9 : 0.4}
                />

                {/* Agent Icon inside the core */}
                <Html center distanceFactor={8} position={[0, 0, 0]}>
                    <div
                        className="text-2xl transition-all duration-500 select-none pointer-events-none"
                        style={{
                            opacity: dims(active, dimmed),
                            transform: `scale(${active ? 1.2 : 0.8})`,
                            filter: active ? `drop-shadow(0 0 10px ${color})` : "none",
                        }}
                    >
                        {icon}
                    </div>
                </Html>
            </mesh>

            {/* Orbital Shield Ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[size * 1.6, 0.015, 8, 48]} />
                <meshBasicMaterial color={color} transparent opacity={active ? 0.3 : 0.05} />
            </mesh>

            {/* 24/7 Status Label */}
            <Html center position={[0, size + 0.4, 0]} distanceFactor={8}>
                <div
                    className="flex flex-col items-center gap-1 transition-all duration-500"
                    style={{ opacity: dims(active, dimmed) }}
                >
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-black/60 border border-green-500/30 backdrop-blur-sm">
                        <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]" />
                        <span className="text-[6px] font-black text-green-400 uppercase tracking-widest whitespace-nowrap">
                            Active 24/7
                        </span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

function dims(active: boolean, dimmed: boolean) {
    if (active) return 1;
    if (dimmed) return 0.2;
    return 0.6;
}

// ─── Intelligence Core (Central Brain) ─────────────────────────────────────

function IntelligenceCore({ activeIndex }: { activeIndex: number }) {
    const coreRef = useRef<THREE.Group>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.PointLight>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (coreRef.current) {
            coreRef.current.rotation.y = t * 0.1;
        }
        if (innerRef.current) {
            // Pulse logic
            const pulse = 1 + Math.sin(t * 1.5) * 0.05;
            innerRef.current.scale.setScalar(pulse);
        }
        if (glowRef.current) {
            glowRef.current.intensity = 4 + Math.sin(t * 2) * 1.5;
        }
    });

    return (
        <group ref={coreRef}>
            {/* Core glow light */}
            <pointLight ref={glowRef} position={[0, 0, 0]} color="#06b6d4" intensity={4} distance={10} decay={2} />

            {/* Master Agent Bot Node Visual */}
            <mesh ref={innerRef}>
                <sphereGeometry args={[1.1, 32, 32]} />
                <meshStandardMaterial
                    color="#0891b2"
                    emissive="#06b6d4"
                    emissiveIntensity={2}
                    transparent
                    opacity={0.8}
                />

                {/* Master Icon */}
                <Html center distanceFactor={8} position={[0, 0.1, 0]}>
                    <div className="text-4xl filter drop-shadow-[0_0_15px_#06b6d4] animate-pulse select-none pointer-events-none">
                        🤖
                    </div>
                </Html>
            </mesh>

            {/* Complex Orbital Core Rings */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.6, 0.02, 16, 64]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} />
            </mesh>
            <mesh rotation={[0, Math.PI / 4, 0]}>
                <torusGeometry args={[1.8, 0.01, 8, 48]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.1} />
            </mesh>

            {/* "COMMAND CENTER" label */}
            <Html center position={[0, -2.0, 0]} distanceFactor={10} style={{ pointerEvents: "none" }}>
                <div className="text-center select-none">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/80 border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] whitespace-nowrap">
                            Zaytri Command
                        </span>
                    </div>
                </div>
            </Html>
        </group>
    );
}

// ─── Orbital Ring Path (visible thin ring) ─────────────────────────────────

function OrbitalRing({ radius, tilt, rotateDir = 1, opacity = 0.06 }: {
    radius: number;
    tilt: number;
    rotateDir?: number;
    opacity?: number;
}) {
    const ref = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.z = state.clock.getElapsedTime() * 0.02 * rotateDir;
        }
    });

    return (
        <mesh ref={ref} rotation={[Math.PI / 2 + tilt, 0, 0]}>
            <torusGeometry args={[radius, 0.008, 16, 128]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={opacity} />
        </mesh>
    );
}

// ─── Energy Pulse (light traveling from core to agent) ─────────────────────

function EnergyPulse({ target, color, active }: {
    target: THREE.Vector3;
    color: string;
    active: boolean;
}) {
    const ref = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.getElapsedTime();
        // Pulse travels outward from origin to target
        const speed = 0.8;
        const progress = ((t * speed) % 1.5);
        const p = Math.min(1, progress);

        ref.current.position.lerpVectors(new THREE.Vector3(0, 0, 0), target, p);
        ref.current.visible = active && progress < 1.2;

        const scale = active ? (0.03 + Math.sin(p * Math.PI) * 0.04) : 0;
        ref.current.scale.setScalar(scale);
    });

    return (
        <mesh ref={ref}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
    );
}

// ─── Neural Link Beam (Core → Agent connection) ───────────────────────────

function NeuralBeam({ targetPos, color, active, dimmed }: {
    targetPos: THREE.Vector3;
    color: string;
    active: boolean;
    dimmed: boolean;
}) {
    const ref = useRef<THREE.Line>(null);
    const geoRef = useRef<THREE.BufferGeometry>(null);

    useFrame(() => {
        if (!geoRef.current) return;
        const positions = new Float32Array([
            0, 0, 0,
            targetPos.x, targetPos.y, targetPos.z,
        ]);
        geoRef.current.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    });

    const opacity = active ? 0.35 : dimmed ? 0.02 : 0.06;

    return (
        <line ref={ref as any}>
            <bufferGeometry ref={geoRef} />
            <lineBasicMaterial
                color={active ? color : "#06b6d4"}
                transparent
                opacity={opacity}
                blending={THREE.AdditiveBlending}
            />
        </line>
    );
}

// ─── Agent Node (Orbital) ──────────────────────────────────────────────────

function OrbitalAgent({
    agent,
    orbital,
    activeIndex,
    onSelect,
}: {
    agent: (typeof siteConfig.agents)[number];
    orbital: AgentOrbital;
    activeIndex: number;
    onSelect: (i: number) => void;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const posRef = useRef(new THREE.Vector3());

    const isActive = activeIndex === orbital.agentIndex;
    const isDimmed = activeIndex !== -1 && !isActive;

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (!groupRef.current) return;

        // Elliptical orbit with tilt
        const angle = orbital.orbitPhaseOffset + t * orbital.orbitSpeed;
        const r = orbital.orbitRadius;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r * 0.85; // Slight ellipse
        const tiltY = Math.sin(angle) * Math.sin(orbital.orbitTilt) * 0.8;
        const y = orbital.yOffset + tiltY + Math.sin(t * 0.5 + orbital.agentIndex) * 0.15;

        groupRef.current.position.set(x, y, z);
        posRef.current.set(x, y, z);
    });

    return (
        <>
            {/* Neural beam to core */}
            <NeuralBeam targetPos={posRef.current} color={orbital.color} active={isActive} dimmed={isDimmed} />

            {/* Energy pulse for active agent */}
            <EnergyPulse target={posRef.current} color={orbital.color} active={isActive} />

            <group ref={groupRef}>
                <group
                    onClick={(e) => { e.stopPropagation(); onSelect(orbital.agentIndex); }}
                    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
                    onPointerOut={() => { document.body.style.cursor = "auto"; }}
                >
                    {/* Bot Visual */}
                    <BotNode
                        icon={agent.icon}
                        color={orbital.color}
                        size={orbital.size}
                        active={isActive}
                        dimmed={isDimmed}
                    />

                    {/* Agent glow point light */}
                    {isActive && (
                        <pointLight color={orbital.color} intensity={2} distance={3} decay={2} />
                    )}

                    {/* Agent Label */}
                    <Html
                        center
                        position={[0, -(orbital.size + 0.5), 0]}
                        distanceFactor={10}
                        style={{ pointerEvents: "none" }}
                    >
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-700 select-none whitespace-nowrap"
                            style={{
                                background: isActive ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.4)",
                                backdropFilter: "blur(12px)",
                                border: `1px solid ${isActive ? orbital.color + "66" : "rgba(255,255,255,0.05)"}`,
                                boxShadow: isActive ? `0 0 20px ${orbital.color}22` : "none",
                                opacity: isDimmed ? 0.3 : isActive ? 1 : 0.6,
                                transform: `scale(${isActive ? 1.1 : isDimmed ? 0.8 : 0.9})`,
                            }}
                        >
                            <span className="text-sm">{agent.icon}</span>
                            <span className="text-[9px] font-black text-white uppercase tracking-[0.12em]">
                                {agent.name}
                            </span>
                            {isActive && (
                                <div
                                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                                    style={{ background: orbital.color }}
                                />
                            )}
                        </div>
                    </Html>
                </group>
            </group>
        </>
    );
}

// ─── Data Particles (Background Level 3 — subtle) ─────────────────────────

function DataParticles() {
    const ref = useRef<THREE.Points>(null);

    const positions = useMemo(() => {
        const count = 120;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = 3 + Math.random() * 6;
            const y = (Math.random() - 0.5) * 4;
            pos[i * 3] = Math.cos(angle) * r;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = Math.sin(angle) * r;
        }
        return pos;
    }, []);

    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.y = state.clock.getElapsedTime() * 0.02;
        }
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                color="#06b6d4"
                size={0.02}
                transparent
                opacity={0.25}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                sizeAttenuation
            />
        </points>
    );
}


// ─── Auto-Rotating Camera ──────────────────────────────────────────────────

function AutoCamera({ isPaused }: { isPaused: boolean }) {
    const { camera } = useThree();
    const angleRef = useRef(0);
    const target = useRef(new THREE.Vector3(0, 0, 0));

    useFrame((_, delta) => {
        if (!isPaused) {
            angleRef.current += delta * 0.1;
        }

        const radius = 12;
        const height = 4;
        const tx = Math.cos(angleRef.current) * radius;
        const tz = Math.sin(angleRef.current) * radius;

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, tx, 0.015);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, tz, 0.015);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, height, 0.015);

        camera.lookAt(target.current);
    });

    return null;
}

// ─── Main Scene ────────────────────────────────────────────────────────────

function Scene({
    activeIndex,
    setActiveIndex,
    isPaused,
    setIsPaused,
}: {
    activeIndex: number;
    setActiveIndex: (i: number) => void;
    isPaused: boolean;
    setIsPaused: (v: boolean) => void;
}) {
    return (
        <>
            <AutoCamera isPaused={isPaused} />

            {/* Lighting — cinematic, minimal */}
            <ambientLight intensity={0.12} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
            <pointLight position={[-8, 5, -8]} intensity={0.6} color="#06b6d4" />
            <spotLight
                position={[0, 15, 0]}
                angle={0.4}
                penumbra={1}
                intensity={1.5}
                color="#0e7490"
                castShadow
                shadow-mapSize-width={512}
                shadow-mapSize-height={512}
            />

            {/* Fog for depth layering */}
            <fog attach="fog" args={["#030308", 14, 32]} />

            {/* Data particles — background depth */}
            <DataParticles />
            <Sparkles count={80} scale={18} size={1} speed={0.15} opacity={0.08} color="#06b6d4" />

            {/* Orbital Rings — 3 levels */}
            <OrbitalRing radius={3.0} tilt={0.15} rotateDir={1} opacity={0.06} />
            <OrbitalRing radius={4.8} tilt={-0.20} rotateDir={-1} opacity={0.04} />
            <OrbitalRing radius={6.5} tilt={0.35} rotateDir={1} opacity={0.03} />

            {/* Intelligence Core */}
            <IntelligenceCore activeIndex={activeIndex} />



            {/* Orbital Agents */}
            {ORBITAL_AGENTS.map((orbital) => (
                <OrbitalAgent
                    key={orbital.agentIndex}
                    agent={siteConfig.agents[orbital.agentIndex]}
                    orbital={orbital}
                    activeIndex={activeIndex}
                    onSelect={(idx) => {
                        setActiveIndex(idx);
                        setIsPaused(true);
                        setTimeout(() => setIsPaused(false), 6000);
                    }}
                />
            ))}
        </>
    );
}

// ─── Agent Selector ────────────────────────────────────────────────────────

function AgentSelector({
    activeIndex,
    setActiveIndex,
    setIsPaused,
}: {
    activeIndex: number;
    setActiveIndex: (i: number) => void;
    setIsPaused: (v: boolean) => void;
}) {
    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
            <div className="flex gap-2 p-2 rounded-xl bg-black/50 border border-white/5 backdrop-blur-xl">
                {siteConfig.agents.map((ag, i) => {
                    const orbital = ORBITAL_AGENTS.find((o) => o.agentIndex === i);
                    const color = orbital?.color || "#06b6d4";
                    return (
                        <button
                            key={i}
                            onClick={() => {
                                setActiveIndex(i);
                                setIsPaused(true);
                                setTimeout(() => setIsPaused(false), 6000);
                            }}
                            className="relative group cursor-pointer"
                            title={ag.name}
                        >
                            <div
                                className="w-7 h-7 rounded-full transition-all duration-500 flex items-center justify-center text-[11px]"
                                style={{
                                    background: activeIndex === i ? color : "rgba(255,255,255,0.05)",
                                    boxShadow: activeIndex === i ? `0 0 14px ${color}55` : "none",
                                    transform: activeIndex === i ? "scale(1.15)" : "scale(1)",
                                    border: `1px solid ${activeIndex === i ? color + "44" : "rgba(255,255,255,0.05)"}`,
                                }}
                            >
                                {ag.icon}
                            </div>
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/95 text-[7px] text-white opacity-0 group-hover:opacity-100 rounded-md pointer-events-none whitespace-nowrap border border-white/10 font-black uppercase tracking-[0.15em] transition-all">
                                {ag.name}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Info Panel ────────────────────────────────────────────────────────────

function InfoPanel({
    agent,
    index,
}: {
    agent: (typeof siteConfig.agents)[number];
    index: number;
}) {
    const orbital = ORBITAL_AGENTS.find((o) => o.agentIndex === index);
    const color = orbital?.color || "#06b6d4";
    const ringLabel = orbital?.ring === 1 ? "Core Ring" : orbital?.ring === 2 ? "Process Ring" : "Data Ring";

    return (
        <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none"
            style={{ width: "min(92vw, 480px)" }}
        >
            <div
                className="p-5 rounded-2xl backdrop-blur-2xl transition-all duration-700"
                style={{
                    background: "rgba(10, 10, 18, 0.88)",
                    border: `1px solid ${color}25`,
                    boxShadow: `0 0 40px ${color}10, inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
            >
                <div className="flex items-center gap-4 mb-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{
                            background: `${color}15`,
                            border: `1px solid ${color}30`,
                        }}
                    >
                        {agent.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white uppercase tracking-[0.12em]">
                                {agent.name}
                            </span>
                            <span
                                className="text-[7px] font-bold uppercase tracking-[0.3em] px-2 py-0.5 rounded-full"
                                style={{
                                    background: `${color}15`,
                                    color: color,
                                    border: `1px solid ${color}25`,
                                }}
                            >
                                {ringLabel}
                            </span>
                        </div>
                        <span className="text-[8px] text-white/25 font-bold uppercase tracking-[0.3em]">
                            Agent 0{index + 1} · Status: Active
                        </span>
                    </div>
                    <div
                        className="ml-auto w-2 h-2 rounded-full animate-pulse"
                        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                    />
                </div>
                <p className="text-xs text-white/40 leading-relaxed font-medium">
                    {agent.description}
                </p>
            </div>
        </div>
    );
}

// ─── Export ─────────────────────────────────────────────────────────────────

export default function AgentShowcase3D() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const total = siteConfig.agents.length;

    // Auto-cycle
    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % total);
        }, 5000);
        return () => clearInterval(interval);
    }, [isPaused, total]);

    return (
        <div className="relative w-full flex-1 min-h-0">
            <AgentSelector
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                setIsPaused={setIsPaused}
            />

            <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{
                    antialias: true,
                    alpha: true,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.0,
                    powerPreference: "high-performance",
                }}
                camera={{ position: [12, 4, 0], fov: 32, near: 0.1, far: 100 }}
                style={{ background: "transparent" }}
            >
                <Scene
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    isPaused={isPaused}
                    setIsPaused={setIsPaused}
                />
            </Canvas>
        </div>
    );
}
