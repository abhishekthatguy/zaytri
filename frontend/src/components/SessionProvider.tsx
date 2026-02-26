"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, getUser, clearTokens, AuthUser } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    sessionExpired: boolean;
    refreshSession: () => void;
    endSession: () => void;
}

const SessionContext = createContext<SessionContextType>({
    user: null,
    isAuthenticated: false,
    sessionExpired: false,
    refreshSession: () => { },
    endSession: () => { },
});

export function useSession(): SessionContextType {
    return useContext(SessionContext);
}

// ─── Auth routes (no guard needed) ────────────────────────────────────────

const PUBLIC_ROUTES = ["/", "/about", "/privacy", "/terms", "/resources", "/login", "/signup", "/forgot-password", "/reset-password", "/verify", "/auth/callback"];

function isPublicRoute(pathname: string): boolean {
    if (pathname === "/") return true;
    return PUBLIC_ROUTES.some((r) => r !== "/" && pathname.startsWith(r));
}

function isAuthRoute(pathname: string): boolean {
    const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify", "/auth/callback"];
    return authPaths.some((r) => pathname.startsWith(r));
}

// ─── JWT Decode (minimal) ──────────────────────────────────────────────────

function decodeJWT(token: string): { exp?: number; sub?: string } | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payload;
    } catch {
        return null;
    }
}

function isTokenExpired(token: string): boolean {
    const payload = decodeJWT(token);
    if (!payload?.exp) return true;
    // 30-second buffer before actual expiry
    return Date.now() >= (payload.exp - 30) * 1000;
}

// ─── Session Expired Popup ──────────────────────────────────────────────────

// ─── Get Started Popup (Premium Invite) ──────────────────────────────────────

function GetStartedPopup({ onGetStarted }: { onGetStarted: () => void }) {
    const [exiting, setExiting] = useState(false);

    const handleAction = () => {
        setExiting(true);
        setTimeout(onGetStarted, 250);
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(4px)",
                animation: "fadeIn 0.5s ease",
                opacity: exiting ? 0 : 1,
                transition: "opacity 0.25s ease",
            }}
        >
            <div
                style={{
                    maxWidth: "480px",
                    width: "90%",
                    background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(10, 10, 15, 0.98))",
                    border: "1px solid rgba(6, 182, 212, 0.2)",
                    borderRadius: "24px",
                    backdropFilter: "blur(32px)",
                    boxShadow: "0 30px 70px rgba(0, 0, 0, 0.6), 0 0 50px rgba(6, 182, 212, 0.05)",
                    padding: "3rem 2.5rem",
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                    transform: exiting ? "scale(0.95)" : "scale(1)",
                    transition: "transform 0.25s ease",
                    animation: "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                {/* Decorative background element */}
                <div style={{
                    position: "absolute",
                    top: "-50px",
                    right: "-50px",
                    width: "150px",
                    height: "150px",
                    background: "radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)",
                    zIndex: 0
                }} />

                {/* Close Button (Subtle) */}
                <button
                    onClick={() => setExiting(true)}
                    style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        background: "transparent",
                        border: "none",
                        color: "rgba(255, 255, 255, 0.3)",
                        cursor: "pointer",
                        fontSize: "18px",
                        padding: "5px",
                        zIndex: 10
                    }}
                >✕</button>

                {/* Content */}
                <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                        style={{
                            width: "72px",
                            height: "72px",
                            borderRadius: "20px",
                            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.15))",
                            border: "1px solid rgba(6, 182, 212, 0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 2rem",
                            fontSize: "32px",
                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)"
                        }}
                    >
                        🚀
                    </div>

                    <h2
                        style={{
                            fontSize: "1.75rem",
                            lineHeight: 1.2,
                            fontWeight: 800,
                            background: "linear-gradient(to right, #ffffff, #06b6d4)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            marginBottom: "1rem",
                            letterSpacing: "-0.02em"
                        }}
                    >
                        Ready to Orbit?
                    </h2>

                    <p
                        style={{
                            fontSize: "1rem",
                            color: "rgba(255, 255, 255, 0.7)",
                            lineHeight: 1.6,
                            marginBottom: "2.5rem",
                        }}
                    >
                        Join Zaytri today and automate your social media empire with high-performance AI agents.
                    </p>

                    <button
                        onClick={handleAction}
                        style={{
                            width: "100%",
                            padding: "1rem 2rem",
                            borderRadius: "14px",
                            border: "none",
                            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                            color: "white",
                            fontWeight: 700,
                            fontSize: "1rem",
                            cursor: "pointer",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            boxShadow: "0 8px 25px rgba(6, 182, 212, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.75rem",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                            e.currentTarget.style.boxShadow = "0 12px 30px rgba(6, 182, 212, 0.5)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0) scale(1)";
                            e.currentTarget.style.boxShadow = "0 8px 25px rgba(6, 182, 212, 0.3)";
                        }}
                    >
                        Get Started for Free <span style={{ fontSize: "1.2rem" }}>✨</span>
                    </button>

                    <div style={{ marginTop: "1.5rem" }}>
                        <span style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.4)" }}>
                            Already have an account?{" "}
                            <button
                                onClick={handleAction}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#06b6d4",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    padding: 0
                                }}
                            >
                                Sign In
                            </button>
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    );
}

// ─── Session Expired Popup ──────────────────────────────────────────────────

function SessionExpiredPopup({ onLogin }: { onLogin: () => void }) {
    const [exiting, setExiting] = useState(false);

    const handleLogin = () => {
        setExiting(true);
        setTimeout(onLogin, 250);
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9998,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(8px)",
                animation: "fadeIn 0.3s ease",
                opacity: exiting ? 0 : 1,
                transition: "opacity 0.25s ease",
            }}
        >
            <div
                style={{
                    maxWidth: "420px",
                    width: "90%",
                    background: "linear-gradient(135deg, rgba(18, 18, 26, 0.95), rgba(26, 26, 40, 0.9))",
                    border: "1px solid var(--zaytri-border)",
                    borderRadius: "20px",
                    backdropFilter: "blur(24px)",
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(6, 182, 212, 0.1)",
                    padding: "2.5rem",
                    textAlign: "center",
                    transform: exiting ? "scale(0.95)" : "scale(1)",
                    transition: "transform 0.25s ease",
                    animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                {/* Icon */}
                <div
                    style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "16px",
                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(127, 29, 29, 0.1))",
                        border: "1px solid rgba(6, 182, 212, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.5rem",
                        fontSize: "28px",
                    }}
                >
                    🔒
                </div>

                {/* Title */}
                <h2
                    style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        background: "linear-gradient(135deg, #f1f1f5, #8b8ba0)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        marginBottom: "0.5rem",
                    }}
                >
                    Session Expired
                </h2>

                {/* Message */}
                <p
                    style={{
                        fontSize: "0.875rem",
                        color: "var(--zaytri-text-dim)",
                        lineHeight: 1.6,
                        marginBottom: "2rem",
                    }}
                >
                    Your session has expired or the authentication token is missing.
                    Please sign in again to continue using Zaytri.
                </p>

                {/* CTA Button */}
                <button
                    onClick={handleLogin}
                    style={{
                        width: "100%",
                        padding: "0.875rem 1.5rem",
                        borderRadius: "12px",
                        border: "none",
                        background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: "0 4px 15px rgba(6, 182, 212, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(6, 182, 212, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.3)";
                    }}
                >
                    <span>🔐</span> Sign In to Continue
                </button>

                {/* Subtle hint */}
                <p
                    style={{
                        fontSize: "0.75rem",
                        color: "var(--zaytri-text-dim)",
                        marginTop: "1rem",
                        opacity: 0.6,
                    }}
                >
                    Your data is safe — just need to verify your identity
                </p>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    );
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [checked, setChecked] = useState(false);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Check session validity
    const checkSession = useCallback(() => {
        const token = getToken();
        const storedUser = getUser();

        if (!token || isTokenExpired(token)) {
            setUser(null);

            // Only show session expired on protected routes
            if (!isPublicRoute(window.location.pathname)) {
                setSessionExpired(true);
            }
            return;
        }

        setUser(storedUser);
        setSessionExpired(false);
    }, []);

    // Initial check + route changes
    useEffect(() => {
        if (isAuthRoute(pathname)) {
            setSessionExpired(false);
            setChecked(true);
            return;
        }

        checkSession();
        setChecked(true);
    }, [pathname, checkSession]);

    // Periodic token check (every 60s)
    useEffect(() => {
        checkIntervalRef.current = setInterval(() => {
            if (!isPublicRoute(window.location.pathname)) {
                const token = getToken();
                if (token && isTokenExpired(token)) {
                    clearTokens();
                    setUser(null);
                    setSessionExpired(true);
                }
            }
        }, 60_000);

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        };
    }, []);

    // Listen for storage changes (other tabs logging out)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === "zaytri_token" && !e.newValue) {
                setUser(null);
                if (!isPublicRoute(window.location.pathname)) {
                    setSessionExpired(true);
                }
            }
        };

        // Listen for API-triggered session expiry
        const handleApiExpiry = () => {
            setUser(null);
            // Only show the popup on protected routes — not on login/landing pages
            if (!isPublicRoute(window.location.pathname)) {
                setSessionExpired(true);
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener("zaytri-session-expired", handleApiExpiry);
        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("zaytri-session-expired", handleApiExpiry);
        };
    }, []);

    const refreshSession = useCallback(() => {
        const storedUser = getUser();
        setUser(storedUser);
        setSessionExpired(false);
    }, []);

    const endSession = useCallback(() => {
        clearTokens();
        localStorage.removeItem("zaytri_user");
        setUser(null);
        setSessionExpired(false);
        router.push("/login");
    }, [router]);

    const handleLoginRedirect = useCallback(() => {
        clearTokens();
        localStorage.removeItem("zaytri_user");
        setSessionExpired(false);
        router.push("/login");
    }, [router]);

    if (!checked) return null; // Don't render until we've checked

    return (
        <SessionContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                sessionExpired,
                refreshSession,
                endSession,
            }}
        >
            {children}
            {sessionExpired && <SessionExpiredPopup onLogin={handleLoginRedirect} />}
        </SessionContext.Provider>
    );
}
