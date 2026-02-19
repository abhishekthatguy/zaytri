"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getDashboardStats,
  listSocialConnections,
  listContent,
  healthCheck,
  type DashboardStats,
  type SocialConnectionInfo,
} from "@/lib/api";

/* ─── Platform metadata ──────────────────────────────────────────────────── */

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  instagram: { icon: "📸", color: "#E1306C", label: "Instagram" },
  facebook: { icon: "📘", color: "#1877F2", label: "Facebook" },
  twitter: { icon: "𝕏", color: "#1DA1F2", label: "Twitter/X" },
  youtube: { icon: "▶️", color: "#FF0000", label: "YouTube" },
  linkedin: { icon: "💼", color: "#0A66C2", label: "LinkedIn" },
  reddit: { icon: "🤖", color: "#FF4500", label: "Reddit" },
  medium: { icon: "✍️", color: "#00AB6C", label: "Medium" },
  blogger: { icon: "📝", color: "#FF5722", label: "Blogger" },
  gmail: { icon: "📧", color: "#EA4335", label: "Gmail" },
};

/* ─── Interfaces ─────────────────────────────────────────────────────────── */

interface ContentItem {
  id: string;
  topic: string;
  platform: string;
  status: string;
  caption?: string;
  post_text?: string;
  improved_text?: string;
  review_score?: number;
  created_at: string;
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
  const [activePlatform, setActivePlatform] = useState<string>("");
  const [platformContent, setPlatformContent] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Group connections by platform
  const connectedPlatforms = connections.reduce<Record<string, SocialConnectionInfo[]>>(
    (acc, conn) => {
      if (!acc[conn.platform]) acc[conn.platform] = [];
      acc[conn.platform].push(conn);
      return acc;
    },
    {}
  );

  const platformKeys = Object.keys(connectedPlatforms);

  /* ─── Data fetching ────────────────────────────────────────────────────── */

  const fetchDashboard = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [statsData, conns, health] = await Promise.allSettled([
        getDashboardStats(),
        listSocialConnections(),
        healthCheck(),
      ]);
      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (conns.status === "fulfilled") setConnections(conns.value);
      if (health.status === "fulfilled") setApiHealthy(true);
      else setApiHealthy(false);
    } catch {
      setApiHealthy(false);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchPlatformContent = useCallback(async (platform: string) => {
    setLoadingContent(true);
    try {
      const data = await listContent({ platform, limit: 10 });
      setPlatformContent((data as { items: ContentItem[] }).items || []);
    } catch {
      setPlatformContent([]);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (activePlatform) {
      fetchPlatformContent(activePlatform);
    }
  }, [activePlatform, fetchPlatformContent]);

  // Auto-select first platform tab
  useEffect(() => {
    if (platformKeys.length > 0 && !activePlatform) {
      setActivePlatform(platformKeys[0]);
    }
  }, [platformKeys, activePlatform]);

  /* ─── Stat cards ───────────────────────────────────────────────────────── */

  const statCards = [
    {
      label: "Total Content",
      value: stats?.total ?? 0,
      icon: "📝",
      color: "#06b6d4",
    },
    {
      label: "Approved",
      value: stats?.by_status?.approved ?? 0,
      icon: "✅",
      color: "#22c55e",
    },
    {
      label: "Published",
      value: stats?.by_status?.published ?? 0,
      icon: "🚀",
      color: "#8b5cf6",
    },
    {
      label: "Avg Score",
      value: stats ? `${stats.avg_review_score}/10` : "—",
      icon: "⭐",
      color: "#eab308",
    },
    {
      label: "This Week",
      value: stats?.recent_published_7d ?? 0,
      icon: "📈",
      color: "#ec4899",
    },
    {
      label: "Platforms",
      value: platformKeys.length,
      icon: "🔗",
      color: "#f97316",
    },
  ];

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome to <span className="gradient-text">Zaytri</span>
          </h1>
          <p style={{ color: "var(--zaytri-text-dim)" }}>
            Your AI-powered social media command center
          </p>
        </div>
        <div className="flex items-center gap-3">
          {apiHealthy !== null && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: apiHealthy ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                color: apiHealthy ? "#22c55e" : "#ef4444",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: apiHealthy ? "#22c55e" : "#ef4444" }}
              />
              {apiHealthy ? "API Online" : "API Offline"}
            </span>
          )}
          <button
            onClick={fetchDashboard}
            className="btn-secondary text-xs"
            style={{ padding: "6px 14px" }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 stagger-children">
        {statCards.map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              {loadingStats ? (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}
                >
                  Loading
                </span>
              ) : (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: `${stat.color}22`, color: stat.color }}
                >
                  Live
                </span>
              )}
            </div>
            <p className="text-2xl font-bold mb-1">{loadingStats ? "…" : stat.value}</p>
            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Connected Platforms + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Connected Platforms */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            🔗 Connected Platforms
            <span
              className="text-xs font-normal px-2 py-0.5 rounded-full"
              style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}
            >
              {platformKeys.length} active
            </span>
          </h2>

          {platformKeys.length === 0 ? (
            <div
              className="text-center py-8 rounded-xl"
              style={{ background: "var(--zaytri-surface)", border: "1px dashed var(--zaytri-border)" }}
            >
              <p className="text-4xl mb-3">🔌</p>
              <p className="text-sm font-medium mb-1">No platforms connected</p>
              <p className="text-xs mb-4" style={{ color: "var(--zaytri-text-dim)" }}>
                Connect your social media accounts to get started
              </p>
              <Link href="/settings" className="btn-primary text-sm">
                Connect Platforms →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {platformKeys.map((platform) => {
                const meta = PLATFORM_META[platform] || { icon: "🌐", color: "#94a3b8", label: platform };
                const accounts = connectedPlatforms[platform];
                return (
                  <div
                    key={platform}
                    className="p-4 rounded-xl transition-all duration-300 cursor-pointer group"
                    style={{
                      background: "var(--zaytri-surface)",
                      border: activePlatform === platform
                        ? `1px solid ${meta.color}`
                        : "1px solid var(--zaytri-border)",
                      boxShadow: activePlatform === platform
                        ? `0 0 20px ${meta.color}33`
                        : "none",
                    }}
                    onClick={() => setActivePlatform(platform)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{meta.icon}</span>
                      <span className="text-sm font-semibold">{meta.label}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {accounts.map((acc) => (
                        <div key={acc.id} className="flex items-center gap-2">
                          {acc.platform_avatar_url ? (
                            <img
                              src={acc.platform_avatar_url}
                              alt=""
                              className="w-5 h-5 rounded-full"
                              style={{ border: `1px solid ${meta.color}44` }}
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: `${meta.color}22`, color: meta.color }}
                            >
                              {(acc.platform_username || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs truncate" style={{ color: "var(--zaytri-text-dim)" }}>
                            @{acc.platform_username || "connected"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Add More button */}
              <Link
                href="/settings"
                className="p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all duration-300"
                style={{
                  background: "var(--zaytri-surface)",
                  border: "1px dashed var(--zaytri-border)",
                }}
              >
                <span className="text-2xl opacity-50">+</span>
                <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                  Add Platform
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-4">⚡ Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3">
            <Link href="/workflows" className="btn-primary text-center text-sm">
              🔄 New Workflow
            </Link>
            <Link href="/content" className="btn-secondary text-center text-sm">
              📝 View Content
            </Link>
            <Link href="/analytics" className="btn-secondary text-center text-sm">
              📊 Analytics
            </Link>
            <Link href="/settings" className="btn-secondary text-center text-sm">
              ⚙️ Settings
            </Link>
          </div>

          {/* Pipeline mini-flow */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--zaytri-text-dim)" }}>
              PIPELINE FLOW
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              {["Create", "→", "Hashtag", "→", "Review", "→", "Approve", "→", "Publish", "→", "Engage"].map(
                (step, i) =>
                  step === "→" ? (
                    <span key={i} style={{ color: "var(--zaytri-primary)" }}>→</span>
                  ) : (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-md font-medium"
                      style={{
                        background: "var(--zaytri-surface-2)",
                        border: "1px solid var(--zaytri-border)",
                      }}
                    >
                      {step}
                    </span>
                  )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Platform Tabs + Content Feed */}
      {platformKeys.length > 0 && (
        <div className="glass-card p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">📱 Platform Content</h2>

          {/* Tab bar */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto"
            style={{ background: "var(--zaytri-surface)" }}
          >
            {platformKeys.map((platform) => {
              const meta = PLATFORM_META[platform] || { icon: "🌐", label: platform, color: "#94a3b8" };
              const isActive = activePlatform === platform;
              return (
                <button
                  key={platform}
                  onClick={() => setActivePlatform(platform)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)`
                      : "transparent",
                    color: isActive ? meta.color : "var(--zaytri-text-dim)",
                    border: isActive ? `1px solid ${meta.color}44` : "1px solid transparent",
                  }}
                >
                  <span>{meta.icon}</span>
                  {meta.label}
                  {connectedPlatforms[platform].length > 1 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: `${meta.color}22` }}
                    >
                      {connectedPlatforms[platform].length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Account selector (if multiple accounts for this platform) */}
          {activePlatform && connectedPlatforms[activePlatform]?.length > 1 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: "var(--zaytri-text-dim)" }}>
                Account:
              </span>
              <select
                className="input-field text-xs"
                style={{ width: "auto", padding: "6px 12px" }}
                defaultValue=""
              >
                <option value="">All accounts</option>
                {connectedPlatforms[activePlatform].map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.platform_username || acc.platform_account_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Content feed */}
          {loadingContent ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                Loading content…
              </p>
            </div>
          ) : platformContent.length === 0 ? (
            <div
              className="text-center py-8 rounded-xl"
              style={{ background: "var(--zaytri-surface)", border: "1px dashed var(--zaytri-border)" }}
            >
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                No content for {PLATFORM_META[activePlatform]?.label || activePlatform} yet
              </p>
              <Link href="/workflows" className="btn-primary text-sm mt-3 inline-block">
                Create Content →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {platformContent.map((item) => (
                <ContentCard key={item.id} item={item} platform={activePlatform} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent Status */}
      <AgentStatusGrid />
    </div>
  );
}

/* ─── Content Card Component ─────────────────────────────────────────────── */

function ContentCard({ item, platform }: { item: ContentItem; platform: string }) {
  const meta = PLATFORM_META[platform] || { icon: "🌐", color: "#94a3b8", label: platform };
  const text = item.improved_text || item.post_text || item.caption || "(no content)";
  const preview = text.length > 150 ? text.slice(0, 150) + "…" : text;

  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
    reviewed: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
    approved: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
    published: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6" },
    failed: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  };

  const statusStyle = statusColors[item.status] || statusColors.draft;

  return (
    <div
      className="p-4 rounded-xl transition-all duration-300 hover:border-opacity-50 group"
      style={{
        background: "var(--zaytri-surface)",
        border: "1px solid var(--zaytri-border)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{meta.icon}</span>
            <span className="text-sm font-semibold truncate">{item.topic}</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase"
              style={{ background: statusStyle.bg, color: statusStyle.text }}
            >
              {item.status}
            </span>
            {item.review_score !== undefined && item.review_score !== null && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(234,179,8,0.15)", color: "#eab308" }}>
                ⭐ {item.review_score}/10
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--zaytri-text-dim)" }}>
            {preview}
          </p>
          <p className="text-[10px] mt-2" style={{ color: "var(--zaytri-text-dim)", opacity: 0.6 }}>
            {new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Interaction Controls (stubs) */}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-2 rounded-lg text-xs transition-colors"
            style={{ background: "var(--zaytri-surface-2)", border: "1px solid var(--zaytri-border)" }}
            title="Like"
          >
            ❤️
          </button>
          <button
            className="p-2 rounded-lg text-xs transition-colors"
            style={{ background: "var(--zaytri-surface-2)", border: "1px solid var(--zaytri-border)" }}
            title="Comment"
          >
            💬
          </button>
          <button
            className="p-2 rounded-lg text-xs transition-colors"
            style={{ background: "var(--zaytri-surface-2)", border: "1px solid var(--zaytri-border)" }}
            title="Reshare"
          >
            🔄
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Agent Status Grid ──────────────────────────────────────────────────── */

function AgentStatusGrid() {
  const AGENTS = [
    { name: "Content Creator", status: "ready", icon: "📝", desc: "Generates captions, hooks, CTAs" },
    { name: "Hashtag Generator", status: "ready", icon: "#️⃣", desc: "Niche & broad hashtag research" },
    { name: "Review Agent", status: "ready", icon: "🔍", desc: "Grammar, compliance, optimization" },
    { name: "Data Parser", status: "ready", icon: "📋", desc: "CSV, Google Sheets, JSON parsing" },
    { name: "Scheduler Bot", status: "ready", icon: "📅", desc: "Daily cron scheduling" },
    { name: "Publisher Bot", status: "ready", icon: "🚀", desc: "Publishes to all platforms" },
    { name: "Engagement Bot", status: "ready", icon: "💬", desc: "AI comment replies" },
    { name: "Analytics Agent", status: "ready", icon: "📊", desc: "Weekly performance reports" },
  ];

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-bold mb-4">🤖 Agent Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
        {AGENTS.map((agent) => (
          <div
            key={agent.name}
            className="p-4 rounded-xl transition-all duration-300 hover:border-opacity-50"
            style={{
              background: "var(--zaytri-surface)",
              border: "1px solid var(--zaytri-border)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{agent.icon}</span>
              <span className="text-sm font-semibold">{agent.name}</span>
            </div>
            <p className="text-xs mb-2" style={{ color: "var(--zaytri-text-dim)" }}>
              {agent.desc}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-green-400 font-medium capitalize">
                {agent.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
