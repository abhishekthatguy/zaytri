"use client";

import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import * as THREE from "three";

interface Section3DProps {
    title: string;
    description: string;
    position: [number, number, number];
    children?: React.ReactNode;
    // Refs passed from parent for imperative control
    groupRef: React.RefObject<THREE.Group | null>;
    planeRef: React.RefObject<THREE.Mesh | null>;
    borderRef: React.RefObject<THREE.Mesh | null>;
    htmlRef: React.RefObject<HTMLDivElement | null>;
}

export function Section3D({
    title,
    description,
    position,
    children,
    groupRef,
    planeRef,
    borderRef,
    htmlRef
}: Section3DProps) {

    // Subtle floating animation
    useFrame((state) => {
        if (groupRef.current) {
            const t = state.clock.getElapsedTime();
            groupRef.current.position.y += Math.sin(t * 0.5) * 0.002;
            groupRef.current.rotation.x = Math.cos(t * 0.3) * 0.02;
            groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.02;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
                {/* Background Glass Card */}
                <mesh ref={planeRef}>
                    <planeGeometry args={[10, 6]} />
                    <meshPhysicalMaterial
                        color="#ffffff"
                        metalness={0.1}
                        roughness={0.1}
                        transmission={0.6}
                        thickness={0.5}
                        transparent
                        opacity={0.15}
                        envMapIntensity={1}
                    />
                </mesh>

                {/* Border for the card */}
                <mesh ref={borderRef} position={[0, 0, -0.01]}>
                    <planeGeometry args={[10.1, 6.1]} />
                    <meshBasicMaterial color="#06b6d4" transparent opacity={0.1} />
                </mesh>

                {/* Content via Html component */}
                <Html
                    transform
                    distanceFactor={8}
                    position={[0, 0, 0.1]}
                    style={{
                        width: "800px",
                        transition: "opacity 0.2s ease-out",
                    }}
                >
                    <div
                        ref={htmlRef}
                        className="flex flex-col items-center justify-center text-center p-12 rounded-[3rem]"
                        style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            backdropFilter: "blur(20px)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                        }}
                    >
                        <h2 className="text-7xl font-black mb-6 text-white uppercase italic tracking-tighter">
                            {title.split(" ").map((word, i) => (
                                <span key={i} className={i % 2 === 1 ? "text-cyan-400" : ""}>
                                    {word}{" "}
                                </span>
                            ))}
                        </h2>
                        <p className="text-2xl text-white/50 font-bold uppercase tracking-[0.3em] leading-relaxed mb-8">
                            {description}
                        </p>
                        {children}
                    </div>
                </Html>
            </Float>
        </group>
    );
}
