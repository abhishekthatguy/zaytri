"use client";

import { usePathname } from "next/navigation";
import ProfileDropdown from "@/components/ProfileDropdown";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify"];
const LANDING_ROUTES = ["/about", "/privacy", "/terms", "/resources"];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
    "/dashboard": { title: "Dashboard", subtitle: "AI-powered command center overview" },
    "/chat": { title: "Master Agent", subtitle: "Chat in any language • Full system control" },
    "/content": { title: "Content", subtitle: "Manage your generated content" },
    "/workflows": { title: "Workflows", subtitle: "Run & monitor content pipelines" },
    "/analytics": { title: "Analytics", subtitle: "Performance insights & reports" },
    "/settings": { title: "Settings", subtitle: "System configuration & API keys" },
};

export default function TopBar() {
    const pathname = usePathname();

    // Hide on auth and landing pages
    if (
        pathname === "/" ||
        AUTH_ROUTES.some((r) => pathname.startsWith(r)) ||
        LANDING_ROUTES.some((r) => pathname.startsWith(r))
    ) {
        return null;
    }


    const now = new Date();
    const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

    return (
        <div
            className="flex items-center justify-between mb-6"
            style={{ minHeight: 48 }}
        >
            {/* Left: Page Title (only on non-dashboard pages) */}
            <div>
                {pathname === "/dashboard" ? (
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                        {greeting} 👋
                    </p>
                ) : null}
            </div>

            {/* Right: Profile */}
            <div className="flex items-center gap-3">
                {/* Search button (placeholder for future) */}
                <button
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                    style={{
                        background: "transparent",
                        border: "1px solid var(--zaytri-border)",
                        color: "var(--zaytri-text-dim)",
                        cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.3)";
                        e.currentTarget.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--zaytri-border)";
                        e.currentTarget.style.color = "var(--zaytri-text-dim)";
                    }}
                    title="Search"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </button>

                {/* Notifications button */}
                <button
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 relative"
                    style={{
                        background: "transparent",
                        border: "1px solid var(--zaytri-border)",
                        color: "var(--zaytri-text-dim)",
                        cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.3)";
                        e.currentTarget.style.color = "white";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--zaytri-border)";
                        e.currentTarget.style.color = "var(--zaytri-text-dim)";
                    }}
                    title="Notifications"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {/* Notification dot */}
                    <div
                        className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                        style={{ background: "#06b6d4" }}
                    />
                </button>

                {/* Divider */}
                <div
                    className="h-8 w-px"
                    style={{ background: "var(--zaytri-border)" }}
                />

                {/* Profile Dropdown */}
                <ProfileDropdown />
            </div>
        </div>
    );
}
