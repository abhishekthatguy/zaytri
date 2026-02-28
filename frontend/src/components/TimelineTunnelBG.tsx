"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

function TunnelStars() {
    const ref = useRef<THREE.Points>(null);
    const starCount = 3000;
    const tunnelLength = 400;

    const positions = useMemo(() => {
        const pos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 30;
            pos[i * 3] = Math.cos(angle) * radius;
            pos[i * 3 + 1] = Math.sin(angle) * radius;
            pos[i * 3 + 2] = Math.random() * tunnelLength - tunnelLength / 2;
        }
        return pos;
    }, []);

    useFrame((state) => {
        if (!ref.current) return;
        const time = state.clock.getElapsedTime();
        const scrollRoot = document.getElementById("landing-scroll-root");
        const scroll = scrollRoot ? scrollRoot.scrollTop : 0;
        const speed = 15 + (scroll * 0.02);
        const zOffset = (time * speed) % tunnelLength;
        ref.current.position.z = zOffset;
        ref.current.rotation.z = time * 0.05;
    });

    return (
        <Points ref={ref} positions={positions} stride={3}>
            <PointMaterial
                transparent
                color="#06b6d4"
                size={0.15}
                sizeAttenuation={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.4}
            />
        </Points>
    );
}

function DataPulse() {
    const ref = useRef<THREE.Group>(null);
    const rings = 12;
    const tunnelLength = 200;

    useFrame((state) => {
        if (!ref.current) return;
        const time = state.clock.getElapsedTime();
        const scrollRoot = document.getElementById("landing-scroll-root");
        const scroll = scrollRoot ? scrollRoot.scrollTop : 0;
        const speed = 40 + (scroll * 0.1);

        ref.current.children.forEach((child, i) => {
            const offset = (i / rings) * tunnelLength;
            const z = ((time * speed + offset) % tunnelLength) - tunnelLength / 2;
            child.position.z = z;
            const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
            const dist = Math.abs(z);
            material.opacity = Math.max(0, (1 - dist / (tunnelLength / 2)) * 0.15);
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
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(true);

    // Use IntersectionObserver to detect when the tunnel is scrolled off-screen
    // This frees the WebGL context for the Agent Showcase below
    useEffect(() => {
        if (!containerRef.current) return;

        const scrollRoot = document.getElementById("landing-scroll-root");
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                root: scrollRoot,
                threshold: 0,
                rootMargin: "200px", // Extra margin for smooth transitions
            }
        );

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className="sticky top-0 left-0 w-full h-screen z-0 pointer-events-none bg-[#0a0a12]"
            style={{ marginBottom: "-100vh" }}
        >
            {isVisible && (
                <Canvas
                    camera={{ position: [0, 0, 5], fov: 75 }}
                    gl={{
                        alpha: false,
                        antialias: false,
                        powerPreference: "high-performance",
                        preserveDrawingBuffer: false,
                    }}
                    dpr={1}
                >
                    <color attach="background" args={["#0a0a12"]} />
                    <fog attach="fog" args={["#0a0a12", 5, 60]} />
                    <TunnelStars />
                    <DataPulse />
                    <ambientLight intensity={1} />
                </Canvas>
            )}

            {/* Visual Overlays for Tunnel Depth */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a12_90%)]" />

            {/* Horizontal scanline effect */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: "linear-gradient(transparent 50%, #06b6d4 50%)",
                    backgroundSize: "100% 4px",
                }}
            />
        </div>
    );
}
