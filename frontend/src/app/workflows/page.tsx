"use client";

import { useState } from "react";
import WorkflowStatusComponent from "@/components/WorkflowStatus";
import { runWorkflow } from "@/lib/api";

export default function WorkflowsPage() {
    const [topic, setTopic] = useState("");
    const [platform, setPlatform] = useState("instagram");
    const [tone, setTone] = useState("professional");
    const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
    const [message, setMessage] = useState("");
    const [result, setResult] = useState<Record<string, unknown> | undefined>();
    const [loading, setLoading] = useState(false);

    const PLATFORMS = ["instagram", "facebook", "twitter", "youtube"];
    const TONES = ["professional", "casual", "educational", "confident", "humorous", "inspirational"];

    const handleRun = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;

        setLoading(true);
        setStatus("running");
        setMessage("Running pipeline: Content Creator → Hashtags → Review...");
        setResult(undefined);

        try {
            const data: any = await runWorkflow(topic, platform, tone);
            setStatus("completed");
            setMessage("Pipeline completed successfully!");
            setResult(data.data);
        } catch (err: unknown) {
            setStatus("failed");
            setMessage(err instanceof Error ? err.message : "Pipeline failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-8">
                <h1 className="text-2xl font-bold">🔄 Workflows</h1>
                <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                    Trigger the AI content creation pipeline
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Workflow Form */}
                <div className="glass-card p-6">
                    <h2 className="text-lg font-bold mb-4">⚡ New Workflow</h2>

                    <form onSubmit={handleRun} className="space-y-5">
                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Topic *
                            </label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g., AI automation for tech founders"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Platform
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {PLATFORMS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPlatform(p)}
                                        className={`p-3 rounded-xl text-sm font-medium capitalize transition-all duration-300 ${platform === p ? "text-white" : ""
                                            }`}
                                        style={{
                                            background: platform === p
                                                ? "linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.1))"
                                                : "var(--zaytri-surface)",
                                            border: `1px solid ${platform === p ? "#06b6d4" : "var(--zaytri-border)"}`,
                                            color: platform === p ? "white" : "var(--zaytri-text-dim)",
                                        }}
                                    >
                                        {p === "instagram" && "📸 "}
                                        {p === "facebook" && "👤 "}
                                        {p === "twitter" && "🐦 "}
                                        {p === "youtube" && "▶️ "}
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                Tone
                            </label>
                            <select
                                className="input-field cursor-pointer"
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                            >
                                {TONES.map((t) => (
                                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                            </select>
                        </div>

                        <button type="submit" className="btn-primary w-full" disabled={loading || !topic.trim()}>
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Running Pipeline...
                                </span>
                            ) : (
                                "🚀 Run Content Pipeline"
                            )}
                        </button>
                    </form>
                </div>

                {/* Pipeline Status */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold">Pipeline Status</h2>
                    <WorkflowStatusComponent status={status} message={message} data={result} />

                    {/* Pipeline Steps */}
                    <div className="glass-card p-5">
                        <h3 className="text-sm font-bold mb-4">Pipeline Steps</h3>
                        <div className="space-y-3">
                            {[
                                { step: "1", label: "Content Creator Agent", desc: "Generate caption, hook, CTA" },
                                { step: "2", label: "Hashtag Generator Agent", desc: "Generate 20 targeted hashtags" },
                                { step: "3", label: "Review Agent", desc: "Score and optimize content" },
                                { step: "4", label: "Save to Database", desc: "Store for approval" },
                            ].map((item) => (
                                <div key={item.step} className="flex items-center gap-3 p-3 rounded-lg"
                                    style={{ background: "var(--zaytri-surface)" }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                                        style={{
                                            background: "linear-gradient(135deg, #06b6d4, #164e63)",
                                        }}>
                                        {item.step}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
