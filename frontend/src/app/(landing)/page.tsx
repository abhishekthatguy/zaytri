"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { siteConfig } from "@/lib/siteConfig";

// ─── Landing Navbar ────────────────────────────────────────────────────────

function LandingNav() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
            style={{
                background: scrolled ? "rgba(10, 10, 18, 0.95)" : "transparent",
                backdropFilter: scrolled ? "blur(20px)" : "none",
                borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
        >
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo */}
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <img
                        src="/favicon.png"
                        alt="Zaytri"
                        className="w-10 h-10 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-transform group-hover:scale-105"
                    />
                    <span className="text-xl font-bold text-white tracking-wide">{siteConfig.name}</span>
                </Link>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-8">
                    {siteConfig.navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className="text-sm font-medium transition-colors hover:text-white"
                            style={{ color: "rgba(255,255,255,0.6)" }}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-3">
                    <Link
                        href="/login"
                        className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
                        style={{ color: "rgba(255,255,255,0.8)" }}
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/login"
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                            boxShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
                        }}
                    >
                        Explore Demo
                    </Link>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden text-white text-2xl"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                    {mobileOpen ? "✕" : "☰"}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden px-6 pb-6" style={{ background: "rgba(10, 10, 18, 0.98)" }}>
                    {siteConfig.navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className="block py-3 text-sm font-medium"
                            style={{ color: "rgba(255,255,255,0.7)" }}
                            onClick={() => setMobileOpen(false)}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="flex gap-3 mt-4">
                        <Link href="/login" className="px-4 py-2 rounded-xl text-sm" style={{ color: "white" }}>
                            Sign In
                        </Link>
                        <Link
                            href="/login"
                            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
                        >
                            Explore Demo
                        </Link>
                    </div>
                </div>
            )}
        </nav>
    );
}

// ─── Footer ────────────────────────────────────────────────────────────────

function Footer() {
    return (
        <footer
            style={{
                background: "#0a0a12",
                borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <img
                                src="/favicon.png"
                                alt="Zaytri"
                                className="w-9 h-9 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                            />
                            <span className="text-lg font-bold text-white tracking-wide">{siteConfig.name}</span>
                        </div>
                        <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                            {siteConfig.description}
                        </p>
                        <div className="flex gap-3">
                            {Object.entries(siteConfig.social).map(([platform, url]) => (
                                <a
                                    key={platform}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold uppercase transition-all hover:scale-110"
                                    style={{
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        color: "rgba(255,255,255,0.5)",
                                    }}
                                    title={platform}
                                >
                                    {platform.slice(0, 2)}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Product</h4>
                        {siteConfig.footerLinks.product.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="block py-1.5 text-sm transition-colors hover:text-white"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Company Links */}
                    <div>
                        <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Company</h4>
                        {siteConfig.footerLinks.company.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="block py-1.5 text-sm transition-colors hover:text-white"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Legal & Contact */}
                    <div>
                        <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Legal</h4>
                        {siteConfig.footerLinks.legal.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="block py-1.5 text-sm transition-colors hover:text-white"
                                style={{ color: "rgba(255,255,255,0.5)" }}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="mt-6">
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                                📧 {siteConfig.contact.email}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                                📱 {siteConfig.contact.phone}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div
                    className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        © {siteConfig.year} {siteConfig.company.legalName}. All rights reserved.
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Built with ❤️ by {siteConfig.company.founder}
                    </p>
                </div>
            </div>
        </footer>
    );
}

import dynamic from "next/dynamic";
import RevealSection from "@/components/RevealSection";

const AgentNetwork = dynamic(() => import("@/components/AgentNetwork"), {
    ssr: false,
    loading: () => <div className="h-[450px] md:h-[600px] w-full" />
});

const MeetTheTeam3D = dynamic(() => import("@/components/MeetTheTeam3D"), {
    ssr: false,
    loading: () => (
        <div className="h-[600px] w-full flex items-center justify-center text-white/20 uppercase tracking-[0.2em] font-black animate-pulse">
            Initializing 3D Neural Space...
        </div>
    )
});

const Architecture3D = dynamic(() => import("@/components/Architecture3D"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[600px] flex items-center justify-center text-white/20 uppercase tracking-[0.4em] text-xs font-bold bg-white/5 rounded-3xl animate-pulse">
            Constructing Neural Architecture...
        </div>
    ),
});

export default function LandingPage() {
    return (
        <div style={{ background: "#0a0a12", color: "white", minHeight: "100vh" }}>
            <LandingNav />

            {/* ═══ Hero Section ═══ */}
            <section
                className="relative overflow-hidden pt-20"
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    background:
                        "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.15), transparent)," +
                        "radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139, 92, 246, 0.08), transparent)," +
                        "#0a0a12",
                }}
            >
                {/* Animated grid background */}
                <div
                    className="absolute inset-0 z-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px)," +
                            "linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)",
                        backgroundSize: "60px 60px",
                    }}
                />

                {/* Full-Width 3D Background */}
                <div className="absolute inset-0 z-0 opacity-50 pointer-events-none">
                    <AgentNetwork />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full text-center">
                    <RevealSection direction="up" delay={200}>
                        <div className="flex flex-col items-center">
                            {/* Badge */}
                            <div
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
                                style={{
                                    background: "rgba(6, 182, 212, 0.15)",
                                    border: "1px solid rgba(6, 182, 212, 0.25)",
                                    color: "#22d3ee",
                                    backdropFilter: "blur(8px)",
                                }}
                            >
                                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                Decentralized Intelligent Node Network
                            </div>

                            <h1
                                className="text-6xl md:text-8xl font-black mb-6 leading-[1.1] tracking-tight"
                                style={{
                                    background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 50%, #a78bfa 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    filter: "drop-shadow(0 0 40px rgba(6, 182, 212, 0.3))",
                                    textShadow: "0 0 20px rgba(0,0,0,0.4)",
                                }}
                            >
                                Multi-Agent
                                <br />
                                Autonomous Loop
                            </h1>

                            <p
                                className="text-lg md:text-2xl max-w-2xl mb-12 leading-relaxed"
                                style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
                            >
                                {siteConfig.description}
                                <span className="block mt-4 text-cyan-400 font-semibold text-lg md:text-xl">
                                    Watch the neural connections react in real-time as tasks propagate.
                                </span>
                            </p>

                            {/* CTA Buttons */}
                            <div className="flex flex-col sm:flex-row items-center gap-6 mb-20 justify-center">
                                <Link
                                    href="/login"
                                    className="w-full sm:w-auto px-10 py-5 rounded-2xl text-lg font-bold text-white transition-all hover:scale-105 active:scale-95 text-center shadow-[0_0_40px_rgba(6,182,212,0.4)]"
                                    style={{
                                        background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                                    }}
                                >
                                    Login to Interface
                                </Link>
                                <Link
                                    href="#features"
                                    className="w-full sm:w-auto px-10 py-5 rounded-2xl text-lg font-medium transition-all hover:bg-white/5 text-center backdrop-blur-md"
                                    style={{
                                        border: "1px solid rgba(255,255,255,0.15)",
                                        color: "rgba(255,255,255,0.8)",
                                    }}
                                >
                                    Neural Specs →
                                </Link>
                            </div>

                            {/* Stats - Centered Grid */}
                            <div className="flex flex-wrap items-center justify-center gap-12 md:gap-20">
                                {siteConfig.stats.map((stat) => (
                                    <div key={stat.label} className="text-center group">
                                        <p
                                            className="text-4xl md:text-5xl font-black transition-transform group-hover:scale-110"
                                            style={{
                                                background: "linear-gradient(135deg, #06b6d4, #f472b6)",
                                                WebkitBackgroundClip: "text",
                                                WebkitTextFillColor: "transparent",
                                            }}
                                        >
                                            {stat.value}
                                        </p>
                                        <p className="text-xs md:text-sm mt-2 uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                                            {stat.label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </RevealSection>
                </div>
            </section>

            {/* ═══ Agents Showcase ═══ */}
            <section className="py-12 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <RevealSection direction="up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl md:text-5xl font-black mb-4">
                                Meet Your <span style={{ color: "#06b6d4" }}>AI Team</span>
                            </h2>
                            <p className="text-lg max-w-2xl mx-auto font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                                7 specialized agents work together in a synchronized 3D autonomous planetary orbit.
                                Interact with each node to explore their function.
                            </p>
                        </div>
                    </RevealSection>

                    <RevealSection direction="none" delay={300}>
                        <MeetTheTeam3D />
                    </RevealSection>
                </div>
            </section>

            {/* ═══ Architecture Section ═══ */}
            <section id="features" className="py-12 relative overflow-hidden min-h-screen flex flex-col justify-center">
                {/* Background Atmosphere */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.05)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10">
                    <RevealSection direction="up">
                        <div className="max-w-7xl mx-auto px-6 text-center mb-8">
                            <div className="inline-block bg-cyan-400/10 border border-cyan-400/20 px-4 py-1.5 rounded-full mb-6 backdrop-blur-md">
                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">
                                    System Blueprint
                                </span>
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                                The <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Architecture</span>
                            </h2>
                            <p className="text-xl max-w-2xl mx-auto font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                                A high-fidelity visualization of the multi-agent orchestration engine powering Zaytri's autonomous pipelines.
                            </p>
                        </div>
                    </RevealSection>

                    <RevealSection direction="none" delay={400}>
                        <div className="w-full h-[550px]">
                            <Architecture3D />
                        </div>
                    </RevealSection>
                </div>
            </section>

            {/* ═══ Testimonials ═══ */}
            <section className="py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <RevealSection direction="up">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl md:text-4xl font-black mb-4">
                                Trusted by <span style={{ color: "#06b6d4" }}>Creators</span>
                            </h2>
                        </div>
                    </RevealSection>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {siteConfig.testimonials.map((t, i) => (
                            <RevealSection key={t.name} direction="up" delay={i * 100}>
                                <div
                                    className="rounded-2xl p-6 transition-all hover:bg-white/[0.04]"
                                    style={{
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
                                        &ldquo;{t.quote}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                                            style={{
                                                background: "linear-gradient(135deg, #06b6d4, #155e75)",
                                                color: "white",
                                            }}
                                        >
                                            {t.avatar}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{t.name}</p>
                                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                                                {t.role}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </RevealSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA Section ═══ */}
            <section className="py-24">
                <RevealSection direction="up" delay={200}>
                    <div
                        className="max-w-4xl mx-auto px-6 py-16 rounded-3xl text-center shadow-2xl"
                        style={{
                            background:
                                "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)",
                            border: "1px solid rgba(6, 182, 212, 0.2)",
                        }}
                    >
                        <h2 className="text-3xl md:text-4xl font-black mb-4 text-white">
                            Ready to Explore the Code?
                        </h2>
                        <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
                            Dive into the mechanics of multi-agent LLM systems and build your own.
                        </p>
                        <Link
                            href="/login"
                            className="inline-block px-12 py-5 rounded-2xl text-lg font-bold text-white transition-all hover:scale-105 shadow-[0_10px_40px_rgba(6,182,212,0.4)]"
                            style={{
                                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                            }}
                        >
                            Launch Dashboard →
                        </Link>
                    </div>
                </RevealSection>
            </section>

            <Footer />
        </div>
    );
}
