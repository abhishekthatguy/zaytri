"use client";

interface MetricBarProps {
    label: string;
    value: number;
    maxValue: number;
    color: string;
}

function MetricBar({ label, value, maxValue, color }: MetricBarProps) {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium" style={{ color: "var(--zaytri-text-dim)" }}>
                    {label}
                </span>
                <span className="text-sm font-bold" style={{ color }}>
                    {value.toLocaleString()}
                </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--zaytri-surface)" }}>
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                        width: `${Math.min(percentage, 100)}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                    }}
                />
            </div>
        </div>
    );
}

interface AnalyticsChartProps {
    title: string;
    metrics: {
        likes: number;
        comments: number;
        shares: number;
        reach: number;
        impressions: number;
        engagementRate: number;
    };
}

export default function AnalyticsChart({ title, metrics }: AnalyticsChartProps) {
    const maxVal = Math.max(
        metrics.likes, metrics.comments, metrics.shares,
        metrics.reach, metrics.impressions, 1
    );

    return (
        <div className="glass-card p-5 animate-fade-in">
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--zaytri-text)" }}>
                {title}
            </h3>

            <MetricBar label="Likes" value={metrics.likes} maxValue={maxVal} color="#06b6d4" />
            <MetricBar label="Comments" value={metrics.comments} maxValue={maxVal} color="#3b82f6" />
            <MetricBar label="Shares" value={metrics.shares} maxValue={maxVal} color="#22c55e" />
            <MetricBar label="Reach" value={metrics.reach} maxValue={maxVal} color="#eab308" />
            <MetricBar label="Impressions" value={metrics.impressions} maxValue={maxVal} color="#8b5cf6" />

            {/* Engagement Rate */}
            <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--zaytri-border)" }}>
                <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>Engagement Rate</span>
                <span className="text-lg font-bold gradient-text">
                    {metrics.engagementRate.toFixed(2)}%
                </span>
            </div>
        </div>
    );
}
