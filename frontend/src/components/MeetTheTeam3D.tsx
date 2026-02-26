"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    Float,
    Sphere,
    Line,
    Html,
    MeshDistortMaterial,
    PerspectiveCamera,
    OrbitControls,
    Text,
} from "@react-three/drei";
import * as THREE from "three";
import { siteConfig } from "@/lib/siteConfig";

const AGENT_COLORS = [
    "#22d3ee", // Cyan-400
    "#c084fc", // Purple-400
    "#fb7185", // Rose-400
    "#38bdf8", // Sky-400
    "#818cf8", // Indigo-400
    "#2dd4bf", // Teal-400
    "#a78bfa", // Violet-400
];

const AGENT_GEOMETRIES = [
    "octahedron",
    "icosahedron",
    "dodecahedron",
    "box",
    "cone",
    "torus",
    "sphere"
];

function Agent3D({ agent, index, total, position, activeIndex, setActiveIndex, hoveredIndex, setHoveredIndex }: any) {
    const meshRef = useRef<THREE.Mesh>(null);
    const wireRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    const isActive = activeIndex === index;
    const isHovered = hoveredIndex === index;

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.rotation.y = t * 0.5 + index;
            meshRef.current.rotation.x = t * 0.2;
            const s = isActive ? 1.4 : isHovered ? 1.2 : 0.8;
            meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
        }
        if (wireRef.current) {
            wireRef.current.rotation.y = -t * 0.3;
            wireRef.current.rotation.x = t * 0.1;
        }
    });

    const Geometry = useMemo(() => {
        const size = 0.3;
        switch (AGENT_GEOMETRIES[index % AGENT_GEOMETRIES.length]) {
            case "box": return <boxGeometry args={[size, size, size]} />;
            case "cone": return <coneGeometry args={[size * 0.8, size * 1.2, 32]} />;
            case "octahedron": return <octahedronGeometry args={[size]} />;
            case "torus": return <torusGeometry args={[size * 0.6, 0.1, 16, 32]} />;
            case "dodecahedron": return <dodecahedronGeometry args={[size]} />;
            case "icosahedron": return <icosahedronGeometry args={[size]} />;
            default: return <sphereGeometry args={[size, 32, 32]} />;
        }
    }, [index]);

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5} position={position}>
            <group
                onPointerOver={() => {
                    setHoveredIndex(index);
                    document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                    setHoveredIndex(null);
                    document.body.style.cursor = "auto";
                }}
                onClick={() => setActiveIndex(index)}
            >

                {/* Main Node Body */}
                <mesh ref={meshRef}>
                    {Geometry}
                    <MeshDistortMaterial
                        color={AGENT_COLORS[index]}
                        speed={isActive ? 2 : 1}
                        distort={isActive ? 0.4 : 0.1}
                        radius={0.3}
                        emissive={AGENT_COLORS[index]}
                        emissiveIntensity={isActive ? 1.5 : 0.2}
                        metalness={0.9}
                        roughness={0.1}
                        transparent
                        opacity={isActive || isHovered ? 1 : 0.7}
                    />
                </mesh>

                {/* Technical Wireframe overlay */}
                <mesh ref={wireRef}>
                    {Geometry}
                    <meshBasicMaterial
                        color={AGENT_COLORS[index]}
                        wireframe
                        transparent
                        opacity={isActive ? 0.9 : isHovered ? 0.6 : 0.4}
                    />
                </mesh>

                {/* Enterprise Label - Sleeker HTML */}
                <Html center position={[0, -1.2, 0]} distanceFactor={10}>
                    <div className="flex flex-col items-center pointer-events-none select-none">
                        <div
                            className="bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-lg flex items-center gap-3 transition-all duration-700"
                            style={{
                                opacity: isActive || isHovered ? 1 : 0.3,
                                transform: isActive ? "scale(1.1)" : "scale(1)",
                                boxShadow: isActive ? `0 0 40px ${AGENT_COLORS[index]}22` : "none",
                                borderColor: isActive ? AGENT_COLORS[index] : "rgba(255,255,255,0.1)"
                            }}
                        >
                            <span className="text-xl" style={{ filter: `drop-shadow(0 0 8px ${AGENT_COLORS[index]})` }}>
                                {agent.icon}
                            </span>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] leading-none mb-1">
                                    Agent ID: 0{index + 1}
                                </span>
                                <span className="text-sm font-black text-white whitespace-nowrap tracking-wide leading-none">
                                    {agent.name}
                                </span>
                            </div>
                            {isActive && (
                                <div className="ml-2 w-2 h-2 rounded-full bg-cyan-400 animate-pulse border border-cyan-400/50" />
                            )}
                        </div>
                    </div>
                </Html>

                {/* Production Capability Tags */}
                <Html center position={[0, 1.2, 0]} distanceFactor={12}>
                    <div
                        className="w-64 text-center transition-all duration-700 pointer-events-none select-none"
                        style={{
                            opacity: isActive ? 1 : isHovered ? 0.4 : 0,
                            transform: isActive ? "translateY(0)" : "translateY(10px)",
                        }}
                    >
                        <div className="inline-block bg-white/5 border border-white/10 px-3 py-1.5 rounded-full mb-3 backdrop-blur-md">
                            <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
                                Enterprise Readiness: Production
                            </span>
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed font-medium px-4">
                            {agent.description}
                        </p>
                    </div>
                </Html>
            </group>
        </Float>
    );
}

function OrbitalConnections({ total, radius }: { total: number; radius: number }) {
    const points = useMemo(() => {
        const p = [];
        for (let i = 0; i <= total; i++) {
            const angle = (i % total) * (Math.PI * 2 / total);
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius;
            const y = Math.sin((i % total) * 1.5) * 0.3;
            p.push(new THREE.Vector3(x, y, z));
        }
        return p;
    }, [total, radius]);

    return (
        <group>
            <Line
                points={points}
                color="rgba(6, 182, 212, 0.2)"
                lineWidth={0.5}
                transparent
                opacity={0.3}
            />
            {/* Inner web-like connections */}
            {points.map((p, i) => {
                const nextI = (i + 2) % total;
                const nextP = points[nextI];
                return (
                    <Line
                        key={i}
                        points={[p, nextP]}
                        color="rgba(6, 182, 212, 0.1)"
                        lineWidth={0.2}
                        transparent
                        opacity={0.15}
                    />
                );
            })}
        </group>
    );
}
function Scene() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [isPaused, setIsPaused] = useState(false);

    const orbitRef = useRef<THREE.Group>(null);
    const rotationRef = useRef(0);
    const targetRotationRef = useRef(0);

    const total = siteConfig.agents.length;

    useEffect(() => {
        if (isPaused) return;
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % total);
        }, 6000);
        return () => clearInterval(interval);
    }, [isPaused, total]);

    useFrame((state, delta) => {
        const t = state.clock.getElapsedTime();

        // Target rotation to bring active index to front (angle 0)
        // Since we place them at angle = i * (2PI/total), target is -angle
        targetRotationRef.current = -activeIndex * (Math.PI * 2 / total);

        // Smooth lerp
        rotationRef.current = THREE.MathUtils.lerp(
            rotationRef.current,
            targetRotationRef.current,
            delta * 2
        );

        if (orbitRef.current) {
            orbitRef.current.rotation.y = rotationRef.current;
            // Add subtle oscillation
            orbitRef.current.rotation.x = Math.sin(t * 0.4) * 0.05;
        }
    });

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 16]} fov={35} />
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={2} />
            <spotLight position={[-15, 20, 10]} angle={0.2} penumbra={1} intensity={3} color="#06b6d4" />

            <group ref={orbitRef}>
                <OrbitalConnections total={total} radius={5.5} />
                {siteConfig.agents.map((agent, i) => {
                    const angle = (i * (Math.PI * 2 / total));
                    const radius = 5.5;
                    const x = Math.sin(angle) * radius;
                    const z = Math.cos(angle) * radius;
                    const y = Math.sin(i * 1.5) * 0.3;

                    return (
                        <Agent3D
                            key={agent.name}
                            agent={agent}
                            index={i}
                            total={total}
                            position={[x, y, z]}
                            activeIndex={activeIndex}
                            setActiveIndex={(idx: number) => {
                                setActiveIndex(idx);
                                setIsPaused(true);
                                setTimeout(() => setIsPaused(false), 15000);
                            }}
                            hoveredIndex={hoveredIndex}
                            setHoveredIndex={setHoveredIndex}
                        />
                    );
                })}
            </group>

            <Html center position={[0, -4.5, 0]}>
                <div className="flex gap-4 p-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-2xl">
                    {siteConfig.agents.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setActiveIndex(i);
                                setIsPaused(true);
                            }}
                            className="w-5 h-5 rounded-full transition-all duration-300 relative group cursor-pointer"
                            style={{
                                background: activeIndex === i ? AGENT_COLORS[i] : "rgba(255,255,255,0.1)",
                                boxShadow: activeIndex === i ? `0 0 15px ${AGENT_COLORS[i]}` : "none",
                                transform: activeIndex === i ? "scale(1.3)" : "scale(1)"
                            }}
                        >
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/95 text-[9px] text-white opacity-0 group-hover:opacity-100 rounded-lg pointer-events-none whitespace-nowrap border border-white/10 font-black uppercase tracking-[0.2em] transition-all">
                                {siteConfig.agents[i].name}
                            </div>
                        </button>
                    ))}
                </div>
            </Html>
        </>
    );
}

export default function MeetTheTeam3D() {
    return (
        <div className="w-full h-[800px] relative mt-[-100px]">
            {/* Background Grid and Glow */}
            <div className="absolute inset-0 bg-[#0a0a12] [mask-image:radial-gradient(ellipse_at_center,black,transparent)] opacity-40" />

            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
                style={{ background: "transparent" }}
            >
                <Scene />
            </Canvas>
        </div>
    );
}
