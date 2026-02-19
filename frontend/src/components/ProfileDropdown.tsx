"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import { useToast } from "@/components/Toast";
import Link from "next/link";

// ─── Time Helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

function memberSince(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ProfileDropdown() {
    const { user, endSession } = useSession();
    const toast = useToast();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        if (open) document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open]);

    const handleLogout = () => {
        toast.info("Signed Out", "You have been logged out successfully");
        setOpen(false);
        setTimeout(() => endSession(), 300);
    };

    if (!user) return null;

    const initial = (user.display_name || user.username || "U").charAt(0).toUpperCase();
    const displayName = user.display_name || user.username || "User";

    return (
        <div ref={dropdownRef} className="relative" id="profile-dropdown">
            {/* Avatar Button */}
            <button
                id="profile-avatar-btn"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200"
                style={{
                    background: open ? "var(--zaytri-surface-2)" : "transparent",
                    border: "1px solid transparent",
                    cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                    if (!open) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                    if (!open) e.currentTarget.style.background = "transparent";
                }}
            >
                {user.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={displayName}
                        className="w-9 h-9 rounded-full object-cover"
                        style={{ border: "2px solid var(--zaytri-border)" }}
                    />
                ) : (
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #9333ea)",
                            boxShadow: "0 0 12px rgba(6, 182, 212, 0.3)",
                        }}
                    >
                        {initial}
                    </div>
                )}
                <div className="hidden md:block text-left">
                    <p className="text-xs font-semibold text-white leading-tight">{displayName}</p>
                    <p className="text-[10px] leading-tight" style={{ color: "var(--zaytri-text-dim)" }}>
                        {user.is_admin ? "Admin" : "Member"}
                    </p>
                </div>
                <svg
                    className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    style={{ color: "var(--zaytri-text-dim)" }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div
                    className="absolute right-0 mt-2 w-72 rounded-2xl overflow-hidden z-50"
                    style={{
                        background: "linear-gradient(180deg, #14141f 0%, #0f0f18 100%)",
                        border: "1px solid var(--zaytri-border)",
                        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.08)",
                        animation: "profileDropIn 0.2s ease-out",
                    }}
                >
                    {/* User Header */}
                    <div className="p-4 pb-3" style={{ borderBottom: "1px solid var(--zaytri-border)" }}>
                        <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                                <img
                                    src={user.avatar_url}
                                    alt={displayName}
                                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                    style={{ border: "2px solid rgba(6, 182, 212, 0.3)" }}
                                />
                            ) : (
                                <div
                                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                                    style={{
                                        background: "linear-gradient(135deg, #06b6d4, #9333ea)",
                                        boxShadow: "0 0 16px rgba(6, 182, 212, 0.3)",
                                    }}
                                >
                                    {initial}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{displayName}</p>
                                <p className="text-xs truncate" style={{ color: "var(--zaytri-text-dim)" }}>
                                    {user.email}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    {user.is_admin && (
                                        <span
                                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                            style={{
                                                background: "rgba(6, 182, 212, 0.15)",
                                                color: "#ef4444",
                                            }}
                                        >
                                            ADMIN
                                        </span>
                                    )}
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                                        style={{
                                            background: "rgba(34, 197, 94, 0.15)",
                                            color: "#22c55e",
                                        }}
                                    >
                                        ● Online
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity & Info */}
                    <div className="p-3 space-y-1" style={{ borderBottom: "1px solid var(--zaytri-border)" }}>
                        <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                ⏱️ Member since
                            </span>
                            <span className="text-xs font-medium text-white">
                                {user.created_at ? memberSince(user.created_at) : "—"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                ✉️ Email
                            </span>
                            <span className="text-xs font-medium" style={{ color: user.is_email_verified ? "#22c55e" : "#eab308" }}>
                                {user.is_email_verified ? "Verified ✓" : "Unverified"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                🔒 2FA
                            </span>
                            <span className="text-xs font-medium" style={{ color: user.is_2fa_enabled ? "#22c55e" : "var(--zaytri-text-dim)" }}>
                                {user.is_2fa_enabled ? "Enabled ✓" : "Disabled"}
                            </span>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="p-2" style={{ borderBottom: "1px solid var(--zaytri-border)" }}>
                        <Link
                            href="/settings"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
                            style={{ color: "var(--zaytri-text-dim)" }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--zaytri-text-dim)";
                            }}
                        >
                            <span className="text-base">⚙️</span>
                            Settings
                        </Link>
                        <Link
                            href="/chat"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
                            style={{ color: "var(--zaytri-text-dim)" }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                e.currentTarget.style.color = "white";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--zaytri-text-dim)";
                            }}
                        >
                            <span className="text-base">🤖</span>
                            Master Agent
                        </Link>
                    </div>

                    {/* Logout */}
                    <div className="p-2">
                        <button
                            id="profile-logout-btn"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                            style={{
                                color: "#ef4444",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                            }}
                        >
                            <span className="text-base">🚪</span>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
