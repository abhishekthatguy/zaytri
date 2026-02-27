"use client";

import React, { useEffect, useRef, useState } from "react";

interface RevealSectionProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    checkpoint?: string;
}

export default function RevealSection({
    children,
    className = "",
    delay = 0,
    checkpoint = ""
}: RevealSectionProps) {
    const [progress, setProgress] = useState(0);
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (!sectionRef.current) return;
            const rect = sectionRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const center = rect.top + rect.height / 2;
            const viewportCenter = windowHeight / 2;
            setProgress((center - viewportCenter) / viewportCenter);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const absProg = Math.abs(progress);

    // Visibility: Be extremely generous. Visible from -2 to 2.
    const opacity = Math.max(0, 1 - Math.pow(absProg / 1.5, 2));

    // Simplified Transform:
    // We will only use Z-move for "approaching"
    // When "passing", we will slide it UP and scale it UP
    const isApproaching = progress > 0;

    const translateZ = isApproaching ? -progress * 1000 : 0;
    const translateY = isApproaching ? 0 : progress * 300; // Slide up as it passes
    const scale = isApproaching ? (1 - progress * 0.3) : (1 + Math.abs(progress) * 0.8);

    return (
        <div
            ref={sectionRef}
            className={`relative w-full ${className}`}
            style={{
                opacity: opacity,
                transform: `perspective(1000px) translate3d(0, ${translateY}px, ${translateZ}px) scale(${scale})`,
                zIndex: isApproaching ? 10 : 20,
                pointerEvents: absProg < 0.5 ? 'auto' : 'none',
                visibility: opacity > 0 ? 'visible' : 'hidden',
                transition: "opacity 0.5s ease-out, transform 0.1s linear"
            }}
        >
            {checkpoint && (
                <div
                    className="absolute -top-32 left-1/2 -translate-x-1/2 whitespace-nowrap z-50 pointer-events-none"
                    style={{
                        opacity: opacity,
                        transform: `translateZ(50px)`
                    }}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-6">
                            <div className="h-[1px] w-16 bg-cyan-500/30" />
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.8em] drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                                {checkpoint}
                            </span>
                            <div className="h-[1px] w-16 bg-cyan-500/30" />
                        </div>
                        <div className="h-16 w-[1px] bg-gradient-to-b from-cyan-500 to-transparent" />
                    </div>
                </div>
            )}

            {/* Conditional Rendering of Heavy 3D based on Scroll Progress to prevent WebGL context loss */}
            <div className={`relative transition-all duration-1000 ${absProg < 1.5 ? 'opacity-100' : 'opacity-0'}`}>
                {absProg < 2 ? children : <div className="h-[500px]" />}
            </div>

            {/* Backdrop glow to ensure visibility against stars */}
            <div className="absolute inset-0 bg-black/40 blur-[100px] -z-10 rounded-[5rem] pointer-events-none" style={{ opacity: opacity * 0.5 }} />
        </div>
    );
}
