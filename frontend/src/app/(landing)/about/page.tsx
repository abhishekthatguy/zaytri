"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

export default function AboutPage() {
    return (
        <div style={{ background: "#0a0a12", color: "white", minHeight: "100vh" }}>
            {/* Nav */}
            <nav
                className="sticky top-0 z-50"
                style={{
                    background: "rgba(10, 10, 18, 0.95)",
                    backdropFilter: "blur(20px)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
            >
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{ background: "linear-gradient(135deg, #06b6d4, #164e63)" }}
                        >
                            {siteConfig.logo}
                        </div>
                        <span className="text-base font-bold text-white">{siteConfig.name}</span>
                    </Link>
                    <Link href="/" className="text-sm hover:text-white" style={{ color: "rgba(255,255,255,0.6)" }}>
                        ← Back to Home
                    </Link>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto px-6 py-16">
                {/* Hero */}
                <div className="text-center mb-20">
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-6"
                        style={{
                            background: "rgba(6, 182, 212, 0.1)",
                            border: "1px solid rgba(6, 182, 212, 0.2)",
                            color: "#f87171",
                        }}
                    >
                        Est. {siteConfig.company.founded}
                    </div>
                    <h1
                        className="text-4xl md:text-6xl font-black mb-6"
                        style={{
                            background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 70%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        About {siteConfig.name}
                    </h1>
                    <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {siteConfig.company.about}
                    </p>
                </div>

                {/* Mission */}
                <div
                    className="rounded-3xl p-10 mb-16"
                    style={{
                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)",
                        border: "1px solid rgba(6, 182, 212, 0.15)",
                    }}
                >
                    <h2 className="text-2xl font-black mb-4 text-white">Our Mission</h2>
                    <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {siteConfig.company.mission}
                    </p>
                </div>

                {/* Founder */}
                <div className="mb-16">
                    <h2 className="text-2xl font-black mb-8 text-center">The Creator</h2>
                    <div
                        className="max-w-lg mx-auto rounded-3xl p-8 text-center"
                        style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        <div
                            className="w-24 h-24 rounded-full mx-auto mb-5 flex items-center justify-center text-4xl font-black"
                            style={{
                                background: "linear-gradient(135deg, #06b6d4, #164e63)",
                                boxShadow: "0 0 40px rgba(6, 182, 212, 0.3)",
                            }}
                        >
                            A
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{siteConfig.company.founder}</h3>
                        <p className="text-sm mb-4" style={{ color: "#06b6d4" }}>
                            {siteConfig.company.founderTitle}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                            An AI enthusiast and automation architect passionate about making artificial intelligence
                            accessible to everyone. With deep expertise in multi-agent systems, LLM orchestration, and
                            full-stack development, Avii built Zaytri to solve the real challenges of social media management at scale.
                        </p>
                        <div className="flex justify-center gap-3 mt-6">
                            <a
                                href={siteConfig.social.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
                                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                            >
                                GitHub
                            </a>
                            <a
                                href={siteConfig.social.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
                                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                            >
                                LinkedIn
                            </a>
                            <a
                                href={siteConfig.social.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-105"
                                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
                            >
                                Twitter
                            </a>
                        </div>
                    </div>
                </div>

                {/* Tech Stack */}
                <div className="mb-16">
                    <h2 className="text-2xl font-black mb-8 text-center">Built With</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { name: "Python + FastAPI", icon: "🐍", desc: "Backend" },
                            { name: "Next.js + React", icon: "⚛️", desc: "Frontend" },
                            { name: "SQLAlchemy + SQLite", icon: "🗃️", desc: "Database" },
                            { name: "Ollama + Multi-LLM", icon: "🧠", desc: "AI Engine" },
                            { name: "Redis", icon: "⚡", desc: "Caching" },
                            { name: "Docker", icon: "🐳", desc: "Deployment" },
                            { name: "JWT Auth", icon: "🔐", desc: "Security" },
                            { name: "Cron Scheduler", icon: "⏰", desc: "Automation" },
                        ].map((tech) => (
                            <div
                                key={tech.name}
                                className="rounded-2xl p-5 text-center transition-all hover:-translate-y-1"
                                style={{
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div className="text-3xl mb-3">{tech.icon}</div>
                                <p className="text-sm font-bold text-white">{tech.name}</p>
                                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{tech.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="mb-16">
                    <div
                        className="rounded-3xl p-10 flex flex-wrap justify-center gap-12"
                        style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        {[
                            { value: "7", label: "Specialized AI Agents" },
                            { value: "5+", label: "LLM Providers" },
                            { value: "4", label: "Social Platforms" },
                            { value: "100%", label: "Open Architecture" },
                        ].map((stat) => (
                            <div key={stat.label} className="text-center">
                                <p
                                    className="text-4xl font-black"
                                    style={{
                                        background: "linear-gradient(135deg, #06b6d4, #f87171)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent",
                                    }}
                                >
                                    {stat.value}
                                </p>
                                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact CTA */}
                <div className="text-center">
                    <h2 className="text-2xl font-black mb-4">Get in Touch</h2>
                    <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Have questions? Want to collaborate? We&apos;d love to hear from you.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a
                            href={`mailto:${siteConfig.contact.email}`}
                            className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                            style={{
                                background: "linear-gradient(135deg, #06b6d4, #991b1b)",
                                boxShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
                            }}
                        >
                            📧 Email Us
                        </a>
                        <a
                            href={siteConfig.social.discord}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                            style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "white",
                            }}
                        >
                            💬 Join Discord
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
