"use client";

import { useState, useEffect, useCallback } from "react";
import AnalyticsChart from "@/components/AnalyticsChart";
import { getAnalyticsReport, getPlatformAnalytics } from "@/lib/api";

interface AnalyticsSummary {
    total_likes: number;
    total_comments: number;
    total_shares: number;
    total_reach: number;
    avg_engagement_rate: number;
}

export default function AnalyticsPage() {
    const [days, setDays] = useState(7);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

    const PLATFORMS = [
        { key: null, label: "All Platforms", icon: "🌐" },
        { key: "instagram", label: "Instagram", icon: "📸" },
        { key: "facebook", label: "Facebook", icon: "👤" },
        { key: "twitter", label: "Twitter/X", icon: "🐦" },
        { key: "youtube", label: "YouTube", icon: "▶️" },
    ];

    const TIME_RANGES = [
        { days: 7, label: "7 Days" },
        { days: 14, label: "14 Days" },
        { days: 30, label: "30 Days" },
        { days: 90, label: "90 Days" },
    ];

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            let data: any;
            if (selectedPlatform) {
                data = await getPlatformAnalytics(selectedPlatform, days);
            } else {
                data = await getAnalyticsReport(days);
            }
            setSummary(data);
        } catch (err) {
            // If no data yet, show empty state
            setSummary({
                total_likes: 0,
                total_comments: 0,
                total_shares: 0,
                total_reach: 0,
                avg_engagement_rate: 0,
            });
        } finally {
            setLoading(false);
        }
    }, [days, selectedPlatform]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const metrics = summary
        ? {
            likes: summary.total_likes,
            comments: summary.total_comments,
            shares: summary.total_shares,
            reach: summary.total_reach,
            impressions: 0,
            engagementRate: summary.avg_engagement_rate,
        }
        : { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, engagementRate: 0 };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">📊 Analytics</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                        Track your social media performance
                    </p>
                </div>
            </div>

            {/* Time Range + Platform Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex gap-2">
                    {TIME_RANGES.map((range) => (
                        <button
                            key={range.days}
                            onClick={() => setDays(range.days)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300"
                            style={{
                                background: days === range.days
                                    ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                                    : "var(--zaytri-surface-2)",
                                border: `1px solid ${days === range.days ? "transparent" : "var(--zaytri-border)"}`,
                                color: days === range.days ? "white" : "var(--zaytri-text-dim)",
                            }}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    {PLATFORMS.map((p) => (
                        <button
                            key={p.key || "all"}
                            onClick={() => setSelectedPlatform(p.key)}
                            className="px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300"
                            style={{
                                background: selectedPlatform === p.key
                                    ? "rgba(6, 182, 212, 0.15)"
                                    : "var(--zaytri-surface-2)",
                                border: `1px solid ${selectedPlatform === p.key ? "#06b6d4" : "var(--zaytri-border)"}`,
                                color: selectedPlatform === p.key ? "var(--zaytri-red-glow)" : "var(--zaytri-text-dim)",
                            }}
                        >
                            {p.icon} {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                </div>
            ) : (
                <>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 stagger-children">
                        {[
                            { label: "Total Likes", value: metrics.likes, icon: "❤️", color: "#06b6d4" },
                            { label: "Comments", value: metrics.comments, icon: "💬", color: "#3b82f6" },
                            { label: "Shares", value: metrics.shares, icon: "🔄", color: "#22c55e" },
                            { label: "Total Reach", value: metrics.reach, icon: "👁️", color: "#eab308" },
                        ].map((stat) => (
                            <div key={stat.label} className="glass-card p-5">
                                <span className="text-2xl">{stat.icon}</span>
                                <p className="text-2xl font-bold mt-2">{stat.value.toLocaleString()}</p>
                                <p className="text-xs mt-1" style={{ color: "var(--zaytri-text-dim)" }}>{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AnalyticsChart
                            title={`Performance (${days} days)`}
                            metrics={metrics}
                        />

                        <div className="glass-card p-6">
                            <h3 className="text-sm font-bold mb-4">⚡ Engagement Rate</h3>
                            <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                    <p className="text-5xl font-bold gradient-text mb-2">
                                        {metrics.engagementRate.toFixed(2)}%
                                    </p>
                                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                                        Average engagement rate
                                    </p>
                                    <div className="mt-4 flex items-center justify-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                background:
                                                    metrics.engagementRate > 5
                                                        ? "#22c55e"
                                                        : metrics.engagementRate > 2
                                                            ? "#eab308"
                                                            : "#06b6d4",
                                            }}
                                        />
                                        <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                            {metrics.engagementRate > 5
                                                ? "Excellent"
                                                : metrics.engagementRate > 2
                                                    ? "Good"
                                                    : "Needs improvement"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
