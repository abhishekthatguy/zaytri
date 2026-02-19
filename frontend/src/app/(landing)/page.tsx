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
                        href="/signup"
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                            boxShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
                        }}
                    >
                        Get Started Free
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
                            href="/signup"
                            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
                        >
                            Get Started
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
                background: "linear-gradient(180deg, #0a0a12 0%, #050508 100%)",
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

// ─── Main Landing Page ─────────────────────────────────────────────────────

export default function LandingPage() {
    return (
        <div style={{ background: "#0a0a12", color: "white", minHeight: "100vh" }}>
            <LandingNav />

            {/* ═══ Hero Section ═══ */}
            <section
                className="relative overflow-hidden"
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
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)," +
                            "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                        backgroundSize: "60px 60px",
                    }}
                />

                <div className="relative max-w-7xl mx-auto px-6 py-32 text-center">
                    {/* Badge */}
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
                        style={{
                            background: "rgba(6, 182, 212, 0.1)",
                            border: "1px solid rgba(6, 182, 212, 0.2)",
                            color: "#f472b6",
                        }}
                    >
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                        AI-Powered Social Media Automation
                    </div>

                    <h1
                        className="text-5xl md:text-7xl font-black mb-6 leading-tight"
                        style={{
                            background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 50%, #a78bfa 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Automate Your
                        <br />
                        Social Media Empire
                    </h1>

                    <p
                        className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                        {siteConfig.description}
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        <Link
                            href="/signup"
                            className="px-8 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105 active:scale-95"
                            style={{
                                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                                boxShadow: "0 8px 30px rgba(6, 182, 212, 0.4)",
                            }}
                        >
                            Start Free — No Credit Card
                        </Link>
                        <Link
                            href="#features"
                            className="px-8 py-4 rounded-2xl text-base font-medium transition-all hover:bg-white/5"
                            style={{
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: "rgba(255,255,255,0.8)",
                            }}
                        >
                            See How It Works →
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
                        {siteConfig.stats.map((stat) => (
                            <div key={stat.label} className="text-center">
                                <p
                                    className="text-3xl md:text-4xl font-black"
                                    style={{
                                        background: "linear-gradient(135deg, #06b6d4, #f472b6)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    {stat.value}
                                </p>
                                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ Agents Showcase ═══ */}
            <section className="py-24" style={{ background: "rgba(255,255,255,0.01)" }}>
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">
                            Meet Your <span style={{ color: "#06b6d4" }}>AI Team</span>
                        </h2>
                        <p className="text-lg max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
                            7 specialized agents work together in an automated pipeline
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {siteConfig.agents.map((agent, i) => (
                            <div
                                key={agent.name}
                                className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    width: 220,
                                }}
                            >
                                <div
                                    className="text-4xl mb-4 transition-transform group-hover:scale-110"
                                    style={{ filter: `hue-rotate(${i * 30}deg)` }}
                                >
                                    {agent.icon}
                                </div>
                                <h3 className="text-sm font-bold text-white mb-2">{agent.name}</h3>
                                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                                    {agent.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Pipeline Flow */}
                    <div className="mt-16 flex items-center justify-center gap-3 flex-wrap text-sm">
                        {["Content", "→", "Hashtags", "→", "Review", "→", "Approve", "→", "Publish", "→", "Engage"].map(
                            (step, i) =>
                                step === "→" ? (
                                    <span key={i} style={{ color: "#06b6d4", fontSize: 20 }}>→</span>
                                ) : (
                                    <span
                                        key={i}
                                        className="px-4 py-2 rounded-xl font-medium"
                                        style={{
                                            background: "rgba(6, 182, 212, 0.08)",
                                            border: "1px solid rgba(6, 182, 212, 0.15)",
                                            color: "rgba(255,255,255,0.7)",
                                        }}
                                    >
                                        {step}
                                    </span>
                                )
                        )}
                    </div>
                </div>
            </section>

            {/* ═══ Features Section ═══ */}
            <section id="features" className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">
                            Everything You Need to <span style={{ color: "#06b6d4" }}>Dominate</span> Social Media
                        </h2>
                        <p className="text-lg max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
                            Enterprise-grade AI automation without the enterprise price tag
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {siteConfig.features.map((feature, i) => (
                            <div
                                key={feature.title}
                                className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2"
                                style={{
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5 transition-transform group-hover:scale-110"
                                    style={{
                                        background: `hsl(${i * 45}, 70%, 50%, 0.1)`,
                                        border: `1px solid hsl(${i * 45}, 70%, 50%, 0.15)`,
                                    }}
                                >
                                    {feature.icon}
                                </div>
                                <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ Pricing Section ═══ */}
            <section
                id="pricing"
                className="py-24"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(6, 182, 212, 0.08), transparent)," +
                        "#0a0a12",
                }}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">
                            Simple, <span style={{ color: "#06b6d4" }}>Transparent</span> Pricing
                        </h2>
                        <p className="text-lg max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
                            Start free, scale as you grow. No hidden fees.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {siteConfig.pricing.map((plan) => (
                            <div
                                key={plan.name}
                                className="relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2"
                                style={{
                                    background: plan.highlight
                                        ? "linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)"
                                        : "rgba(255,255,255,0.02)",
                                    border: plan.highlight
                                        ? "1px solid rgba(6, 182, 212, 0.3)"
                                        : "1px solid rgba(255,255,255,0.06)",
                                    boxShadow: plan.highlight
                                        ? "0 20px 60px rgba(6, 182, 212, 0.15)"
                                        : "none",
                                }}
                            >
                                {plan.highlight && plan.badge && (
                                    <div
                                        className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold"
                                        style={{
                                            background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                                            color: "white",
                                            boxShadow: "0 4px 15px rgba(6, 182, 212, 0.4)",
                                        }}
                                    >
                                        {plan.badge}
                                    </div>
                                )}

                                <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                                    {plan.description}
                                </p>

                                <div className="flex items-baseline gap-1 mb-8">
                                    <span className="text-4xl font-black text-white">{plan.price}</span>
                                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                                        {plan.period}
                                    </span>
                                </div>

                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature) => (
                                        <li
                                            key={feature}
                                            className="flex items-start gap-3 text-sm"
                                            style={{ color: "rgba(255,255,255,0.7)" }}
                                        >
                                            <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={plan.ctaLink}
                                    className="block w-full text-center py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                                    style={{
                                        background: plan.highlight
                                            ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                                            : "rgba(255,255,255,0.06)",
                                        border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.1)",
                                        color: "white",
                                        boxShadow: plan.highlight ? "0 4px 20px rgba(6, 182, 212, 0.3)" : "none",
                                    }}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ Testimonials ═══ */}
            <section className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">
                            Trusted by <span style={{ color: "#06b6d4" }}>Creators</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {siteConfig.testimonials.map((t) => (
                            <div
                                key={t.name}
                                className="rounded-2xl p-6"
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
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA Section ═══ */}
            <section className="py-24">
                <div
                    className="max-w-4xl mx-auto px-6 py-16 rounded-3xl text-center"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)",
                        border: "1px solid rgba(6, 182, 212, 0.2)",
                    }}
                >
                    <h2 className="text-3xl md:text-4xl font-black mb-4 text-white">
                        Ready to Automate Your Social Media?
                    </h2>
                    <p className="text-lg mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
                        Join thousands of creators who save hours every week with Zaytri.
                    </p>
                    <Link
                        href="/signup"
                        className="inline-block px-10 py-4 rounded-2xl text-base font-bold text-white transition-all hover:scale-105"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                            boxShadow: "0 8px 30px rgba(6, 182, 212, 0.4)",
                        }}
                    >
                        Get Started Free →
                    </Link>
                </div>
            </section>

            <Footer />
        </div>
    );
}
