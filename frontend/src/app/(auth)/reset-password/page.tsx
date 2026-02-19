"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithToken, resetPasswordWithOTP } from "@/lib/auth";
import { useToast } from "@/components/Toast";

function ResetPasswordForm() {
    const router = useRouter();
    const params = useSearchParams();
    const toast = useToast();
    const [method, setMethod] = useState<"link" | "otp">("link");
    const [token, setToken] = useState("");
    const [email, setEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = params.get("token");
        const e = params.get("email");
        const m = params.get("method");
        if (t) setToken(t);
        if (e) setEmail(e);
        if (m === "otp") setMethod("otp");
    }, [params]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            toast.warning("Password Mismatch", "Both password fields must match");
            return;
        }
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError("Password must contain letters and numbers");
            return;
        }

        setLoading(true);
        try {
            if (method === "link") {
                if (!token) { setError("Missing reset token. Use the link from your email."); return; }
                await resetPasswordWithToken(token, newPassword);
            } else {
                if (!email || !otpCode) { setError("Enter your email and OTP code"); return; }
                await resetPasswordWithOTP(email, otpCode, newPassword);
            }
            setSuccess("Password reset successfully! Redirecting to login...");
            toast.success("Password Reset!", "Redirecting to sign in...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Password reset failed";
            setError(msg);
            toast.error("Reset Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md px-4">
            <div className="text-center mb-8 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl animate-pulse-glow"
                    style={{ background: "linear-gradient(135deg, #06b6d4, #164e63)" }}>
                    🔒
                </div>
                <h1 className="text-2xl font-bold gradient-text">Reset Password</h1>
                <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                    Create a new secure password
                </p>
            </div>

            <div className="glass-card p-8 animate-fade-in">
                {/* Method Toggle */}
                <div className="flex mb-6 p-1 rounded-xl" style={{ background: "var(--zaytri-surface)" }}>
                    <button onClick={() => setMethod("link")}
                        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300"
                        style={{
                            background: method === "link" ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "transparent",
                            color: method === "link" ? "white" : "var(--zaytri-text-dim)",
                        }}>
                        Reset Link
                    </button>
                    <button onClick={() => setMethod("otp")}
                        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300"
                        style={{
                            background: method === "otp" ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "transparent",
                            color: method === "otp" ? "white" : "var(--zaytri-text-dim)",
                        }}>
                        OTP Code
                    </button>
                </div>

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

                <form onSubmit={handleSubmit} className="space-y-4">
                    {method === "link" && (
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Reset Token
                            </label>
                            <input type="text" className="input-field" placeholder="Paste token from email"
                                value={token} onChange={(e) => setToken(e.target.value)} required />
                            <p className="text-xs mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                                This is auto-filled if you clicked the link in your email
                            </p>
                        </div>
                    )}

                    {method === "otp" && (
                        <>
                            <div>
                                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Email Address
                                </label>
                                <input type="email" className="input-field" placeholder="you@example.com"
                                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                    OTP Code
                                </label>
                                <input type="text" className="input-field text-center text-lg tracking-[0.3em]"
                                    placeholder="000000" value={otpCode} maxLength={6}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} required />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                            New Password
                        </label>
                        <input type="password" id="reset-new-password" className="input-field"
                            placeholder="Min 8 chars, letters + numbers"
                            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                    </div>

                    <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                            Confirm Password
                        </label>
                        <input type="password" id="reset-confirm-password" className="input-field"
                            placeholder="Re-enter new password"
                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                    </div>

                    <button type="submit" id="reset-submit" className="btn-primary w-full" disabled={loading}>
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>
                </form>

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

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="w-full max-w-md px-4 text-center">
                <div className="glass-card p-8 animate-fade-in">Loading...</div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
