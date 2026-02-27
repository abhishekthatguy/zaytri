"use client";

import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    Float,
    Line,
    Html,
    MeshDistortMaterial,
    PerspectiveCamera,
    OrbitControls,
    Float as Floating,
    Sphere,
} from "@react-three/drei";
import * as THREE from "three";
import { siteConfig } from "@/lib/siteConfig";

const MODULE_COLORS = [
    "#06b6d4", // Cyan
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#6366f1", // Indigo
];

function Module3D({ feature, index, total, activeIndex, setActiveIndex }: any) {
    const meshRef = useRef<THREE.Mesh>(null);
    const orbitRef = useRef<THREE.Group>(null);

    const angle = (index / total) * Math.PI * 2;
    const radius = 6;
    const position: [number, number, number] = [
        Math.cos(angle) * radius,
        Math.sin(index * 0.5) * 1.5,
        Math.sin(angle) * radius
    ];

    const isActive = activeIndex === index;

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.rotation.y = t * 0.5 + index;
            const s = isActive ? 1.5 : 1;
            meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
        }
    });

    const IconGeometry = useMemo(() => {
        const s = 0.5;
        switch (index % 4) {
            case 0: return <octahedronGeometry args={[s]} />;
            case 1: return <icosahedronGeometry args={[s]} />;
            case 2: return <boxGeometry args={[s, s, s]} />;
            case 3: return <dodecahedronGeometry args={[s]} />;
            default: return <sphereGeometry args={[s, 32, 32]} />;
        }
    }, [index]);

    return (
        <group position={position}>
            <Floating speed={1.5} rotationIntensity={1} floatIntensity={1}>
                {/* Visual Representation */}
                <mesh
                    ref={meshRef}
                    onClick={() => setActiveIndex(index)}
                    onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                    onPointerOut={() => { document.body.style.cursor = 'auto'; }}
                >
                    {IconGeometry}
                    <MeshDistortMaterial
                        color={MODULE_COLORS[index]}
                        speed={isActive ? 3 : 1}
                        distort={0.2}
                        radius={0.5}
                        emissive={MODULE_COLORS[index]}
                        emissiveIntensity={isActive ? 1 : 0.2}
                    />
                </mesh>

                {/* Connection to center */}
                <Line
                    points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(-position[0], -position[1], -position[2])]}
                    color={MODULE_COLORS[index]}
                    lineWidth={1}
                    transparent
                    opacity={isActive ? 0.6 : 0.1}
                />

                {/* Description Label */}
                <Html
                    position={[0, -1.2, 0]}
                    center
                    style={{
                        pointerEvents: 'none',
                        transition: 'all 0.5s ease'
                    }}
                >
                    <div
                        className={`flex flex-col items-center text-center w-48 transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-40 scale-90'
                            }`}
                    >
                        <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl">
                            <span className="text-xl mb-1 block">{feature.icon}</span>
                            <h4 className="text-xs font-black text-white uppercase tracking-tighter mb-1">
                                {feature.title}
                            </h4>
                            {isActive && (
                                <p className="text-[10px] text-white/60 leading-tight">
                                    {feature.description}
                                </p>
                            )}
                        </div>
                    </div>
                </Html>
            </Floating>
        </group>
    );
}

function Core() {
    const coreRef = useRef<THREE.Mesh>(null);
    const ringRef1 = useRef<THREE.Mesh>(null);
    const ringRef2 = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (coreRef.current) {
            coreRef.current.rotation.y = t * 0.2;
            coreRef.current.rotation.z = t * 0.1;
        }
        if (ringRef1.current) ringRef1.current.rotation.y = -t * 0.5;
        if (ringRef2.current) ringRef2.current.rotation.x = t * 0.5;
    });

    return (
        <group>
            {/* Pulsing Core */}
            <mesh ref={coreRef}>
                <icosahedronGeometry args={[1.5, 1]} />
                <meshStandardMaterial
                    color="#06b6d4"
                    wireframe
                    transparent
                    opacity={0.3}
                    emissive="#06b6d4"
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Inner Solid Core */}
            <Sphere args={[0.8, 32, 32]}>
                <MeshDistortMaterial
                    color="#06b6d4"
                    speed={2}
                    distort={0.4}
                    radius={0.8}
                    emissive="#06b6d4"
                    emissiveIntensity={1}
                />
            </Sphere>

            {/* Orbital Rings */}
            <mesh ref={ringRef1} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[2.5, 0.02, 16, 100]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.2} />
            </mesh>
            <mesh ref={ringRef2}>
                <torusGeometry args={[3, 0.02, 16, 100]} />
                <meshBasicMaterial color="#8b5cf6" transparent opacity={0.2} />
            </mesh>

            <Html center>
                <div className="text-center select-none pointer-events-none">
                    <h3 className="text-sm font-black text-cyan-400 uppercase tracking-[0.3em]">
                        AI ENGINE
                    </h3>
                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
                        Core Architecture
                    </div>
                </div>
            </Html>
        </group>
    );
}

function ArchitectureScene() {
    const [activeIndex, setActiveIndex] = useState<number | null>(0);

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={40} />
            <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.5}
            />

            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <spotLight position={[-10, 15, 10]} angle={0.3} intensity={2} color="#06b6d4" />

            <Core />

            <group>
                {siteConfig.features.map((feature, i) => (
                    <Module3D
                        key={feature.title}
                        feature={feature}
                        index={i}
                        total={siteConfig.features.length}
                        activeIndex={activeIndex}
                        setActiveIndex={setActiveIndex}
                    />
                ))}
            </group>
        </>
    );
}

export default function Architecture3D() {
    return (
        <div className="w-full h-full relative">
            {/* Technical Overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent" />

            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <ArchitectureScene />
            </Canvas>

            {/* Bottom Guide */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <p className="text-[10px] text-white/30 uppercase tracking-[0.4em] font-bold">
                    Click node to explore architecture components
                </p>
            </div>
        </div>
    );
}
