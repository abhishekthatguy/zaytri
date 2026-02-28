"use client";

import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import {
    Float,
    Line,
    Html,
    MeshDistortMaterial,
    ContactShadows,
    Sparkles,
} from "@react-three/drei";
import * as THREE from "three";
import { siteConfig } from "@/lib/siteConfig";

// ─── Agent Visual Config ───────────────────────────────────────────────────

const AGENT_VISUALS = [
    { color: "#22d3ee", emissive: "#0e7490", shape: "octahedron", orbitRadius: 3.8, orbitSpeed: 0.35, yOffset: 0 },
    { color: "#c084fc", emissive: "#7c3aed", shape: "icosahedron", orbitRadius: 3.8, orbitSpeed: 0.30, yOffset: 0.3 },
    { color: "#fb7185", emissive: "#e11d48", shape: "dodecahedron", orbitRadius: 3.8, orbitSpeed: 0.40, yOffset: -0.2 },
    { color: "#38bdf8", emissive: "#0284c7", shape: "box", orbitRadius: 3.8, orbitSpeed: 0.28, yOffset: 0.1 },
    { color: "#818cf8", emissive: "#4f46e5", shape: "cone", orbitRadius: 3.8, orbitSpeed: 0.38, yOffset: -0.1 },
    { color: "#2dd4bf", emissive: "#0d9488", shape: "torus", orbitRadius: 3.8, orbitSpeed: 0.32, yOffset: 0.25 },
    { color: "#a78bfa", emissive: "#6d28d9", shape: "sphere", orbitRadius: 3.8, orbitSpeed: 0.36, yOffset: -0.3 },
];

// ─── Geometry Factory ──────────────────────────────────────────────────────

function AgentGeometry({ shape, size = 0.35 }: { shape: string; size?: number }) {
    switch (shape) {
        case "box": return <boxGeometry args={[size, size, size]} />;
        case "cone": return <coneGeometry args={[size * 0.7, size * 1.4, 6]} />;
        case "octahedron": return <octahedronGeometry args={[size]} />;
        case "torus": return <torusGeometry args={[size * 0.6, size * 0.25, 16, 32]} />;
        case "dodecahedron": return <dodecahedronGeometry args={[size]} />;
        case "icosahedron": return <icosahedronGeometry args={[size]} />;
        default: return <sphereGeometry args={[size, 32, 32]} />;
    }
}

// ─── Central Core (Hub) ────────────────────────────────────────────────────

function CentralCore() {
    const coreRef = useRef<THREE.Group>(null);
    const innerRef = useRef<THREE.Mesh>(null);
    const outerRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (coreRef.current) {
            coreRef.current.rotation.y = t * 0.3;
        }
        if (innerRef.current) {
            innerRef.current.rotation.x = t * 0.5;
            innerRef.current.rotation.z = t * 0.3;
            const pulse = 1 + Math.sin(t * 2) * 0.08;
            innerRef.current.scale.setScalar(pulse);
        }
        if (outerRef.current) {
            outerRef.current.rotation.x = -t * 0.2;
            outerRef.current.rotation.z = t * 0.15;
        }
    });

    return (
        <group ref={coreRef}>
            {/* Inner glowing core */}
            <mesh ref={innerRef}>
                <icosahedronGeometry args={[0.6, 1]} />
                <meshStandardMaterial
                    color="#06b6d4"
                    emissive="#06b6d4"
                    emissiveIntensity={2}
                    metalness={0.8}
                    roughness={0.2}
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Outer wireframe shell */}
            <mesh ref={outerRef}>
                <icosahedronGeometry args={[0.9, 1]} />
                <meshBasicMaterial
                    color="#06b6d4"
                    wireframe
                    transparent
                    opacity={0.15}
                />
            </mesh>

            {/* Core glow ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.1, 0.015, 16, 64]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} />
            </mesh>
            <mesh rotation={[Math.PI / 2, Math.PI / 4, 0]}>
                <torusGeometry args={[1.3, 0.01, 16, 64]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.15} />
            </mesh>
        </group>
    );
}

// ─── Connection Beam (Dynamic Line to Center) ─────────────────────────────

function ConnectionBeam({
    color,
    isActive,
    groupRef,
}: {
    color: string;
    isActive: boolean;
    groupRef: React.RefObject<THREE.Group | null>;
}) {
    const lineRef = useRef<THREE.Line>(null);
    const geoRef = useRef<THREE.BufferGeometry>(null);

    useFrame(() => {
        if (!geoRef.current || !groupRef.current) return;
        const pos = groupRef.current.position;
        const positions = new Float32Array([0, 0, 0, -pos.x, -pos.y, -pos.z]);
        geoRef.current.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    });

    return (
        <line ref={lineRef as any}>
            <bufferGeometry ref={geoRef} />
            <lineBasicMaterial color={color} transparent opacity={isActive ? 0.3 : 0.08} />
        </line>
    );
}

// ─── Single Agent Node ─────────────────────────────────────────────────────

function AgentNode({
    agent,
    visual,
    index,
    total,
    activeIndex,
    onSelect,
}: {
    agent: (typeof siteConfig.agents)[number];
    visual: (typeof AGENT_VISUALS)[number];
    index: number;
    total: number;
    activeIndex: number;
    onSelect: (i: number) => void;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const wireRef = useRef<THREE.Mesh>(null);
    const trailRef = useRef<THREE.Points>(null);

    const isActive = activeIndex === index;

    // Keyframe-style orbital animation
    const baseAngle = (index / total) * Math.PI * 2;

    // Trail particles
    const trailPositions = useMemo(() => {
        const count = 30;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = 0;
            pos[i * 3 + 1] = 0;
            pos[i * 3 + 2] = 0;
        }
        return pos;
    }, []);

    const trailHistory = useRef<THREE.Vector3[]>([]);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();

        if (groupRef.current) {
            // Smooth orbital keyframe animation
            const angle = baseAngle + t * visual.orbitSpeed;
            const r = visual.orbitRadius;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const y = visual.yOffset + Math.sin(t * 0.8 + index) * 0.4;

            groupRef.current.position.set(x, y, z);

            // Store trail positions
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);
            trailHistory.current.push(worldPos.clone());
            if (trailHistory.current.length > 30) trailHistory.current.shift();

            // Update trail geometry
            if (trailRef.current) {
                const geo = trailRef.current.geometry;
                const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
                trailHistory.current.forEach((p, i) => {
                    posAttr.setXYZ(i, p.x, p.y, p.z);
                });
                posAttr.needsUpdate = true;
            }
        }

        // Agent self-rotation + scale animation
        if (meshRef.current) {
            meshRef.current.rotation.y = t * 1.5 + index * 0.5;
            meshRef.current.rotation.x = t * 0.6;
            const targetScale = isActive ? 1.5 : 1;
            meshRef.current.scale.lerp(
                new THREE.Vector3(targetScale, targetScale, targetScale),
                0.08
            );
        }
        if (wireRef.current) {
            wireRef.current.rotation.y = -t * 0.8;
            wireRef.current.rotation.z = t * 0.3;
            const targetScale = isActive ? 1.8 : 1.3;
            wireRef.current.scale.lerp(
                new THREE.Vector3(targetScale, targetScale, targetScale),
                0.08
            );
        }
    });

    return (
        <>
            {/* Trail particles */}
            <points ref={trailRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[trailPositions, 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    color={visual.color}
                    size={0.03}
                    transparent
                    opacity={0.4}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    sizeAttenuation
                />
            </points>

            <group ref={groupRef}>
                {/* Connection beam to center - rendered as a simple line */}
                <ConnectionBeam color={visual.color} isActive={isActive} groupRef={groupRef} />

                <group
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(index);
                    }}
                    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
                    onPointerOut={() => { document.body.style.cursor = "auto"; }}
                >
                    {/* Main agent body */}
                    <mesh ref={meshRef} castShadow>
                        <AgentGeometry shape={visual.shape} />
                        <MeshDistortMaterial
                            color={visual.color}
                            speed={isActive ? 3 : 1.5}
                            distort={isActive ? 0.35 : 0.15}
                            radius={0.4}
                            emissive={visual.emissive}
                            emissiveIntensity={isActive ? 2.5 : 0.6}
                            metalness={0.9}
                            roughness={0.1}
                            transparent
                            opacity={0.95}
                        />
                    </mesh>

                    {/* Wireframe overlay */}
                    <mesh ref={wireRef}>
                        <AgentGeometry shape={visual.shape} size={0.4} />
                        <meshBasicMaterial
                            color={visual.color}
                            wireframe
                            transparent
                            opacity={isActive ? 0.5 : 0.2}
                        />
                    </mesh>

                    {/* Agent Label */}
                    <Html
                        center
                        position={[0, -0.9, 0]}
                        distanceFactor={10}
                        style={{ pointerEvents: "none" }}
                    >
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-500 select-none whitespace-nowrap"
                            style={{
                                background: isActive ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.5)",
                                backdropFilter: "blur(12px)",
                                border: `1px solid ${isActive ? visual.color : "rgba(255,255,255,0.08)"}`,
                                boxShadow: isActive ? `0 0 20px ${visual.color}33` : "none",
                                opacity: isActive ? 1 : 0.6,
                                transform: `scale(${isActive ? 1.1 : 0.9})`,
                            }}
                        >
                            <span className="text-base">{agent.icon}</span>
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.15em]">
                                {agent.name}
                            </span>
                            {isActive && (
                                <div
                                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                                    style={{ background: visual.color }}
                                />
                            )}
                        </div>
                    </Html>
                </group>
            </group>
        </>
    );
}

// ─── Ground Platform ───────────────────────────────────────────────────────

function StagePlatform() {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (ringRef.current) {
            ringRef.current.rotation.z = t * 0.1;
        }
    });

    return (
        <group position={[0, -2.5, 0]}>
            {/* Floor grid ring */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 5, 64]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.04} side={THREE.DoubleSide} />
            </mesh>

            {/* Outer edge ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[5, 0.01, 16, 128]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.008, 16, 128]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.1} />
            </mesh>

            {/* Contact shadow for realism */}
            <ContactShadows
                position={[0, -0.01, 0]}
                opacity={0.4}
                scale={15}
                blur={2.5}
                far={4}
                color="#06b6d4"
            />
        </group>
    );
}

// ─── Auto-Rotating Camera ──────────────────────────────────────────────────

function AutoCamera({ isPaused }: { isPaused: boolean }) {
    const { camera } = useThree();
    const angleRef = useRef(0);
    const targetRef = useRef(new THREE.Vector3(0, 0, 0));

    useFrame((state, delta) => {
        if (!isPaused) {
            angleRef.current += delta * 0.15; // Slow auto-rotation like Littlest Tokyo
        }

        const radius = 10;
        const height = 3;
        const targetX = Math.cos(angleRef.current) * radius;
        const targetZ = Math.sin(angleRef.current) * radius;

        // Smooth camera interpolation
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.02);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.02);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, height, 0.02);

        camera.lookAt(targetRef.current);
    });

    return null;
}

// ─── Info Panel ────────────────────────────────────────────────────────────

function InfoPanel({
    agent,
    visual,
    index,
}: {
    agent: (typeof siteConfig.agents)[number];
    visual: (typeof AGENT_VISUALS)[number];
    index: number;
}) {
    return (
        <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none"
            style={{ width: "min(90vw, 500px)" }}
        >
            <div
                className="p-6 rounded-2xl backdrop-blur-2xl transition-all duration-700"
                style={{
                    background: "rgba(10, 10, 18, 0.85)",
                    border: `1px solid ${visual.color}33`,
                    boxShadow: `0 0 60px ${visual.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
            >
                <div className="flex items-center gap-4 mb-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{
                            background: `${visual.color}20`,
                            border: `1px solid ${visual.color}40`,
                        }}
                    >
                        {agent.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white uppercase tracking-[0.15em]">
                                {agent.name}
                            </span>
                            <span
                                className="text-[8px] font-bold uppercase tracking-[0.3em] px-2 py-0.5 rounded-full"
                                style={{
                                    background: `${visual.color}20`,
                                    color: visual.color,
                                    border: `1px solid ${visual.color}30`,
                                }}
                            >
                                Agent 0{index + 1}
                            </span>
                        </div>
                        <span className="text-[9px] text-white/30 font-bold uppercase tracking-[0.3em]">
                            Status: Active
                        </span>
                    </div>
                    <div
                        className="ml-auto w-2 h-2 rounded-full animate-pulse"
                        style={{ background: visual.color, boxShadow: `0 0 8px ${visual.color}` }}
                    />
                </div>
                <p className="text-xs text-white/50 leading-relaxed font-medium">
                    {agent.description}
                </p>
            </div>
        </div>
    );
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
    const total = siteConfig.agents.length;

    return (
        <>
            <AutoCamera isPaused={isPaused} />

            {/* Lighting — soft and cinematic */}
            <ambientLight intensity={0.15} />
            <pointLight position={[10, 8, 10]} intensity={1.5} color="#ffffff" />
            <pointLight position={[-10, 5, -10]} intensity={1} color="#06b6d4" />
            <spotLight
                position={[0, 15, 0]}
                angle={0.5}
                penumbra={1}
                intensity={2}
                color="#06b6d4"
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
            />

            {/* Ambient particles */}
            <Sparkles
                count={200}
                scale={15}
                size={1.5}
                speed={0.3}
                opacity={0.15}
                color="#06b6d4"
            />

            {/* Central Hub */}
            <CentralCore />

            {/* Stage Platform */}
            <StagePlatform />

            {/* Agent Nodes */}
            {siteConfig.agents.map((agent, i) => (
                <AgentNode
                    key={agent.name}
                    agent={agent}
                    visual={AGENT_VISUALS[i]}
                    index={i}
                    total={total}
                    activeIndex={activeIndex}
                    onSelect={(idx) => {
                        setActiveIndex(idx);
                        setIsPaused(true);
                        setTimeout(() => setIsPaused(false), 8000);
                    }}
                />
            ))}

            {/* Fog for depth */}
            <fog attach="fog" args={["#0a0a12", 12, 30]} />
        </>
    );
}

// ─── Agent Indicator Dots ──────────────────────────────────────────────────

function AgentDots({
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
            <div className="flex gap-3 p-2 rounded-xl bg-black/40 border border-white/10 backdrop-blur-xl">
                {siteConfig.agents.map((ag, i) => (
                    <button
                        key={i}
                        onClick={() => {
                            setActiveIndex(i);
                            setIsPaused(true);
                            setTimeout(() => setIsPaused(false), 8000);
                        }}
                        className="relative group cursor-pointer"
                        title={ag.name}
                    >
                        <div
                            className="w-6 h-6 rounded-full transition-all duration-500 flex items-center justify-center text-[10px]"
                            style={{
                                background: activeIndex === i ? AGENT_VISUALS[i].color : "rgba(255,255,255,0.08)",
                                boxShadow: activeIndex === i ? `0 0 12px ${AGENT_VISUALS[i].color}` : "none",
                                transform: activeIndex === i ? "scale(1.2)" : "scale(1)",
                            }}
                        >
                            {ag.icon}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/95 text-[8px] text-white opacity-0 group-hover:opacity-100 rounded-md pointer-events-none whitespace-nowrap border border-white/10 font-black uppercase tracking-[0.15em] transition-all">
                            {ag.name}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Export ─────────────────────────────────────────────────────────────────

export default function AgentShowcase3D() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const total = siteConfig.agents.length;

    // Auto-cycle through agents
    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % total);
        }, 5000);
        return () => clearInterval(interval);
    }, [isPaused, total]);

    return (
        <div className="relative w-full h-[700px] bg-[#0a0a12]">
            {/* Agent selector dots */}
            <AgentDots
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                setIsPaused={setIsPaused}
            />

            {/* Three.js Canvas */}
            <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{
                    antialias: true,
                    alpha: false,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.2,
                    powerPreference: "high-performance",
                }}
                camera={{ position: [10, 3, 0], fov: 35, near: 0.1, far: 100 }}
            >
                <color attach="background" args={["#0a0a12"]} />
                <Scene
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    isPaused={isPaused}
                    setIsPaused={setIsPaused}
                />
            </Canvas>

            {/* Info Panel (DOM overlay) */}
            <InfoPanel
                agent={siteConfig.agents[activeIndex]}
                visual={AGENT_VISUALS[activeIndex]}
                index={activeIndex}
            />
        </div>
    );
}
