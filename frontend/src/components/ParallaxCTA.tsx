"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";

export default function ParallaxCTA() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const zaytriRef = useRef<HTMLHeadingElement>(null);
    const ctaRef = useRef<HTMLHeadingElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(true);
        const scrollRoot = document.getElementById("landing-scroll-root");
        if (!scrollRoot || !sectionRef.current || !zaytriRef.current || !ctaRef.current || !glowRef.current) return;

        let rafId: number;

        // Smooth lerp values
        let currZY = 120, currZO = 0, currZS = 0.8;
        let currCY = 100, currCO = 0, currCS = 0.8;
        let currGS = 0.2, currGO = 0;

        const animate = () => {
            const section = sectionRef.current;
            const zaytri = zaytriRef.current;
            const cta = ctaRef.current;
            const glow = glowRef.current;
            if (!section || !zaytri || !cta || !glow) {
                rafId = requestAnimationFrame(animate);
                return;
            }

            const rect = section.getBoundingClientRect();
            const vh = window.innerHeight;

            // Progress 0 → 1 as the section scrolls into and through the viewport
            const raw = 1 - rect.top / vh;
            const progress = Math.max(0, Math.min(1, raw));

            // Easing
            const ease = (t: number) => 1 - Math.pow(1 - t, 3);

            // ZAYTRI: reveals from 15% to 50%
            const zP = ease(Math.max(0, Math.min(1, (progress - 0.15) / 0.35)));
            // TRY IT NOW: reveals from 40% to 75%
            const cP = ease(Math.max(0, Math.min(1, (progress - 0.40) / 0.35)));
            // Glow
            const gP = ease(Math.max(0, Math.min(1, (progress - 0.10) / 0.55)));

            // Targets
            const tZY = (1 - zP) * 120;
            const tZO = zP;
            const tZS = 0.8 + zP * 0.2;
            const tCY = (1 - cP) * 100;
            const tCO = cP;
            const tCS = 0.8 + cP * 0.2;
            const tGS = 0.2 + gP * 0.8;
            const tGO = gP * 0.5;

            // Lerp
            const L = 0.07;
            currZY += (tZY - currZY) * L;
            currZO += (tZO - currZO) * L;
            currZS += (tZS - currZS) * L;
            currCY += (tCY - currCY) * 0.05;
            currCO += (tCO - currCO) * 0.05;
            currCS += (tCS - currCS) * 0.05;
            currGS += (tGS - currGS) * 0.04;
            currGO += (tGO - currGO) * 0.04;

            zaytri.style.transform = `translate3d(0, ${currZY}px, 0) scale(${currZS})`;
            zaytri.style.opacity = String(currZO);

            cta.style.transform = `translate3d(0, ${currCY}px, 0) scale(${currCS})`;
            cta.style.opacity = String(currCO);

            glow.style.transform = `translate(-50%, -50%) scale(${currGS})`;
            glow.style.opacity = String(currGO);

            rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    }, [ready]);

    return (
        <section
            ref={sectionRef}
            className="relative z-20 w-full"
            style={{
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
        >
            {/* Ambient glow */}
            <div
                ref={glowRef}
                className="absolute pointer-events-none"
                style={{
                    top: "50%",
                    left: "50%",
                    width: "min(900px, 90vw)",
                    height: "min(900px, 90vw)",
                    borderRadius: "50%",
                    background:
                        "radial-gradient(circle, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.05) 40%, transparent 70%)",
                    transform: "translate(-50%, -50%) scale(0.2)",
                    opacity: 0,
                    willChange: "transform, opacity",
                }}
            />

            {/* Subtle grid */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.025]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(6,182,212,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.4) 1px, transparent 1px)",
                    backgroundSize: "80px 80px",
                }}
            />

            {/* Content */}
            <div
                className="relative flex flex-col items-center justify-center w-full"
                style={{ gap: "1.5rem" }}
            >
                {/* ZAYTRI */}
                <h2
                    ref={zaytriRef}
                    className="select-none w-full text-center"
                    style={{
                        fontSize: "clamp(3.5rem, 12vw, 11rem)",
                        fontWeight: 900,
                        fontStyle: "italic",
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                        padding: "0 1rem",
                        opacity: 0,
                        willChange: "transform, opacity",
                        background:
                            "linear-gradient(180deg, #ffffff 20%, rgba(6,182,212,0.95) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        filter: "drop-shadow(0 0 80px rgba(6,182,212,0.25))",
                    }}
                >
                    ZAYTRI
                </h2>

                {/* TRY IT NOW → */}
                <Link href="/login" className="group w-full text-center no-underline">
                    <h3
                        ref={ctaRef}
                        className="select-none cursor-pointer w-full text-center"
                        style={{
                            fontSize: "clamp(2.5rem, 8vw, 8rem)",
                            fontWeight: 900,
                            fontStyle: "italic",
                            letterSpacing: "0.02em",
                            lineHeight: 1,
                            padding: "0 1rem",
                            opacity: 0,
                            willChange: "transform, opacity",
                            color: "rgba(255,255,255,0.35)",
                            transition: "color 0.4s ease",
                            textDecoration: "none",
                        }}
                    >
                        <span className="transition-colors duration-400 group-hover:text-cyan-400">
                            TRY IT NOW
                        </span>
                        <span
                            className="inline-block ml-4 transition-all duration-500 group-hover:translate-x-4 group-hover:text-cyan-400"
                        >
                            →
                        </span>
                    </h3>
                </Link>
            </div>
        </section>
    );
}
