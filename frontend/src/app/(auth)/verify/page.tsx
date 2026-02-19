"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { oauthCallback } from "@/lib/auth";

function VerifyContent() {
    const router = useRouter();
    const params = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Verifying your identity...");

    useEffect(() => {
        const provider = params.get("provider");
        const code = params.get("code");

        if (provider && code) {
            handleOAuthCallback(provider, code);
        } else {
            setStatus("error");
            setMessage("Invalid verification link");
        }
    }, [params]);

    const handleOAuthCallback = async (provider: string, code: string) => {
        try {
            const redirectUri = `${window.location.origin}/verify?provider=${provider}`;
            await oauthCallback(provider, code, redirectUri);
            setStatus("success");
            setMessage("Authenticated! Redirecting to dashboard...");
            setTimeout(() => router.push("/dashboard"), 1500);
        } catch (err: unknown) {
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Authentication failed");
        }
    };

    return (
        <div className="w-full max-w-md px-4">
            <div className="glass-card p-8 text-center animate-fade-in">
                <div className="text-5xl mb-4">
                    {status === "loading" && "⏳"}
                    {status === "success" && "✅"}
                    {status === "error" && "❌"}
                </div>
                <h2 className="text-xl font-bold mb-2">
                    {status === "loading" && "Verifying..."}
                    {status === "success" && "Success!"}
                    {status === "error" && "Error"}
                </h2>
                <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                    {message}
                </p>
                {status === "error" && (
                    <button onClick={() => router.push("/login")}
                        className="btn-primary mt-4">
                        Back to Login
                    </button>
                )}
                {status === "loading" && (
                    <div className="mt-4 flex justify-center">
                        <div className="w-8 h-8 border-2 rounded-full animate-spin"
                            style={{ borderColor: "var(--zaytri-border)", borderTopColor: "var(--zaytri-red)" }} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="w-full max-w-md px-4 text-center">
                <div className="glass-card p-8 animate-fade-in">
                    <div className="text-5xl mb-4">⏳</div>
                    <p>Loading...</p>
                </div>
            </div>
        }>
            <VerifyContent />
        </Suspense>
    );
}
