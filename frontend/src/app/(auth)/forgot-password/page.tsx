"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth";
import { useToast } from "@/components/Toast";

export default function ForgotPasswordPage() {
    const toast = useToast();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await forgotPassword(email);
            setSuccess(res.message);
            setSent(true);
            toast.success("Reset Link Sent", `Check your email at ${email}`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to send reset link";
            setError(msg);
            toast.error("Request Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md px-4">
            {/* Logo */}
            <div className="text-center mb-8 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl animate-pulse-glow"
                    style={{ background: "linear-gradient(135deg, #06b6d4, #164e63)" }}>
                    🔑
                </div>
                <h1 className="text-2xl font-bold gradient-text">Forgot Password?</h1>
                <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                    {sent
                        ? "Check your email for reset instructions"
                        : "Enter your email and we'll send a reset link + OTP"}
                </p>
            </div>

            <div className="glass-card p-8 animate-fade-in">
                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm text-red-400"
                        style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 rounded-lg text-sm text-green-400"
                        style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                        {success}
                    </div>
                )}

                {!sent ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Email Address
                            </label>
                            <input type="email" id="forgot-email" className="input-field"
                                placeholder="you@example.com" value={email}
                                onChange={(e) => setEmail(e.target.value)} required autoFocus />
                        </div>
                        <button type="submit" id="forgot-submit" className="btn-primary w-full" disabled={loading}>
                            {loading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <div className="text-4xl mb-3">📧</div>
                            <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                                We sent a reset link and OTP to <strong className="text-white">{email}</strong>
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Link href={`/reset-password?email=${encodeURIComponent(email)}&method=link`}
                                className="btn-primary text-center text-sm py-3">
                                Use Link
                            </Link>
                            <Link href={`/reset-password?email=${encodeURIComponent(email)}&method=otp`}
                                className="btn-secondary text-center text-sm py-3">
                                Use OTP
                            </Link>
                        </div>

                        <button onClick={() => { setSent(false); setSuccess(""); }}
                            className="w-full text-sm py-2 transition-colors"
                            style={{ color: "var(--zaytri-text-dim)" }}>
                            Try a different email
                        </button>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <Link href="/login" className="text-sm transition-colors duration-300"
                        style={{ color: "var(--zaytri-text-dim)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--zaytri-red-glow)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--zaytri-text-dim)")}>
                        ← Back to Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
