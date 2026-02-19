"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authRegister, sendOTP, verifyOTP } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useSession } from "@/components/SessionProvider";

type SignupMode = "email" | "phone" | "social";

export default function SignupPage() {
    const router = useRouter();
    const toast = useToast();
    const { refreshSession } = useSession();
    const [mode, setMode] = useState<SignupMode>("email");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSendOTP = async () => {
        const identifier = mode === "email" ? email : phone;
        if (!identifier) {
            setError(`Enter your ${mode === "email" ? "email" : "phone number"}`);
            return;
        }
        setError("");
        setLoading(true);
        try {
            const res = await sendOTP(identifier, "signup");
            setOtpSent(true);
            toast.success("Verification Code Sent", res.message || `Check your ${mode}`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send OTP";
            setError(msg);
            toast.error("Failed to Send Code", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        const identifier = mode === "email" ? email : phone;
        setError("");
        setLoading(true);
        try {
            await verifyOTP(identifier, otpCode, "signup");
            setOtpVerified(true);
            toast.success("Identity Verified!", "Now complete your registration");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "OTP verification failed";
            setError(msg);
            toast.error("Verification Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            toast.warning("Password Mismatch", "Both password fields must match");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
            setError("Password must contain letters and numbers");
            return;
        }

        setLoading(true);
        try {
            const data = await authRegister(username, email, password, phone || undefined);
            toast.success("Account Created!", `Welcome to Zaytri, ${data.user.username}!`);
            refreshSession();
            router.push("/dashboard");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Registration failed";
            setError(msg);
            toast.error("Registration Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: string) => {
        try {
            const { getOAuthURL } = await import("@/lib/auth");
            const redirectUri = `${window.location.origin}/verify?provider=${provider}`;
            const data = await getOAuthURL(provider, redirectUri);
            window.location.href = data.url;
        } catch {
            toast.warning("Not Configured", `${provider} signup is not configured yet`);
        }
    };

    return (
        <div className="w-full max-w-md px-4">
            {/* Logo */}
            <div className="text-center mb-8 animate-fade-in">
                <img
                    src="/favicon.png"
                    alt="Zaytri"
                    className="w-16 h-16 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse-glow"
                />
                <h1 className="text-2xl font-bold gradient-text">Create Account</h1>
                <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                    Join Zaytri — AI-powered social media
                </p>
            </div>

            <div className="glass-card p-8 animate-fade-in">
                {/* Mode Toggle */}
                <div className="flex mb-6 p-1 rounded-xl" style={{ background: "var(--zaytri-surface)" }}>
                    {[
                        { key: "email" as const, label: "Email" },
                        { key: "phone" as const, label: "Phone" },
                        { key: "social" as const, label: "Social" },
                    ].map((m) => (
                        <button key={m.key}
                            onClick={() => { setMode(m.key); setError(""); setOtpSent(false); setOtpVerified(false); }}
                            className="flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all duration-300"
                            style={{
                                background: mode === m.key ? "linear-gradient(135deg, #06b6d4, #155e75)" : "transparent",
                                color: mode === m.key ? "white" : "var(--zaytri-text-dim)",
                            }}>
                            {m.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm text-red-400"
                        style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                        {error}
                    </div>
                )}

                {/* Social Signup */}
                {mode === "social" && (
                    <div className="space-y-3">
                        {[
                            { name: "Google", icon: "G", color: "#4285F4", bg: "rgba(66, 133, 244, 0.1)" },
                            { name: "Facebook", icon: "f", color: "#1877F2", bg: "rgba(24, 119, 242, 0.1)" },
                            { name: "GitHub", icon: "⌘", color: "#f1f1f5", bg: "rgba(255, 255, 255, 0.05)" },
                            { name: "Twitter", icon: "𝕏", color: "#1DA1F2", bg: "rgba(29, 161, 242, 0.1)" },
                        ].map((p) => (
                            <button key={p.name}
                                onClick={() => handleSocialLogin(p.name.toLowerCase())}
                                className="w-full flex items-center gap-3 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 hover:scale-[1.02]"
                                style={{ background: p.bg, border: "1px solid var(--zaytri-border)", color: p.color }}>
                                <span className="text-xl font-bold w-8 text-center">{p.icon}</span>
                                Continue with {p.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Email / Phone Signup */}
                {mode !== "social" && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        {/* Step 1: OTP verification */}
                        {!otpVerified && (
                            <>
                                <div>
                                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                        {mode === "email" ? "Email Address" : "Phone Number"}
                                    </label>
                                    <input
                                        type={mode === "email" ? "email" : "tel"}
                                        id="signup-identifier"
                                        className="input-field"
                                        placeholder={mode === "email" ? "you@example.com" : "+91 98765 43210"}
                                        value={mode === "email" ? email : phone}
                                        onChange={(e) => mode === "email" ? setEmail(e.target.value) : setPhone(e.target.value)}
                                        required
                                    />
                                </div>

                                {!otpSent ? (
                                    <button type="button" className="btn-primary w-full" disabled={loading} onClick={handleSendOTP}>
                                        {loading ? "Sending..." : "Send Verification Code"}
                                    </button>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                                Verification Code
                                            </label>
                                            <input type="text" id="signup-otp" className="input-field text-center text-lg tracking-[0.3em]"
                                                placeholder="000000" value={otpCode} maxLength={6}
                                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} required />
                                        </div>
                                        <button type="button" className="btn-primary w-full"
                                            disabled={loading || otpCode.length !== 6}
                                            onClick={handleVerifyOTP}>
                                            {loading ? "Verifying..." : "Verify Code"}
                                        </button>
                                    </>
                                )}
                            </>
                        )}

                        {/* Step 2: Complete registration */}
                        {otpVerified && (
                            <>
                                <div className="p-3 rounded-lg text-sm text-green-400 flex items-center gap-2"
                                    style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                                    <span>✓</span>
                                    {mode === "email" ? email : phone} verified
                                </div>

                                {mode === "phone" && (
                                    <div>
                                        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                            Email Address
                                        </label>
                                        <input type="email" className="input-field" placeholder="you@example.com"
                                            value={email} onChange={(e) => setEmail(e.target.value)} required />
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                        Username
                                    </label>
                                    <input type="text" id="signup-username" className="input-field"
                                        placeholder="Choose a username" value={username}
                                        onChange={(e) => setUsername(e.target.value)} required minLength={3} />
                                </div>

                                <div>
                                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                        Password
                                    </label>
                                    <input type="password" id="signup-password" className="input-field"
                                        placeholder="Min 8 chars, letters + numbers" value={password}
                                        onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                                </div>

                                <div>
                                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                        Confirm Password
                                    </label>
                                    <input type="password" id="signup-confirm-password" className="input-field"
                                        placeholder="Re-enter password" value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                                </div>

                                <button type="submit" id="signup-submit" className="btn-primary w-full" disabled={loading}>
                                    {loading ? "Creating account..." : "Create Account"}
                                </button>
                            </>
                        )}
                    </form>
                )}

                {/* Login Link */}
                <div className="mt-6 text-center">
                    <Link href="/login" className="text-sm transition-colors duration-300"
                        style={{ color: "var(--zaytri-text-dim)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--zaytri-primary-glow)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--zaytri-text-dim)")}>
                        Already have an account? <span className="font-semibold gradient-text">Sign in</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
