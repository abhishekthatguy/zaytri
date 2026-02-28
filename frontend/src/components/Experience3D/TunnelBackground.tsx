"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

export function TunnelStars() {
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
        const scroll = typeof window !== 'undefined' ? window.scrollY : 0;

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

export function DataPulse() {
    const ref = useRef<THREE.Group>(null);
    const rings = 12;
    const tunnelLength = 200;

    useFrame((state) => {
        if (!ref.current) return;
        const time = state.clock.getElapsedTime();
        const scroll = typeof window !== 'undefined' ? window.scrollY : 0;
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
