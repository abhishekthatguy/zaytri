"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authLogin, authLoginWithOTP, sendOTP } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useSession } from "@/components/SessionProvider";

type LoginMode = "password" | "otp";

export default function LoginPage() {
    const router = useRouter();
    const toast = useToast();
    const { refreshSession } = useSession();
    const [mode, setMode] = useState<LoginMode>("password");
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [requires2FA, setRequires2FA] = useState(false);
    const [tempToken, setTempToken] = useState("");
    const [twoFACode, setTwoFACode] = useState("");

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const data = await authLogin(identifier, password);
            if (data.requires_2fa) {
                setRequires2FA(true);
                setTempToken(data.access_token);
                toast.info("2FA Required", "Enter the code from your authenticator app");
            } else {
                toast.success("Welcome back!", `Signed in as ${data.user.username}`);
                refreshSession();
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Login failed";
            setError(msg);
            toast.error("Login Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOTP = async () => {
        if (!identifier) { setError("Enter your email or phone number"); return; }
        setError("");
        setLoading(true);
        try {
            const res = await sendOTP(identifier, "login");
            setOtpSent(true);
            toast.success("OTP Sent", res.message || "Check your email or phone");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send OTP";
            setError(msg);
            toast.error("OTP Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOTPLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await authLoginWithOTP(identifier, otpCode);
            toast.success("Welcome back!", `Signed in as ${data.user.username}`);
            refreshSession();
            router.push("/dashboard");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "OTP verification failed";
            setError(msg);
            toast.error("Verification Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const handle2FAVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { verify2FALogin } = await import("@/lib/auth");
            const data = await verify2FALogin(twoFACode, tempToken);
            toast.success("2FA Verified!", `Welcome back, ${data.user.username}`);
            refreshSession();
            router.push("/dashboard");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "2FA verification failed";
            setError(msg);
            toast.error("2FA Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    // ─── 2FA Screen ────────────────────────────────────────────────────
    if (requires2FA) {
        return (
            <div className="w-full max-w-md px-4">
                <div className="text-center mb-8 animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl font-bold animate-pulse-glow"
                        style={{ background: "linear-gradient(135deg, #06b6d4, #155e75)" }}>
                        🔐
                    </div>
                    <h1 className="text-2xl font-bold gradient-text">Two-Factor Authentication</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                        Enter the code from your authenticator app
                    </p>
                </div>
                <div className="glass-card p-8 animate-fade-in">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg text-sm text-cyan-400"
                            style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handle2FAVerify} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                6-Digit Code
                            </label>
                            <input type="text" className="input-field text-center text-2xl tracking-[0.5em]"
                                placeholder="000000" value={twoFACode} maxLength={6}
                                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
                                autoFocus required />
                        </div>
                        <button type="submit" className="btn-primary w-full mt-2" disabled={loading || twoFACode.length !== 6}>
                            {loading ? "Verifying..." : "Verify"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md px-4">
            {/* Logo */}
            <div className="text-center mb-8 animate-fade-in">
                <img
                    src="/favicon.png"
                    alt="Zaytri"
                    className="w-16 h-16 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse-glow"
                />
                <h1 className="text-2xl font-bold gradient-text">Zaytri</h1>
                <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                    AI Social Media Agent System
                </p>
            </div>

            {/* Card */}
            <div className="glass-card p-8 animate-fade-in">
                <h2 className="text-xl font-bold mb-6 text-center">Sign In</h2>

                {/* Mode Toggle */}
                <div className="flex mb-6 p-1 rounded-xl" style={{ background: "var(--zaytri-surface)" }}>
                    <button
                        onClick={() => { setMode("password"); setError(""); }}
                        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300"
                        style={{
                            background: mode === "password" ? "linear-gradient(135deg, #06b6d4, #155e75)" : "transparent",
                            color: mode === "password" ? "white" : "var(--zaytri-text-dim)",
                        }}>
                        Password
                    </button>
                    <button
                        onClick={() => { setMode("otp"); setError(""); }}
                        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300"
                        style={{
                            background: mode === "otp" ? "linear-gradient(135deg, #06b6d4, #155e75)" : "transparent",
                            color: mode === "otp" ? "white" : "var(--zaytri-text-dim)",
                        }}>
                        OTP Login
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm text-cyan-400"
                        style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                        {error}
                    </div>
                )}

                {/* Password Login */}
                {mode === "password" && (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Email, Phone, or Username
                            </label>
                            <input type="text" id="login-identifier" className="input-field"
                                placeholder="you@example.com" value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Password
                            </label>
                            <input type="password" id="login-password" className="input-field"
                                placeholder="Enter your password" value={password}
                                onChange={(e) => setPassword(e.target.value)} required />
                        </div>

                        <div className="text-right">
                            <Link href="/forgot-password" className="text-xs transition-colors duration-300"
                                style={{ color: "var(--zaytri-text-dim)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--zaytri-primary-glow)")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--zaytri-text-dim)")}>
                                Forgot password?
                            </Link>
                        </div>

                        <button type="submit" id="login-submit" className="btn-primary w-full" disabled={loading}>
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>
                )}

                {/* OTP Login */}
                {mode === "otp" && (
                    <form onSubmit={handleOTPLogin} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Email or Phone
                            </label>
                            <input type="text" id="otp-identifier" className="input-field"
                                placeholder="you@example.com or +91..." value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)} required />
                        </div>

                        {!otpSent ? (
                            <button type="button" className="btn-primary w-full" disabled={loading} onClick={handleSendOTP}>
                                {loading ? "Sending..." : "Send OTP"}
                            </button>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                        Enter OTP
                                    </label>
                                    <input type="text" id="otp-code" className="input-field text-center text-lg tracking-[0.3em]"
                                        placeholder="000000" value={otpCode} maxLength={6}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} required />
                                </div>
                                <button type="submit" className="btn-primary w-full" disabled={loading || otpCode.length !== 6}>
                                    {loading ? "Verifying..." : "Verify & Sign In"}
                                </button>
                                <button type="button" onClick={() => { setOtpSent(false); setOtpCode(""); }}
                                    className="w-full text-sm py-2 transition-colors"
                                    style={{ color: "var(--zaytri-text-dim)" }}>
                                    Resend OTP
                                </button>
                            </>
                        )}
                    </form>
                )}

                {/* Divider */}
                <div className="flex items-center my-6">
                    <div className="flex-1 h-px" style={{ background: "var(--zaytri-border)" }} />
                    <span className="px-3 text-xs" style={{ color: "var(--zaytri-text-dim)" }}>or continue with</span>
                    <div className="flex-1 h-px" style={{ background: "var(--zaytri-border)" }} />
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { name: "Google", icon: "G", color: "#4285F4" },
                        { name: "Facebook", icon: "f", color: "#1877F2" },
                        { name: "GitHub", icon: "⌘", color: "#333" },
                        { name: "Twitter", icon: "𝕏", color: "#1DA1F2" },
                    ].map((p) => (
                        <button key={p.name} onClick={async () => {
                            try {
                                const { getOAuthURL } = await import("@/lib/auth");
                                const redirectUri = `${window.location.origin}/verify?provider=${p.name.toLowerCase()}`;
                                const data = await getOAuthURL(p.name.toLowerCase(), redirectUri);
                                window.location.href = data.url;
                            } catch {
                                toast.warning("Not Configured", `${p.name} login is not configured yet`);
                            }
                        }}
                            className="flex items-center justify-center py-3 rounded-xl text-lg font-bold transition-all duration-300 hover:scale-105"
                            style={{
                                background: "var(--zaytri-surface)",
                                border: "1px solid var(--zaytri-border)",
                                color: p.color,
                            }}
                            title={`Sign in with ${p.name}`}>
                            {p.icon}
                        </button>
                    ))}
                </div>

                {/* Sign Up Link */}
                <div className="mt-6 text-center">
                    <Link href="/signup" className="text-sm transition-colors duration-300"
                        style={{ color: "var(--zaytri-text-dim)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--zaytri-primary-glow)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--zaytri-text-dim)")}>
                        Don&apos;t have an account? <span className="font-semibold gradient-text">Sign up</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
