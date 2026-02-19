"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

// ─── Markdown Docs Loader ──────────────────────────────────────────────────

const DOCS_RAW_BASE = "/api/docs"; // We'll serve docs via a Next.js API route

export default function ResourcesPage() {
    const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
    const [docContent, setDocContent] = useState<string>("");
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

    // Check auth status
    useEffect(() => {
        const token = localStorage.getItem("token") || localStorage.getItem("access_token");
        setIsLoggedIn(!!token);
    }, []);

    // Load doc content
    useEffect(() => {
        if (!selectedDoc) return;
        setLoadingDoc(true);
        fetch(`${DOCS_RAW_BASE}/${selectedDoc}`)
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load");
                return r.text();
            })
            .then((text) => {
                setDocContent(text);
                setLoadingDoc(false);
            })
            .catch(() => {
                setDocContent("# Error\n\nCould not load this document. Please try again.");
                setLoadingDoc(false);
            });
    }, [selectedDoc]);

    // Not logged in — show gate
    if (isLoggedIn === false) {
        return (
            <div style={{ background: "#0a0a12", color: "white", minHeight: "100vh" }}>
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

                <div className="flex items-center justify-center" style={{ minHeight: "80vh" }}>
                    <div className="text-center max-w-md mx-auto px-6">
                        <div
                            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6"
                            style={{
                                background: "rgba(6, 182, 212, 0.1)",
                                border: "1px solid rgba(6, 182, 212, 0.2)",
                            }}
                        >
                            🔒
                        </div>
                        <h1 className="text-3xl font-black mb-3 text-white">Resources & Learning</h1>
                        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
                            Access comprehensive documentation, guides, and tutorials.
                            Sign in to your account to unlock all resources.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Link
                                href="/login"
                                className="px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                                style={{
                                    background: "linear-gradient(135deg, #06b6d4, #991b1b)",
                                    boxShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
                                }}
                            >
                                Sign In to Access
                            </Link>
                            <Link
                                href="/signup"
                                className="px-6 py-3.5 rounded-xl text-sm font-medium transition-all"
                                style={{
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    color: "rgba(255,255,255,0.7)",
                                }}
                            >
                                Create Free Account
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoggedIn === null) {
        return (
            <div className="flex items-center justify-center" style={{ background: "#0a0a12", minHeight: "100vh" }}>
                <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    // Logged in — show resources
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
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{ background: "linear-gradient(135deg, #06b6d4, #164e63)" }}
                        >
                            {siteConfig.logo}
                        </div>
                        <span className="text-base font-bold text-white">{siteConfig.name}</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-sm hover:text-white" style={{ color: "rgba(255,255,255,0.6)" }}>
                            Dashboard
                        </Link>
                        <Link href="/" className="text-sm hover:text-white" style={{ color: "rgba(255,255,255,0.6)" }}>
                            Home
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1
                        className="text-4xl font-black mb-3"
                        style={{
                            background: "linear-gradient(135deg, #ffffff 0%, #06b6d4 70%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Resources & Learning
                    </h1>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Documentation, guides, and tutorials to master {siteConfig.name}
                    </p>
                </div>

                {selectedDoc ? (
                    /* ── Document Viewer ───────────────────────────────────── */
                    <div>
                        <button
                            onClick={() => { setSelectedDoc(null); setDocContent(""); }}
                            className="mb-6 flex items-center gap-2 text-sm font-medium transition-all hover:text-white"
                            style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none", cursor: "pointer" }}
                        >
                            ← Back to Resources
                        </button>
                        <div
                            className="rounded-2xl p-8 overflow-auto"
                            style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                minHeight: 400,
                            }}
                        >
                            {loadingDoc ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                                </div>
                            ) : (
                                <pre
                                    className="text-sm leading-relaxed whitespace-pre-wrap font-mono"
                                    style={{ color: "rgba(255,255,255,0.8)" }}
                                >
                                    {docContent}
                                </pre>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ── Resource Cards ─────────────────────────────────── */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {siteConfig.resources.map((resource) => (
                            <button
                                key={resource.file}
                                onClick={() => setSelectedDoc(resource.file)}
                                className="text-left rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red-500/30 group"
                                style={{
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    cursor: "pointer",
                                }}
                            >
                                <div className="flex items-start gap-4">
                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-110"
                                        style={{
                                            background: "rgba(6, 182, 212, 0.08)",
                                            border: "1px solid rgba(6, 182, 212, 0.15)",
                                        }}
                                    >
                                        {resource.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-bold text-white">{resource.title}</h3>
                                        </div>
                                        <span
                                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-2"
                                            style={{
                                                background: "rgba(139, 92, 246, 0.1)",
                                                border: "1px solid rgba(139, 92, 246, 0.2)",
                                                color: "#a78bfa",
                                            }}
                                        >
                                            {resource.category}
                                        </span>
                                        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                                            {resource.description}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
