"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { siteConfig } from "@/lib/siteConfig";
import dynamic from "next/dynamic";
import RevealSection from "@/components/RevealSection";

// ─── Timeline Background ──────────────────────────────────────────────────
const TimelineTunnelBG = dynamic(() => import("@/components/TimelineTunnelBG"), {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-[#0a0a12]" />
});

// ─── Landing Navbar ────────────────────────────────────────────────────────

function LandingNav() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
            style={{
                background: scrolled ? "rgba(10, 10, 18, 0.9)" : "transparent",
                backdropFilter: scrolled ? "blur(12px)" : "none",
                borderBottom: scrolled ? "1px solid rgba(255,255,255,0.05)" : "none",
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

// ─── Dynamic Components ───────────────────────────────────────────────────

const MeetTheTeam3D = dynamic(() => import("@/components/MeetTheTeam3D"), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full" />
});

const Architecture3D = dynamic(() => import("@/components/Architecture3D"), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full" />
});

export default function LandingPage() {
    return (
        <div className="relative text-white bg-[#0a0a12] selection:bg-cyan-500/30 overflow-x-hidden">
            <TimelineTunnelBG />
            <LandingNav />

            {/* ═══ Tunnel Journey ═══ */}
            <main className="relative z-10 flex flex-col items-center">

                {/* 1. HERO */}
                <section id="hero" className="min-h-screen w-full flex items-center justify-center">
                    <RevealSection checkpoint="T-MINUS ZERO: PRESENT">
                        <div className="max-w-7xl mx-auto px-6 text-center">
                            <h1 className="text-7xl md:text-9xl font-black mb-6 tracking-tighter uppercase italic">
                                ZAY<span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-500">TRI</span>
                            </h1>
                            <p className="text-lg md:text-2xl max-w-2xl mx-auto text-white/40 font-bold uppercase tracking-[0.3em] mb-12">
                                Autonomous Multi-Agent Engine
                            </p>
                            <Link
                                href="/login"
                                className="px-16 py-6 rounded-full text-xs font-black uppercase tracking-[0.4em] bg-white text-black hover:scale-110 transition-all"
                            >
                                Start Sequence
                            </Link>
                        </div>
                    </RevealSection>
                </section>

                {/* 2. ACTIVATION */}
                <section id="agents" className="min-h-screen w-full flex items-center justify-center">
                    <RevealSection checkpoint="SEQUESTERED: ACTIVATION">
                        <div className="max-w-7xl mx-auto px-6 w-full py-20">
                            <div className="text-center mb-12">
                                <h2 className="text-5xl md:text-7xl font-black uppercase italic">
                                    Agentic <span className="text-cyan-400 font-normal">Pulse</span>
                                </h2>
                            </div>
                            <div className="h-[500px] w-full">
                                <MeetTheTeam3D />
                            </div>
                        </div>
                    </RevealSection>
                </section>

                {/* 3. INTELLIGENCE */}
                <section id="architecture" className="min-h-screen w-full flex items-center justify-center">
                    <RevealSection checkpoint="ENGINEERING: INTELLIGENCE">
                        <div className="max-w-7xl mx-auto px-6 w-full py-20">
                            <div className="text-center mb-12">
                                <h2 className="text-5xl md:text-7xl font-black uppercase">
                                    The <span className="text-cyan-400">Core</span>
                                </h2>
                            </div>
                            <div className="h-[500px] w-full">
                                <Architecture3D />
                            </div>
                        </div>
                    </RevealSection>
                </section>

                {/* 4. VALIDATION */}
                <section id="validation" className="min-h-screen w-full flex items-center justify-center">
                    <RevealSection checkpoint="VALIDATION: CONSENSUS">
                        <div className="max-w-7xl mx-auto px-6 w-full py-20">
                            <h2 className="text-4xl md:text-6xl font-black text-center mb-16 uppercase italic">
                                Trusted <span className="text-cyan-500">Output</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {siteConfig.testimonials.map((t) => (
                                    <div key={t.name} className="p-8 rounded-[3rem] border border-white/5 bg-white/5 backdrop-blur-xl">
                                        <p className="text-lg text-white/60 mb-8 italic">"{t.quote}"</p>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center font-black">
                                                {t.avatar}
                                            </div>
                                            <div>
                                                <p className="font-black uppercase text-[10px]">{t.name}</p>
                                                <p className="text-[9px] text-white/30 uppercase">{t.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </RevealSection>
                </section>

                {/* 5. FUTURE */}
                <section id="cta" className="min-h-screen w-full flex items-center justify-center">
                    <RevealSection checkpoint="FUTURE: ACTIVATION">
                        <div className="max-w-4xl mx-auto px-6 py-20 rounded-[4rem] border border-cyan-500/30 bg-[#0a0a12] text-center">
                            <h2 className="text-6xl md:text-8xl font-black mb-8 uppercase">
                                Ready for <br />
                                <span className="text-cyan-400">Control?</span>
                            </h2>
                            <Link
                                href="/login"
                                className="px-16 py-6 rounded-full text-xs font-black uppercase tracking-[0.4em] bg-cyan-500 text-black shadow-[0_0_50px_rgba(6,182,212,0.4)]"
                            >
                                Initiate Loop
                            </Link>
                        </div>
                    </RevealSection>
                </section>
            </main>

            <footer className="relative z-10 py-12 border-t border-white/5 text-center">
                <p className="text-[10px] text-white/10 uppercase tracking-[0.8em]">© {siteConfig.year} Zaytri Protocol</p>
            </footer>

            <style jsx global>{`
                body {
                    background: #0a0a12;
                    overflow-x: hidden;
                }
                html {
                   scroll-behavior: auto !important;
                }
            `}</style>
        </div>
    );
}
