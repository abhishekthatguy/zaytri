"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { siteConfig } from "@/lib/siteConfig";
import dynamic from "next/dynamic";

// ─── Timeline Background (Deep Tunnel — fixed behind everything) ───────────
const TimelineTunnelBG = dynamic(() => import("@/components/TimelineTunnelBG"), {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-[#050510]" />,
});

// ─── 3D Z-Scroll Content Overlay ──────────────────────────────────────────
const ZScrollScene = dynamic(() => import("@/components/Experience3D/ZScrollScene"), {
    ssr: false,
    loading: () => <div className="h-screen" />,
});

// ─── Agent Showcase (Keyframe Animation) ──────────────────────────────────
const AgentShowcase3D = dynamic(() => import("@/components/AgentShowcase3D"), {
    ssr: false,
    loading: () => <div className="h-[750px]" />,
});

// ─── Parallax CTA Section ─────────────────────────────────────────────────
const ParallaxCTA = dynamic(() => import("@/components/ParallaxCTA"), {
    ssr: false,
    loading: () => <div className="h-screen" />,
});

// ─── Landing Navbar ────────────────────────────────────────────────────────

function LandingNav() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const scrollRoot = document.getElementById("landing-scroll-root");
        if (!scrollRoot) return;

        const onScroll = () => setScrolled(scrollRoot.scrollTop > 20);
        scrollRoot.addEventListener("scroll", onScroll, { passive: true });
        return () => scrollRoot.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            className="sticky top-0 left-0 right-0 z-[100] transition-all duration-300"
            style={{
                background: scrolled ? "rgba(5, 5, 16, 0.85)" : "transparent",
                backdropFilter: scrolled ? "blur(16px)" : "none",
                borderBottom: scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
                position: "sticky",
                top: 0,
            }}
        >
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    <img
                        src="/favicon.png"
                        alt="Zaytri"
                        className="w-8 h-8 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                    />
                    <span className="text-lg font-black text-white uppercase tracking-[0.2em]">{siteConfig.name}</span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    {siteConfig.navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className="text-[10px] font-black uppercase tracking-[0.3em] transition-colors hover:text-cyan-400"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-6">
                    <Link
                        href="/login"
                        className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:scale-105"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                        }}
                    >
                        Initialize
                    </Link>
                </div>
            </div>
        </nav>
    );
}

export default function LandingPage() {
    return (
        <div className="relative text-white selection:bg-cyan-500/30">
            {/* Layer 0: Deep Tunnel Background (Three.js Canvas — fixed behind everything) */}
            <TimelineTunnelBG />

            {/* Layer 1: Navigation (sticky to scroll container) */}
            <LandingNav />

            {/* Layer 2: 3D Z-Scroll Content (DOM + CSS 3D + GSAP) */}
            <main className="relative z-10">
                <ZScrollScene />
            </main>

            {/* Layer 3: Agent Showcase — Orbital Intelligence System */}
            <section
                id="agents"
                className="relative z-20 h-screen flex flex-col overflow-hidden"
            >
                {/* Section header — transparent so tunnel shows behind */}
                <div className="text-center pt-20 pb-4 flex-shrink-0">
                    <div className="flex items-center justify-center gap-6 mb-4">
                        <div className="h-[1px] w-20 bg-cyan-500/30" />
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.8em] drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                            Command Center
                        </span>
                        <div className="h-[1px] w-20 bg-cyan-500/30" />
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white mb-2">
                        Meet The <span className="text-cyan-400 font-normal">Agents</span>
                    </h2>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.3em] max-w-xl mx-auto">
                        7 specialized AI agents orbiting the Zaytri Core
                    </p>
                </div>

                {/* 3D Showcase — this will now fill the remaining screen space */}
                <AgentShowcase3D />
            </section>

            {/* Layer 4: Parallax CTA — Final call to action */}
            <ParallaxCTA />

            {/* Layer 5: Footer */}
            <footer className="relative z-20 py-12 border-t border-white/5 text-center">
                <p className="text-[10px] text-white/10 uppercase tracking-[0.8em]">
                    © {siteConfig.year} Zaytri Protocol
                </p>
            </footer>
        </div>
    );
}
