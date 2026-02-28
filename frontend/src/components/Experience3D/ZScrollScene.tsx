"use client";

import React, { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

// ─── Section Data ──────────────────────────────────────────────────────────

const SECTIONS = [
    {
        checkpoint: "T-MINUS ZERO",
        title: "ZAYTRI",
        titleAccent: "",
        description: "Autonomous Multi-Agent Engine",
        cta: { label: "Start Sequence", href: "/login" },
        isHero: true,
    },
    {
        checkpoint: "ACTIVATION",
        title: "Agentic",
        titleAccent: "Pulse",
        description:
            "7 specialized AI agents orbiting in harmony. Each one autonomous. Each one essential.",
    },
    {
        checkpoint: "INTELLIGENCE",
        title: "The",
        titleAccent: "Core",
        description:
            "Multi-model AI engine supporting Ollama, OpenAI, Gemini, Anthropic & Groq. Switch models per agent or use them all simultaneously.",
    },
    {
        checkpoint: "VALIDATION",
        title: "Trusted",
        titleAccent: "Output",
        description:
            "Automated content pipelines with quality gates — creation, hashtags, review, approval, publishing, and engagement monitoring.",
    },
    {
        checkpoint: "FUTURE",
        title: "Ready for",
        titleAccent: "Control?",
        description: "Take command of your entire social media presence.",
        cta: { label: "Initiate Protocol", href: "/login" },
    },
];

// ─── Reusable Glass Section ────────────────────────────────────────────────

interface GlassSectionProps {
    checkpoint: string;
    title: string;
    titleAccent: string;
    description: string;
    cta?: { label: string; href: string };
    isHero?: boolean;
    index: number;
}

function GlassSection({
    checkpoint,
    title,
    titleAccent,
    description,
    cta,
    isHero,
    index,
}: GlassSectionProps) {
    return (
        <div
            className="z-section absolute inset-0 flex items-center justify-center pointer-events-none"
            data-index={index}
            style={{
                willChange: "transform, opacity",
                backfaceVisibility: "hidden",
            }}
        >
            {/* Backdrop dark glow so text is readable over tunnel */}
            <div className="absolute inset-0 bg-black/30 blur-[120px] rounded-[6rem] pointer-events-none" />

            <div className="relative max-w-[90vw] md:max-w-7xl w-full mx-auto px-6 text-center pointer-events-auto">
                {/* Checkpoint marker */}
                {checkpoint && (
                    <div className="mb-10 flex items-center justify-center gap-6">
                        <div className="h-[1px] w-16 bg-cyan-500/30" />
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.8em] drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                            {checkpoint}
                        </span>
                        <div className="h-[1px] w-16 bg-cyan-500/30" />
                    </div>
                )}

                {/* Title */}
                {isHero ? (
                    <h1 className="text-[clamp(2.5rem,13vw,5.5rem)] md:text-[clamp(8rem,13vw,11rem)] font-black mb-8 uppercase italic leading-[0.85] tracking-tight inline-block max-w-[85vw] px-8 overflow-visible">
                        ZAY
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-500">
                            TRI
                        </span>
                    </h1>
                ) : (
                    <h2 className="text-6xl md:text-[clamp(4rem,10vw,8rem)] font-black mb-8 uppercase italic tracking-tight leading-tight">
                        {title}{" "}
                        <span className="text-cyan-400 font-normal">{titleAccent}</span>
                    </h2>
                )}

                {/* Description */}
                <p className="text-lg md:text-2xl max-w-2xl mx-auto text-white/40 font-bold uppercase tracking-[0.2em] mb-12 leading-relaxed">
                    {description}
                </p>

                {/* CTA */}
                {cta && (
                    <Link
                        href={cta.href}
                        className="inline-block px-16 py-6 rounded-full text-xs font-black uppercase tracking-[0.4em] bg-white text-black hover:scale-110 transition-all shadow-[0_0_50px_rgba(255,255,255,0.15)]"
                    >
                        {cta.label}
                    </Link>
                )}
            </div>
        </div>
    );
}

// ─── Main Z-Scroll Scene ───────────────────────────────────────────────────

export default function ZScrollScene() {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef<number>(0);

    // Mouse parallax handler
    const handleMouseMove = useCallback((e: MouseEvent) => {
        mouseRef.current = {
            x: (e.clientX / window.innerWidth - 0.5) * 2,
            y: (e.clientY / window.innerHeight - 0.5) * 2,
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current || !viewportRef.current) return;

        // Find the scroll container (landing layout uses a fixed div with overflow-y: scroll)
        const scrollRoot = document.getElementById("landing-scroll-root") || window;

        const sections = gsap.utils.toArray<HTMLElement>(".z-section");
        if (sections.length === 0) return;

        const totalSections = sections.length;

        // Set initial state — first section visible, rest hidden behind
        sections.forEach((section, i) => {
            gsap.set(section, {
                opacity: i === 0 ? 1 : 0,
                scale: i === 0 ? 1 : 0.8,
                z: i === 0 ? 0 : -800,
                rotationX: i === 0 ? 0 : 5,
            });
        });

        // Tell ScrollTrigger about the custom scroller
        if (scrollRoot !== window) {
            ScrollTrigger.scrollerProxy(scrollRoot as HTMLElement, {
                scrollTop(value) {
                    const el = scrollRoot as HTMLElement;
                    if (arguments.length) {
                        el.scrollTop = value!;
                    }
                    return el.scrollTop;
                },
                getBoundingClientRect() {
                    return {
                        top: 0,
                        left: 0,
                        width: window.innerWidth,
                        height: window.innerHeight,
                    };
                },
            });

            // Listen to scroll events on the custom scroller
            (scrollRoot as HTMLElement).addEventListener("scroll", () => {
                ScrollTrigger.update();
            });
        }

        // Create a master timeline bound to scroll
        const masterTL = gsap.timeline({
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top top",
                end: "bottom bottom",
                scrub: 1.2,
                invalidateOnRefresh: true,
                scroller: scrollRoot !== window ? (scrollRoot as HTMLElement) : undefined,
            },
        });

        // Animate each section transition
        for (let i = 0; i < totalSections - 1; i++) {
            const sectionDuration = 1;

            // Current section moves backward
            masterTL.to(
                sections[i],
                {
                    opacity: 0,
                    scale: 1.15,
                    z: 600,
                    rotationX: -3,
                    ease: "power3.inOut",
                    duration: sectionDuration,
                },
                i * sectionDuration
            );

            // Next section comes forward
            masterTL.fromTo(
                sections[i + 1],
                {
                    opacity: 0,
                    scale: 0.8,
                    z: -800,
                    rotationX: 5,
                },
                {
                    opacity: 1,
                    scale: 1,
                    z: 0,
                    rotationX: 0,
                    ease: "power3.inOut",
                    duration: sectionDuration,
                },
                i * sectionDuration
            );
        }

        // Mouse parallax animation loop
        window.addEventListener("mousemove", handleMouseMove, { passive: true });

        let currentX = 0;
        let currentY = 0;

        const animateParallax = () => {
            const targetX = mouseRef.current.x * 15;
            const targetY = mouseRef.current.y * 10;
            currentX += (targetX - currentX) * 0.05;
            currentY += (targetY - currentY) * 0.05;

            if (viewportRef.current) {
                viewportRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }

            rafRef.current = requestAnimationFrame(animateParallax);
        };

        rafRef.current = requestAnimationFrame(animateParallax);

        // Ensure ScrollTrigger recalculates after DOM is ready
        const refreshTimeout = setTimeout(() => ScrollTrigger.refresh(), 200);

        return () => {
            ScrollTrigger.getAll().forEach((t) => t.kill());
            window.removeEventListener("mousemove", handleMouseMove);
            cancelAnimationFrame(rafRef.current);
            clearTimeout(refreshTimeout);
        };
    }, [handleMouseMove]);

    return (
        <>
            {/* Scroll height driver */}
            <div
                ref={containerRef}
                className="relative w-full"
                style={{ height: `${SECTIONS.length * 100}vh` }}
            >
                {/* Sticky 3D viewport that stays on screen within scroller */}
                <div
                    className="sticky top-0 left-0 w-full h-screen z-10"
                    style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}
                >
                    <div
                        ref={viewportRef}
                        className="relative w-full h-full"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        {SECTIONS.map((section, i) => (
                            <GlassSection key={i} index={i} {...section} />
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
