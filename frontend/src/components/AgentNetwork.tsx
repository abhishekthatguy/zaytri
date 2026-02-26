"use client";

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
    Float,
    Sphere,
    Line,
    PerspectiveCamera,
    OrbitControls,
    Html,
    MeshDistortMaterial
} from "@react-three/drei";
import * as THREE from "three";

const agents = [
    { id: "master", name: "Master Agent", pos: [0, 0, 0], color: "#06b6d4", size: 0.6, icon: "🧠" },
    { id: "content", name: "Content Creator", pos: [2.5, 1.2, -0.8], color: "#f472b6", size: 0.25, icon: "📝" },
    { id: "hashtag", name: "Hashtag Agent", pos: [2.5, -1.2, 0.8], color: "#a78bfa", size: 0.25, icon: "#️⃣" },
    { id: "review", name: "Review Agent", pos: [-2.5, 1.5, 0.8], color: "#34d399", size: 0.25, icon: "🔍" },
    { id: "publisher", name: "Publisher Bot", pos: [-2.5, -0.8, -1.5], color: "#fbbf24", size: 0.25, icon: "🚀" },
    { id: "engagement", name: "Engagement Bot", pos: [0, 2.5, 1.5], color: "#60a5fa", size: 0.25, icon: "💬" },
];

function Connection({ start, end, active }: { start: [number, number, number], end: [number, number, number], active: boolean }) {
    const lineRef = useRef<any>(null);

    useFrame((state) => {
        if (lineRef.current?.material) {
            const t = state.clock.getElapsedTime();
            if (active) {
                lineRef.current.material.dashOffset -= 0.01;
                lineRef.current.material.opacity = 0.4 + Math.sin(t * 10) * 0.2;
            } else {
                lineRef.current.material.opacity = 0.05;
            }
        }
    });

    return (
        <Line
            ref={lineRef}
            points={[start, end]}
            color="#06b6d4"
            lineWidth={active ? 1.5 : 0.8}
            dashed={true}
            dashScale={5}
            dashSize={0.5}
            gapSize={0.2}
            transparent
            opacity={0.1}
        />
    );
}

function NeuralCore({ active, scrollProgress }: { active: boolean, scrollProgress: number }) {
    const coreRef = useRef<THREE.Group>(null);
    const outerRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (coreRef.current) {
            coreRef.current.rotation.z = t * 0.2;
            coreRef.current.rotation.y = t * 0.1;
        }
        if (outerRef.current) {
            outerRef.current.rotation.x = -t * 0.15;
        }
    });

    const coreLabels = [
        { text: "RAG Memory", pos: [1.2, 0.8, 0], threshold: 0.1 },
        { text: "LLM Router", pos: [-1.2, 0.8, 0], threshold: 0.2 },
        { id: "multi", text: "Multi Brand", pos: [1.2, -0.8, 0], threshold: 0.3 },
        { text: "WhatsApp Approval", pos: [-1.4, -0.8, 0], threshold: 0.4 },
        { text: "Publishing Engine", pos: [0, 1.4, 0], threshold: 0.5 },
    ];

    return (
        <group position={[0, 0, 0]}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                {/* Inner Core */}
                <group ref={coreRef}>
                    <Sphere args={[0.6, 32, 32]}>
                        <MeshDistortMaterial
                            color="#06b6d4"
                            speed={3}
                            distort={0.4}
                            radius={0.6}
                            emissive="#06b6d4"
                            emissiveIntensity={1.5}
                        />
                    </Sphere>
                </group>

                {/* Outer Neural Ring */}
                <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.9, 0.02, 16, 100]} />
                    <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} />
                </mesh>

                {/* The "Brain" Icon */}
                <Html center position={[0, 0, 0]}>
                    <div style={{
                        fontSize: "32px",
                        filter: "drop-shadow(0 0 15px #06b6d4)",
                        zIndex: -1
                    }}>🧠</div>
                </Html>
            </Float>

            {/* Scroll-triggered Labels */}
            {coreLabels.map((label, i) => (
                <Html
                    key={i}
                    position={label.pos as [number, number, number]}
                    center
                    style={{
                        transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                        opacity: scrollProgress > label.threshold ? 1 : 0,
                        transform: `scale(${scrollProgress > label.threshold ? 1 : 0.5}) translateY(${scrollProgress > label.threshold ? 0 : 20}px)`,
                        pointerEvents: "none",
                    }}
                >
                    <div style={{
                        background: "rgba(6, 182, 212, 0.1)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(6, 182, 212, 0.4)",
                        color: "#22d3ee",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "10px",
                        fontWeight: "900",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        whiteSpace: "nowrap",
                        boxShadow: "0 0 20px rgba(6, 182, 212, 0.2)"
                    }}>
                        {label.text}
                    </div>
                </Html>
            ))}
        </group>
    );
}

function AgentNode({ agent, active }: { agent: any, active: boolean }) {
    if (agent.id === "master") return null; // Handled by NeuralCore separately for better logic control

    const meshRef = useRef<THREE.Mesh>(null);
    const wireRef = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);
    const particles = useMemo(() => {
        const pos = new Float32Array(60);
        for (let i = 0; i < 60; i++) pos[i] = (Math.random() - 0.5) * 1.5;
        return pos;
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            const scale = active ? 1.1 + Math.sin(t * 8) * 0.05 : 1;
            meshRef.current.scale.set(scale, scale, scale);
            meshRef.current.rotation.y += active ? 0.02 : 0.005;
            meshRef.current.rotation.x += active ? 0.01 : 0.002;
        }
        if (wireRef.current) {
            wireRef.current.rotation.y -= 0.01;
            wireRef.current.scale.set(1.2, 1.2, 1.2);
        }
    });

    const Geometry = useMemo(() => {
        switch (agent.id) {
            case "content": return <boxGeometry args={[agent.size * 1.5, agent.size * 1.5, agent.size * 1.5]} />;
            case "hashtag": return <coneGeometry args={[agent.size, agent.size * 1.5, 4]} />;
            case "review": return <octahedronGeometry args={[agent.size, 0]} />;
            case "publisher": return <torusGeometry args={[agent.size * 0.8, 0.1, 12, 24]} />;
            case "engagement": return <dodecahedronGeometry args={[agent.size, 0]} />;
            default: return <sphereGeometry args={[agent.size, 16, 16]} />;
        }
    }, [agent.id, agent.size]);

    return (
        <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8} position={agent.pos}>
            <group
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
            >
                {/* Main Body */}
                <mesh ref={meshRef}>
                    {Geometry}
                    <meshStandardMaterial
                        color={active || hovered ? agent.color : "#444"}
                        emissive={active || hovered ? agent.color : "#000"}
                        emissiveIntensity={active ? 1 : 0.1}
                        metalness={0.9}
                        roughness={0.1}
                        transparent
                        opacity={active ? 0.4 : 0.1}
                    />
                </mesh>

                {/* Processing Wireframe */}
                <mesh ref={wireRef} visible={active || hovered}>
                    {Geometry}
                    <meshBasicMaterial
                        color={agent.color}
                        wireframe
                        transparent
                        opacity={active ? 0.3 : 0.1}
                    />
                </mesh>

                {/* Glow Sphere */}
                <Sphere args={[agent.size * 1.4, 12, 12]}>
                    <meshBasicMaterial
                        color={agent.color}
                        transparent
                        opacity={active ? 0.12 : 0.02}
                    />
                </Sphere>

                {/* Floating Data Particles */}
                {active && (
                    <points>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                args={[particles, 3]}
                            />
                        </bufferGeometry>
                        <pointsMaterial color={agent.color} size={0.03} transparent opacity={0.6} sizeAttenuation />
                    </points>
                )}

                <Html
                    position={[0, 0, 0]}
                    center
                    distanceFactor={6}
                    style={{
                        fontSize: "16px",
                        pointerEvents: "none",
                        opacity: active ? 1 : 0.6,
                        filter: active ? `drop-shadow(0 0 10px ${agent.color})` : "none",
                        transition: "all 0.5s ease"
                    }}
                >
                    {agent.icon}
                </Html>

                <Html
                    position={[0, agent.size + 0.45, 0]}
                    center
                    distanceFactor={8}
                    style={{
                        color: "white",
                        fontSize: "9px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        textShadow: "0 0 10px rgba(0,0,0,0.8)",
                        opacity: active ? 0.8 : 0.2,
                        transition: "all 0.5s",
                        fontFamily: "Inter, system-ui, sans-serif"
                    }}
                >
                    {agent.name}
                </Html>
            </group>
        </Float>
    );
}

function Scene({ scrollProgress }: { scrollProgress: number }) {
    const [activeStep, setActiveStep] = useState(0);
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (groupRef.current) {
            groupRef.current.rotation.y = t * 0.08;
        }
        const step = Math.floor((t / 3) % 6);
        if (step !== activeStep) setActiveStep(step);
    });

    return (
        <group ref={groupRef}>
            <NeuralCore active={activeStep === 0} scrollProgress={scrollProgress} />

            {agents.map((agent, i) => {
                if (agent.id === "master") return null;
                const isActive = activeStep === i;
                const isMaster = agent.id === "master";

                return (
                    <React.Fragment key={agent.id}>
                        <AgentNode
                            agent={agent}
                            active={isActive}
                        />
                        <Connection
                            start={[0, 0, 0]}
                            end={agent.pos as [number, number, number]}
                            active={isActive}
                        />
                    </React.Fragment>
                );
            })}
        </group>
    );
}

export default function AgentNetwork() {
    const [scrollProgress, setScrollProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const h = document.documentElement,
                b = document.body,
                st = 'scrollTop',
                sh = 'scrollHeight';
            const progress = (h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight);
            setScrollProgress(progress);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
            <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, 10], fov: 45 }}
                gl={{ antialias: true, alpha: true, stencil: false, depth: true }}
                style={{ width: "100%", height: "100%" }}
            >
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={0.8} />
                <pointLight position={[-10, -10, -10]} color="#06b6d4" intensity={0.4} />

                <Scene scrollProgress={scrollProgress} />

                <OrbitControls enableZoom={false} enablePan={false} />
            </Canvas>

            {/* Premium Background Overlays */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0a0a12]/20 via-transparent to-[#0a0a12]" />
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a12_80%)] opacity-60" />
        </div>
    );
}
