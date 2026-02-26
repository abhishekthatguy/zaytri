"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { oauthCallback } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { useSession } from "@/components/SessionProvider";

function CallbackContent() {
    const router = useRouter();
    const params = useSearchParams();
    const toast = useToast();
    const { refreshSession } = useSession();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Verifying your identity...");

    useEffect(() => {
        const code = params.get("code");
        const state = params.get("state"); // provider name passed via OAuth state param

        if (code && state) {
            handleOAuthCallback(state, code);
        } else if (code) {
            // Fallback: try to detect provider from URL or default to google
            setStatus("error");
            setMessage("Missing provider information. Please try again.");
        } else {
            setStatus("error");
            setMessage("Invalid callback — no authorization code received.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOAuthCallback = async (provider: string, code: string) => {
        try {
            const redirectUri = `${window.location.origin}/auth/callback`;
            const data = await oauthCallback(provider, code, redirectUri);
            setStatus("success");
            setMessage(`Welcome, ${data.user.display_name || data.user.username}! Redirecting...`);
            toast.success("Signed In!", `Authenticated via ${provider}`);
            refreshSession();
            setTimeout(() => router.push("/dashboard"), 1200);
        } catch (err: unknown) {
            setStatus("error");
            const msg = err instanceof Error ? err.message : "Authentication failed";
            setMessage(msg);
            toast.error("OAuth Failed", msg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--zaytri-bg)" }}>
            <div className="w-full max-w-md px-4">
                <div className="glass-card p-8 text-center animate-fade-in">
                    <div className="text-5xl mb-4">
                        {status === "loading" && "⏳"}
                        {status === "success" && "✅"}
                        {status === "error" && "❌"}
                    </div>
                    <h2 className="text-xl font-bold mb-2">
                        {status === "loading" && "Authenticating..."}
                        {status === "success" && "Success!"}
                        {status === "error" && "Authentication Failed"}
                    </h2>
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                        {message}
                    </p>
                    {status === "error" && (
                        <button onClick={() => router.push("/login")}
                            className="btn-primary mt-6">
                            Back to Login
                        </button>
                    )}
                    {status === "loading" && (
                        <div className="mt-6 flex justify-center">
                            <div className="w-10 h-10 border-2 rounded-full animate-spin"
                                style={{ borderColor: "var(--zaytri-border)", borderTopColor: "var(--zaytri-red)" }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OAuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--zaytri-bg)" }}>
                <div className="w-full max-w-md px-4 text-center">
                    <div className="glass-card p-8 animate-fade-in">
                        <div className="text-5xl mb-4">⏳</div>
                        <p style={{ color: "var(--zaytri-text-dim)" }}>Loading...</p>
                    </div>
                </div>
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}
