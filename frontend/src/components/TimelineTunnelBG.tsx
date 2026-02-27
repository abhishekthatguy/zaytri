"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Float } from "@react-three/drei";
import * as THREE from "three";

function TunnelStars() {
    const ref = useRef<THREE.Points>(null);
    const starCount = 1200;

    // Create a long tubular starfield
    const positions = useMemo(() => {
        const pos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            // Radial distribution to form a tunnel
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + Math.random() * 20;
            pos[i * 3] = Math.cos(angle) * radius;
            pos[i * 3 + 1] = Math.sin(angle) * radius;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 300; // Deep Z axis
        }
        return pos;
    }, []);

    useFrame((state) => {
        if (!ref.current) return;
        // Connect star movement to clock but allow scroll to accelerate it
        const scrollOffset = typeof window !== 'undefined' ? window.scrollY * 0.05 : 0;
        ref.current.position.z = (state.clock.getElapsedTime() * 10 + scrollOffset) % 100;
        ref.current.rotation.z = state.clock.getElapsedTime() * 0.02;
    });

    return (
        <Points ref={ref} positions={positions} stride={3}>
            <PointMaterial
                transparent
                color="#06b6d4"
                size={0.12}
                sizeAttenuation={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.6}
            />
        </Points>
    );
}

function DataPulse() {
    const ref = useRef<THREE.Group>(null);
    const rings = 10;

    useFrame((state) => {
        if (!ref.current) return;
        const scroll = typeof window !== 'undefined' ? window.scrollY * 0.1 : 0;
        ref.current.children.forEach((child, i) => {
            const speed = 20 + i * 5;
            child.position.z = ((state.clock.getElapsedTime() * speed + scroll) % 200) - 130;
            // Pulse opacity
            const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            material.opacity = Math.max(0, 0.1 - Math.abs(child.position.z) / 200);
        });
    });

    return (
        <group ref={ref}>
            {Array.from({ length: rings }).map((_, i) => (
                <mesh key={i} rotation={[0, 0, Math.random() * Math.PI]}>
                    <torusGeometry args={[8 + i * 0.5, 0.02, 16, 100]} />
                    <meshBasicMaterial color="#06b6d4" transparent opacity={0.1} />
                </mesh>
            ))}
        </group>
    );
}

export default function TimelineTunnelBG() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none bg-[#0a0a12]">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 75 }}
                gl={{
                    alpha: false,
                    antialias: false,
                    powerPreference: "high-performance",
                    preserveDrawingBuffer: false
                }}
                dpr={1} // Force lower DPR for stability on high-res screens
            >
                <color attach="background" args={["#0a0a12"]} />
                <fog attach="fog" args={["#0a0a12", 5, 60]} />
                <TunnelStars />
                <DataPulse />
                <ambientLight intensity={1} />
            </Canvas>

            {/* Visual Overlays for Tunnel Depth */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a12_90%)]" />

            {/* Horizontal scanline effect */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(transparent 50%, #06b6d4 50%)',
                    backgroundSize: '100% 4px'
                }}
            />
        </div>
    );
}
