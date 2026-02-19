"use client";

interface WorkflowStatusProps {
    status: "idle" | "running" | "completed" | "failed";
    message?: string;
    data?: Record<string, unknown>;
}

const STATUS_CONFIG = {
    idle: { color: "var(--zaytri-text-dim)", icon: "⏸️", label: "Idle" },
    running: { color: "var(--zaytri-yellow)", icon: "⚡", label: "Running" },
    completed: { color: "var(--zaytri-green)", icon: "✅", label: "Completed" },
    failed: { color: "var(--zaytri-red-glow)", icon: "❌", label: "Failed" },
};

export default function WorkflowStatus({ status, message, data }: WorkflowStatusProps) {
    const config = STATUS_CONFIG[status];

    return (
        <div className="glass-card p-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{config.icon}</span>
                <div>
                    <h3 className="text-sm font-bold" style={{ color: config.color }}>
                        {config.label}
                    </h3>
                    {message && (
                        <p className="text-xs mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                            {message}
                        </p>
                    )}
                </div>
            </div>

            {/* Progress bar for running state */}
            {status === "running" && (
                <div className="w-full h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "var(--zaytri-surface)" }}>
                    <div
                        className="h-full rounded-full"
                        style={{
                            background: "linear-gradient(90deg, var(--zaytri-red), var(--zaytri-red-glow))",
                            width: "60%",
                            animation: "pulse-glow 2s ease-in-out infinite",
                            transition: "width 0.5s ease",
                        }}
                    />
                </div>
            )}

            {/* Result data preview */}
            {status === "completed" && data && (
                <div className="mt-3 p-3 rounded-lg text-xs font-mono" style={{ background: "var(--zaytri-surface)", color: "var(--zaytri-text-dim)" }}>
                    <pre className="overflow-auto max-h-32">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
