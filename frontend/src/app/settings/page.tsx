"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getCronSettings,
    updateCronSettings,
    getGoogleDriveConfig,
    updateGoogleDriveConfig,
    disconnectGoogleDrive,
    listLLMProviders,
    saveLLMProviderKey,
    deleteLLMProviderKey,
    testLLMProvider,
    listAgentModelConfigs,
    assignAgentModel,
    resetAgentModel,
    listSocialPlatforms,
    getSocialConnectURL,
    handleSocialCallback,
    listSocialConnections,
    disconnectSocialAccount,
    getWhatsAppStatus,
    listWhatsAppApprovals,
    type CronSettings,
    type GoogleDriveConfig,
    type LLMProvider,
    type AgentModelConfig,
    type SocialPlatformInfo,
    type SocialConnectionInfo,
    type WhatsAppStatus,
    type WhatsAppApproval,
} from "@/lib/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
    { id: "cron", label: "Scheduling", icon: "⏰" },
    { id: "platforms", label: "Social Media", icon: "🔗" },
    { id: "whatsapp", label: "WhatsApp", icon: "📲" },
    { id: "drive", label: "Google Drive", icon: "📁" },
    { id: "aimodels", label: "AI Models", icon: "🧠" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIMEZONES = [
    "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
    "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland", "UTC",
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
    background: "var(--zaytri-surface)",
    border: "1px solid var(--zaytri-border)",
    borderRadius: "16px",
    padding: "24px",
    overflow: "hidden",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--zaytri-border)",
    background: "var(--zaytri-bg)",
    color: "var(--zaytri-text)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

const btnPrimary: React.CSSProperties = {
    padding: "10px 24px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
    color: "white",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
};

const btnSecondary: React.CSSProperties = {
    ...btnPrimary,
    background: "var(--zaytri-surface-2)",
    border: "1px solid var(--zaytri-border)",
};

const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: "transparent",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#ef4444",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--zaytri-text-dim)",
    marginBottom: "6px",
};

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
    useEffect(() => {
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <div
            style={{
                position: "fixed",
                top: 24,
                right: 24,
                zIndex: 1000,
                padding: "14px 24px",
                borderRadius: "12px",
                background: type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: `1px solid ${type === "success" ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                color: type === "success" ? "#22c55e" : "#ef4444",
                fontSize: "14px",
                fontWeight: 500,
                backdropFilter: "blur(10px)",
                animation: "fadeIn 0.3s ease",
            }}
        >
            {type === "success" ? "✅" : "❌"} {message}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("cron");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showToast = useCallback((message: string, type: "success" | "error") => {
        setToast({ message, type });
    }, []);

    return (
        <div className="min-h-screen" style={{ background: "var(--zaytri-bg)" }}>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold gradient-text mb-2">Settings</h1>
                <p style={{ color: "var(--zaytri-text-dim)" }}>
                    Configure your agents, connect platforms, and manage integrations
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 flex-wrap">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: "10px 20px",
                            borderRadius: "12px",
                            border: "1px solid",
                            borderColor: activeTab === tab.id ? "rgba(6, 182, 212, 0.5)" : "var(--zaytri-border)",
                            background: activeTab === tab.id
                                ? "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.1))"
                                : "var(--zaytri-surface)",
                            color: activeTab === tab.id ? "white" : "var(--zaytri-text-dim)",
                            fontSize: "14px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.3s",
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === "cron" && <CronTab onToast={showToast} />}
            {activeTab === "platforms" && <SocialConnectionsTab onToast={showToast} />}
            {activeTab === "whatsapp" && <WhatsAppApprovalTab onToast={showToast} />}
            {activeTab === "drive" && <DriveTab onToast={showToast} />}
            {activeTab === "aimodels" && <AIModelsTab onToast={showToast} />}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: Cron Jobs
// ═══════════════════════════════════════════════════════════════════════════════

function CronTab({ onToast }: { onToast: (msg: string, t: "success" | "error") => void }) {
    const [settings, setSettings] = useState<CronSettings>({
        scheduler_hour: 9,
        scheduler_minute: 0,
        engagement_delay_hours: 2,
        analytics_day_of_week: 1,
        analytics_hour: 8,
        analytics_minute: 0,
        timezone: "Asia/Kolkata",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getCronSettings()
            .then(setSettings)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await updateCronSettings(settings);
            setSettings(updated);
            onToast("Cron schedules saved successfully", "success");
        } catch {
            onToast("Failed to save cron settings", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ color: "var(--zaytri-text-dim)" }}>Loading settings...</div>;

    return (
        <div className="grid gap-6" style={{ maxWidth: 800 }}>
            {/* Scheduler Bot */}
            <div style={cardStyle}>
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)" }}
                    >
                        📅
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Scheduler Bot</h3>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            Runs daily to publish approved content
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label style={labelStyle}>Hour (0–23)</label>
                        <input
                            type="number"
                            min={0} max={23}
                            value={settings.scheduler_hour}
                            onChange={(e) => setSettings({ ...settings, scheduler_hour: +e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Minute (0–59)</label>
                        <input
                            type="number"
                            min={0} max={59}
                            value={settings.scheduler_minute}
                            onChange={(e) => setSettings({ ...settings, scheduler_minute: +e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                </div>
            </div>

            {/* Engagement Bot */}
            <div style={cardStyle}>
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(168, 85, 247, 0.15)", border: "1px solid rgba(168, 85, 247, 0.3)" }}
                    >
                        💬
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Engagement Bot</h3>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            Delay after publishing before monitoring comments
                        </p>
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Delay (hours)</label>
                    <input
                        type="number"
                        min={1} max={48}
                        value={settings.engagement_delay_hours}
                        onChange={(e) => setSettings({ ...settings, engagement_delay_hours: +e.target.value })}
                        style={{ ...inputStyle, maxWidth: 200 }}
                    />
                </div>
            </div>

            {/* Analytics Agent */}
            <div style={cardStyle}>
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)" }}
                    >
                        📊
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Analytics Agent</h3>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            Weekly analytics report generation
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label style={labelStyle}>Day of Week</label>
                        <select
                            value={settings.analytics_day_of_week}
                            onChange={(e) => setSettings({ ...settings, analytics_day_of_week: +e.target.value })}
                            style={selectStyle}
                        >
                            {DAYS.map((d, i) => (
                                <option key={d} value={i}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Hour (0–23)</label>
                        <input
                            type="number"
                            min={0} max={23}
                            value={settings.analytics_hour}
                            onChange={(e) => setSettings({ ...settings, analytics_hour: +e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Minute (0–59)</label>
                        <input
                            type="number"
                            min={0} max={59}
                            value={settings.analytics_minute}
                            onChange={(e) => setSettings({ ...settings, analytics_minute: +e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                </div>
            </div>

            {/* Timezone */}
            <div style={cardStyle}>
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(234, 179, 8, 0.15)", border: "1px solid rgba(234, 179, 8, 0.3)" }}
                    >
                        🌍
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Timezone</h3>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            All schedules use this timezone
                        </p>
                    </div>
                </div>
                <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    style={{ ...selectStyle, maxWidth: 320 }}
                >
                    {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                    ))}
                </select>
            </div>

            {/* Save */}
            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                    {saving ? "Saving..." : "💾 Save Schedules"}
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Social Media Connections (OAuth)
// ═══════════════════════════════════════════════════════════════════════════════

function SocialConnectionsTab({ onToast }: { onToast: (msg: string, t: "success" | "error") => void }) {
    const [platforms, setPlatforms] = useState<SocialPlatformInfo[]>([]);
    const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const [plats, conns] = await Promise.all([
                listSocialPlatforms(),
                listSocialConnections(),
            ]);
            setPlatforms(plats);
            setConnections(conns);
        } catch {
            setPlatforms([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Listen for OAuth callback messages from popup window
    useEffect(() => {
        const handler = async (event: MessageEvent) => {
            if (event.data?.type === "social-oauth-callback") {
                const { platform, code, redirectUri } = event.data;
                setConnecting(platform);
                try {
                    await handleSocialCallback(platform, code, redirectUri);
                    onToast(`${platform} connected successfully!`, "success");
                    await loadData();
                } catch (err) {
                    onToast(`Failed to connect ${platform}: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
                } finally {
                    setConnecting(null);
                }
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [loadData, onToast]);

    const handleConnect = async (platform: string) => {
        setConnecting(platform);
        try {
            const redirectUri = `${window.location.origin}/api/social-callback`;
            const { url } = await getSocialConnectURL(platform, redirectUri);

            // Open OAuth popup
            const width = 600, height = 700;
            const left = window.screenX + (window.innerWidth - width) / 2;
            const top = window.screenY + (window.innerHeight - height) / 2;
            window.open(
                url,
                `Connect ${platform}`,
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
            );
        } catch (err) {
            onToast(`Failed to start OAuth for ${platform}: ${err instanceof Error ? err.message : "Not configured"}`, "error");
            setConnecting(null);
        }
    };

    const handleDisconnect = async (connectionId: string, platformName: string) => {
        setDisconnecting(connectionId);
        try {
            await disconnectSocialAccount(connectionId);
            onToast(`${platformName} account disconnected`, "success");
            await loadData();
        } catch {
            onToast("Failed to disconnect account", "error");
        } finally {
            setDisconnecting(null);
        }
    };

    if (loading) return <div style={{ color: "var(--zaytri-text-dim)" }}>Loading platforms...</div>;

    // Group connections by platform
    const connectionsByPlatform: Record<string, SocialConnectionInfo[]> = {};
    connections.forEach((c) => {
        if (!connectionsByPlatform[c.platform]) connectionsByPlatform[c.platform] = [];
        connectionsByPlatform[c.platform].push(c);
    });

    return (
        <div style={{ maxWidth: 900 }}>
            {/* Header */}
            <div className="mb-6" style={{
                ...cardStyle,
                background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(139, 92, 246, 0.05))",
                borderColor: "rgba(6, 182, 212, 0.2)",
            }}>
                <h3 className="font-semibold text-white mb-2">🔗 Connect Your Social Accounts</h3>
                <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                    Click <strong style={{ color: "white" }}>Connect</strong> to authorize Zaytri via OAuth.
                    No API keys needed — just log in and grant permission.
                    You can connect multiple accounts per platform.
                </p>
            </div>

            {/* Platform Grid */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {platforms.map((plat) => {
                    const platConnections = connectionsByPlatform[plat.platform] || [];
                    const hasConnections = platConnections.length > 0;
                    const isConnecting = connecting === plat.platform;

                    return (
                        <div
                            key={plat.platform}
                            style={{
                                ...cardStyle,
                                borderColor: hasConnections ? "rgba(34, 197, 94, 0.3)" : "var(--zaytri-border)",
                                position: "relative",
                            }}
                        >
                            {/* Status dot */}
                            {hasConnections && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 12,
                                        right: 12,
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: "#22c55e",
                                        boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)",
                                    }}
                                />
                            )}

                            {/* Platform Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <div
                                    className="flex items-center justify-center"
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        fontSize: 24,
                                        background: hasConnections
                                            ? "rgba(34, 197, 94, 0.1)"
                                            : "rgba(139, 92, 246, 0.1)",
                                        border: `1px solid ${hasConnections ? "rgba(34, 197, 94, 0.2)" : "rgba(139, 92, 246, 0.2)"}`,
                                    }}
                                >
                                    {plat.icon}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-white">{plat.display_name}</h4>
                                    <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                        {hasConnections
                                            ? `${platConnections.length} account${platConnections.length > 1 ? "s" : ""} connected`
                                            : plat.configured ? "Ready to connect" : "Not configured"
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Connected Accounts */}
                            {platConnections.map((conn) => (
                                <div
                                    key={conn.id}
                                    className="flex items-center justify-between mb-3"
                                    style={{
                                        padding: 12,
                                        borderRadius: 12,
                                        background: "var(--zaytri-bg)",
                                        border: "1px solid var(--zaytri-border)",
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        {conn.platform_avatar_url ? (
                                            <img
                                                src={conn.platform_avatar_url}
                                                alt=""
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "50%",
                                                    objectFit: "cover",
                                                    border: "1px solid var(--zaytri-border)",
                                                }}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "50%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    background: "rgba(6, 182, 212, 0.2)",
                                                    color: "#06b6d4",
                                                }}
                                            >
                                                {(conn.platform_username || "?")[0].toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p style={{ fontSize: 14, fontWeight: 500, color: "white" }}>
                                                {conn.platform_username || "Unknown"}
                                            </p>
                                            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                                {conn.account_type || "account"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDisconnect(conn.id, plat.display_name)}
                                        disabled={disconnecting === conn.id}
                                        style={{
                                            padding: "4px 12px",
                                            borderRadius: 8,
                                            fontSize: 12,
                                            background: "transparent",
                                            border: "1px solid rgba(239, 68, 68, 0.3)",
                                            color: "#ef4444",
                                            cursor: "pointer",
                                            opacity: disconnecting === conn.id ? 0.5 : 1,
                                        }}
                                    >
                                        {disconnecting === conn.id ? "..." : "Disconnect"}
                                    </button>
                                </div>
                            ))}

                            {/* Connect Button */}
                            <button
                                onClick={() => handleConnect(plat.platform)}
                                disabled={!plat.configured || isConnecting}
                                style={{
                                    width: "100%",
                                    padding: "10px 0",
                                    borderRadius: 12,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    background: plat.configured
                                        ? "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.15))"
                                        : "var(--zaytri-surface-2)",
                                    border: `1px solid ${plat.configured ? "rgba(6, 182, 212, 0.3)" : "var(--zaytri-border)"}`,
                                    color: plat.configured ? "white" : "var(--zaytri-text-dim)",
                                    cursor: plat.configured ? "pointer" : "not-allowed",
                                    opacity: isConnecting ? 0.7 : 1,
                                    transition: "all 0.2s",
                                }}
                            >
                                {isConnecting
                                    ? "⏳ Connecting..."
                                    : hasConnections
                                        ? "➕ Add Another Account"
                                        : plat.configured
                                            ? "🔗 Connect"
                                            : "⚠️ Not Configured"
                                }
                            </button>

                            {/* Note */}
                            {plat.note && (
                                <p style={{ marginTop: 8, fontSize: 12, color: "var(--zaytri-text-dim)", opacity: 0.7 }}>
                                    ℹ️ {plat.note}
                                </p>
                            )}

                            {/* Error */}
                            {platConnections.some((c) => c.last_error) && (
                                <p style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>
                                    ⚠️ {platConnections.find((c) => c.last_error)?.last_error}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3: Google Drive
// ═══════════════════════════════════════════════════════════════════════════════

function DriveTab({ onToast }: { onToast: (msg: string, t: "success" | "error") => void }) {
    const [config, setConfig] = useState<GoogleDriveConfig>({
        folder_url: null,
        folder_id: null,
        is_connected: false,
        last_synced_at: null,
    });
    const [folderUrl, setFolderUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getGoogleDriveConfig()
            .then((data) => {
                setConfig(data);
                if (data.folder_url) setFolderUrl(data.folder_url);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleConnect = async () => {
        if (!folderUrl.trim()) {
            onToast("Please enter a Google Drive folder URL", "error");
            return;
        }
        setSaving(true);
        try {
            const updated = await updateGoogleDriveConfig({ folder_url: folderUrl });
            setConfig(updated);
            onToast("Google Drive folder connected", "success");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to connect Google Drive";
            onToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnectGoogleDrive();
            setConfig({ folder_url: null, folder_id: null, is_connected: false, last_synced_at: null });
            setFolderUrl("");
            onToast("Google Drive disconnected", "success");
        } catch {
            onToast("Failed to disconnect Google Drive", "error");
        }
    };

    if (loading) return <div style={{ color: "var(--zaytri-text-dim)" }}>Loading Drive config...</div>;

    return (
        <div style={{ maxWidth: 800 }}>
            <div style={cardStyle}>
                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)" }}
                    >
                        📁
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Google Drive Integration</h3>
                        <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                            Connect a Drive folder to fetch content assets (images, videos, documents)
                        </p>
                    </div>
                </div>

                {/* Status */}
                {config.is_connected && (
                    <div
                        className="mb-6 p-4 rounded-xl flex items-center justify-between"
                        style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.25)" }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                            <div>
                                <p className="text-sm font-medium text-white">Connected</p>
                                <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Folder ID: <code className="text-xs">{config.folder_id}</code>
                                </p>
                            </div>
                        </div>
                        {config.last_synced_at && (
                            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                Last synced: {new Date(config.last_synced_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}

                {/* URL Input */}
                <div className="mb-6">
                    <label style={labelStyle}>Google Drive Folder URL</label>
                    <input
                        type="url"
                        value={folderUrl}
                        onChange={(e) => setFolderUrl(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/1ABC..."
                        style={inputStyle}
                    />
                    <p className="mt-2 text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                        Open your Google Drive folder → copy the URL from the address bar
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button onClick={handleConnect} disabled={saving} style={btnPrimary}>
                        {saving ? "Connecting..." : config.is_connected ? "🔄 Update Folder" : "🔗 Connect Folder"}
                    </button>
                    {config.is_connected && (
                        <button onClick={handleDisconnect} style={btnDanger}>
                            ❌ Disconnect
                        </button>
                    )}
                </div>
            </div>

            {/* Help Section */}
            <div className="mt-6" style={{ ...cardStyle, background: "rgba(59, 130, 246, 0.05)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
                <h4 className="font-semibold text-white mb-3">💡 How to use Google Drive</h4>
                <ol className="text-sm grid gap-2" style={{ color: "var(--zaytri-text-dim)", paddingLeft: 20, listStyle: "decimal" }}>
                    <li>Create a folder in Google Drive for your media assets</li>
                    <li>Upload images, videos, or documents you want to use in your posts</li>
                    <li>Copy the folder URL and paste it above</li>
                    <li>Zaytri will access files from this folder when generating content</li>
                </ol>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4: AI Models
// ═══════════════════════════════════════════════════════════════════════════════

const PROVIDER_META: Record<string, { icon: string; label: string; color: string; description: string }> = {
    ollama: { icon: "🦙", label: "Ollama", color: "rgba(168, 85, 247, 0.3)", description: "Free, local inference" },
    openai: { icon: "🤖", label: "OpenAI", color: "rgba(16, 163, 127, 0.3)", description: "GPT-4o, GPT-4o-mini" },
    gemini: { icon: "💎", label: "Google Gemini", color: "rgba(59, 130, 246, 0.3)", description: "Gemini 2.0 Flash, 2.5 Pro" },
    anthropic: { icon: "🧠", label: "Anthropic", color: "rgba(234, 179, 8, 0.3)", description: "Claude Sonnet, Opus" },
    groq: { icon: "⚡", label: "Groq", color: "rgba(239, 68, 68, 0.3)", description: "Ultra-fast inference" },
};

const AGENT_META: Record<string, { icon: string; label: string; description: string }> = {
    content_creator: { icon: "📝", label: "Content Creator", description: "Generates post text, captions, CTAs" },
    hashtag_generator: { icon: "#️⃣", label: "Hashtag Generator", description: "Generates niche & broad hashtags" },
    review_agent: { icon: "🔍", label: "Review Agent", description: "Scores content quality & compliance" },
    engagement_bot: { icon: "💬", label: "Engagement Bot", description: "Generates replies to comments" },
    analytics_agent: { icon: "📊", label: "Analytics Agent", description: "Generates weekly summary reports" },
};

// Default provider models for client-side fallback
const DEFAULT_PROVIDER_MODELS: Record<string, string[]> = {
    ollama: ["llama3", "llama3.1", "llama3.2", "mistral", "gemma2", "phi3", "codellama", "deepseek-r1"],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"],
    gemini: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
    anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-20240307"],
    groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
};

function AIModelsTab({ onToast }: { onToast: (msg: string, t: "success" | "error") => void }) {
    const DEFAULT_PROVIDERS: LLMProvider[] = Object.keys(PROVIDER_META).map((p) => ({
        provider: p,
        models: DEFAULT_PROVIDER_MODELS[p] || [],
        is_configured: p === "ollama",
        is_enabled: p === "ollama",
        test_status: null,
        last_tested_at: null,
        masked_key: null,
    }));

    const DEFAULT_AGENTS: AgentModelConfig[] = Object.keys(AGENT_META).map((a) => ({
        agent_id: a,
        provider: "ollama",
        model: "llama3",
        is_custom: false,
    }));

    const [providers, setProviders] = useState<LLMProvider[]>(DEFAULT_PROVIDERS);
    const [agents, setAgents] = useState<AgentModelConfig[]>(DEFAULT_AGENTS);
    const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [savingAgent, setSavingAgent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [provData, agentData] = await Promise.all([
                listLLMProviders().catch(() => null),
                listAgentModelConfigs().catch(() => null),
            ]);
            if (provData && provData.length > 0) setProviders(provData);
            if (agentData && agentData.length > 0) setAgents(agentData);
        } catch { /* keep defaults */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveKey = async (provider: string) => {
        const key = keyInputs[provider];
        if (!key?.trim()) {
            onToast("Please enter an API key", "error");
            return;
        }
        setSavingKey(provider);
        try {
            await saveLLMProviderKey(provider, key);
            setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
            await loadData();
            onToast(`${PROVIDER_META[provider]?.label} API key saved`, "success");
        } catch {
            onToast(`Failed to save ${provider} key`, "error");
        } finally {
            setSavingKey(null);
        }
    };

    const handleDeleteKey = async (provider: string) => {
        try {
            await deleteLLMProviderKey(provider);
            await loadData();
            onToast(`${PROVIDER_META[provider]?.label} key removed`, "success");
        } catch {
            onToast(`Failed to remove ${provider} key`, "error");
        }
    };

    const handleTestProvider = async (provider: string) => {
        setTestingProvider(provider);
        try {
            const res = await testLLMProvider(provider) as { status: string; message: string };
            onToast(res.message, res.status === "connected" ? "success" : "error");
            await loadData();
        } catch {
            onToast(`Test failed for ${provider}`, "error");
        } finally {
            setTestingProvider(null);
        }
    };

    const handleAssignAgent = async (agentId: string, provider: string, model: string) => {
        setSavingAgent(agentId);
        try {
            await assignAgentModel(agentId, provider, model);
            await loadData();
            onToast(`${AGENT_META[agentId]?.label} → ${PROVIDER_META[provider]?.label} / ${model}`, "success");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to assign model";
            onToast(message, "error");
        } finally {
            setSavingAgent(null);
        }
    };

    const handleResetAgent = async (agentId: string) => {
        try {
            await resetAgentModel(agentId);
            await loadData();
            onToast(`${AGENT_META[agentId]?.label} reset to default (Ollama)`, "success");
        } catch {
            onToast("Failed to reset agent", "error");
        }
    };

    // Get available models for a provider from our loaded data
    const getModels = (providerName: string): string[] => {
        const p = providers.find((pr) => pr.provider === providerName);
        return p?.models || DEFAULT_PROVIDER_MODELS[providerName] || [];
    };

    // Get configured (keyed) providers only
    const configuredProviders = providers.filter((p) => p.is_configured);

    if (loading) return <div style={{ color: "var(--zaytri-text-dim)" }}>Loading AI configuration...</div>;

    return (
        <div className="grid gap-8" style={{ maxWidth: 900 }}>
            {/* ── Section 1: Provider API Keys ──────────────────── */}
            <div>
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(168, 85, 247, 0.15)", border: "1px solid rgba(168, 85, 247, 0.3)" }}
                    >
                        🔑
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Provider API Keys</h3>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            Configure API keys for each LLM provider. Ollama is free and runs locally.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4">
                    {providers.map((prov) => {
                        const meta = PROVIDER_META[prov.provider] || { icon: "🔗", label: prov.provider, color: "var(--zaytri-border)", description: "" };
                        const isOllama = prov.provider === "ollama";

                        const statusColor = prov.test_status === "connected"
                            ? "#22c55e"
                            : prov.test_status === "failed"
                                ? "#ef4444"
                                : "var(--zaytri-text-dim)";

                        return (
                            <div key={prov.provider} style={cardStyle}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                            style={{ background: meta.color.replace("0.3", "0.15"), border: `1px solid ${meta.color}` }}
                                        >
                                            {meta.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white">{meta.label}</h4>
                                            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                                {meta.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {prov.is_configured && (
                                            <span
                                                className="px-3 py-1 rounded-full text-xs font-medium"
                                                style={{
                                                    background: "rgba(34, 197, 94, 0.15)",
                                                    color: "#22c55e",
                                                    border: "1px solid rgba(34, 197, 94, 0.3)",
                                                }}
                                            >
                                                {isOllama ? "Local" : "Configured"}
                                            </span>
                                        )}
                                        {prov.test_status && (
                                            <span className="text-xs" style={{ color: statusColor }}>
                                                • {prov.test_status}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!isOllama && (
                                    <div>
                                        {/* Show masked key if configured */}
                                        {prov.masked_key && (
                                            <p className="text-xs mb-3 font-mono" style={{ color: "var(--zaytri-text-dim)" }}>
                                                Current key: {prov.masked_key}
                                            </p>
                                        )}
                                        <div className="flex gap-3">
                                            <input
                                                type="password"
                                                placeholder={`Enter ${meta.label} API key...`}
                                                value={keyInputs[prov.provider] || ""}
                                                onChange={(e) =>
                                                    setKeyInputs((prev) => ({ ...prev, [prov.provider]: e.target.value }))
                                                }
                                                style={{ ...inputStyle, flex: 1 }}
                                            />
                                            <button
                                                onClick={() => handleSaveKey(prov.provider)}
                                                disabled={savingKey === prov.provider}
                                                style={btnPrimary}
                                            >
                                                {savingKey === prov.provider ? "Saving..." : "Save"}
                                            </button>
                                        </div>
                                        {prov.is_configured && (
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => handleTestProvider(prov.provider)}
                                                    disabled={testingProvider === prov.provider}
                                                    style={{ ...btnSecondary, padding: "6px 16px", fontSize: "13px" }}
                                                >
                                                    {testingProvider === prov.provider ? "Testing..." : "🔌 Test"}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteKey(prov.provider)}
                                                    style={{ ...btnDanger, padding: "6px 16px", fontSize: "13px" }}
                                                >
                                                    🗑️ Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {isOllama && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleTestProvider("ollama")}
                                            disabled={testingProvider === "ollama"}
                                            style={{ ...btnSecondary, padding: "6px 16px", fontSize: "13px" }}
                                        >
                                            {testingProvider === "ollama" ? "Testing..." : "🔌 Test Connection"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Section 2: Agent Model Assignments ──────────────────── */}
            <div>
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{ background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)" }}
                    >
                        🎯
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Agent Model Assignments</h3>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            Assign a specific LLM to each agent. Defaults to Ollama if not overridden.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4">
                    {agents.map((agent) => {
                        const meta = AGENT_META[agent.agent_id] || { icon: "🤖", label: agent.agent_id, description: "" };

                        return (
                            <div key={agent.agent_id} style={cardStyle}>
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    {/* Agent info */}
                                    <div className="flex items-center gap-3 min-w-48">
                                        <span className="text-2xl">{meta.icon}</span>
                                        <div>
                                            <h4 className="font-semibold text-white">{meta.label}</h4>
                                            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                                {meta.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Selection dropdowns */}
                                    <div className="flex items-center gap-3 flex-wrap flex-1 justify-end">
                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: "var(--zaytri-text-dim)" }}>Provider</label>
                                            <select
                                                value={agent.provider}
                                                onChange={(e) => {
                                                    const newProvider = e.target.value;
                                                    const models = getModels(newProvider);
                                                    handleAssignAgent(agent.agent_id, newProvider, models[0] || "");
                                                }}
                                                disabled={savingAgent === agent.agent_id}
                                                style={{ ...selectStyle, minWidth: 140 }}
                                            >
                                                {configuredProviders.map((cp) => (
                                                    <option key={cp.provider} value={cp.provider}>
                                                        {PROVIDER_META[cp.provider]?.label || cp.provider}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: "var(--zaytri-text-dim)" }}>Model</label>
                                            <select
                                                value={agent.model}
                                                onChange={(e) => handleAssignAgent(agent.agent_id, agent.provider, e.target.value)}
                                                disabled={savingAgent === agent.agent_id}
                                                style={{ ...selectStyle, minWidth: 200 }}
                                            >
                                                {getModels(agent.provider).map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {agent.is_custom && (
                                            <button
                                                onClick={() => handleResetAgent(agent.agent_id)}
                                                style={{
                                                    ...btnDanger,
                                                    padding: "6px 12px",
                                                    fontSize: "12px",
                                                    marginTop: "18px",
                                                }}
                                                title="Reset to default (Ollama)"
                                            >
                                                ↩️ Reset
                                            </button>
                                        )}

                                        {!agent.is_custom && (
                                            <span
                                                className="px-2 py-1 rounded-full text-xs"
                                                style={{
                                                    background: "rgba(168, 85, 247, 0.1)",
                                                    color: "rgba(168, 85, 247, 0.8)",
                                                    border: "1px solid rgba(168, 85, 247, 0.2)",
                                                    marginTop: "18px",
                                                }}
                                            >
                                                Default
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Help section */}
            <div style={{ ...cardStyle, background: "rgba(168, 85, 247, 0.05)", borderColor: "rgba(168, 85, 247, 0.2)" }}>
                <h4 className="font-semibold text-white mb-3">💡 How AI Models work</h4>
                <ol className="text-sm grid gap-2" style={{ color: "var(--zaytri-text-dim)", paddingLeft: 20, listStyle: "decimal" }}>
                    <li><strong>Default:</strong> All agents use Ollama (free, runs locally on your machine)</li>
                    <li><strong>Add a provider key</strong> above to unlock cloud LLMs (OpenAI, Gemini, etc.)</li>
                    <li><strong>Assign per agent:</strong> Pick which provider + model each agent should use</li>
                    <li><strong>Usage &amp; billing:</strong> Cloud providers use your API key&apos;s plan/quota — check their dashboards</li>
                    <li><strong>Reset anytime:</strong> Click &quot;Reset&quot; to switch any agent back to Ollama</li>
                </ol>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5: WhatsApp Approval
// ═══════════════════════════════════════════════════════════════════════════════

function WhatsAppApprovalTab({ onToast }: { onToast: (msg: string, t: "success" | "error") => void }) {
    const [status, setStatus] = useState<WhatsAppStatus | null>(null);
    const [approvals, setApprovals] = useState<WhatsAppApproval[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [s, a] = await Promise.all([
                    getWhatsAppStatus(),
                    listWhatsAppApprovals(),
                ]);
                setStatus(s);
                setApprovals(a);
            } catch {
                onToast("Failed to load WhatsApp status", "error");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [onToast]);

    const statusBadge = (s: string) => {
        const colors: Record<string, { bg: string; text: string }> = {
            pending: { bg: "rgba(234,179,8,0.15)", text: "#eab308" },
            approved: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
            rejected: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
            expired: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
        };
        const c = colors[s] || colors.expired;
        return (
            <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase"
                style={{ background: c.bg, color: c.text }}
            >
                {s}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="glass-card p-8 text-center">
                <p style={{ color: "var(--zaytri-text-dim)" }}>Loading WhatsApp status…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold mb-4">📲 WhatsApp Business API</h3>
                <div
                    className="p-4 rounded-xl mb-4 flex items-center gap-3"
                    style={{
                        background: status?.configured ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                        border: `1px solid ${status?.configured ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
                    }}
                >
                    <span className="text-2xl">{status?.configured ? "✅" : "⚠️"}</span>
                    <div>
                        <p className="text-sm font-semibold">
                            {status?.configured ? "WhatsApp Connected" : "Not Configured"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            {status?.configured
                                ? `Sending approvals to ${status.approval_phone}`
                                : "Add WhatsApp credentials in your .env file to enable approval flow"}
                        </p>
                    </div>
                </div>

                {!status?.configured && (
                    <div className="p-4 rounded-xl" style={{ background: "var(--zaytri-surface)", border: "1px solid var(--zaytri-border)" }}>
                        <h4 className="text-sm font-semibold mb-3">🛠️ Setup Instructions</h4>
                        <ol className="text-xs space-y-2" style={{ color: "var(--zaytri-text-dim)", paddingLeft: 20, listStyle: "decimal" }}>
                            <li>Go to <strong>Meta Business Suite</strong> → WhatsApp → API Setup</li>
                            <li>Copy your <strong>Temporary Access Token</strong> and <strong>Phone Number ID</strong></li>
                            <li>Add them to your <code>.env</code> file:</li>
                        </ol>
                        <pre className="mt-3 p-3 rounded-lg text-xs overflow-x-auto" style={{ background: "var(--zaytri-surface-2)", color: "var(--zaytri-primary-glow)" }}>
                            {`WHATSAPP_ACCESS_TOKEN=your_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_APPROVAL_PHONE=919876543210`}
                        </pre>
                    </div>
                )}

                {status?.configured && (
                    <div className="p-4 rounded-xl" style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.2)" }}>
                        <h4 className="text-sm font-semibold mb-2">💡 How it works</h4>
                        <ul className="text-xs space-y-1" style={{ color: "var(--zaytri-text-dim)" }}>
                            <li>• Content ready for review gets sent as a WhatsApp message preview</li>
                            <li>• Tap <strong>✅ Approve</strong> or <strong>❌ Reject</strong> directly in WhatsApp</li>
                            <li>• Approved content automatically moves to publish queue</li>
                            <li>• Approvals expire after 24 hours if no response</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* Approval History */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold mb-4">
                    📋 Approval History
                    <span className="text-xs font-normal ml-2 px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>
                        {approvals.length} total
                    </span>
                </h3>

                {approvals.length === 0 ? (
                    <div className="text-center py-8" style={{ color: "var(--zaytri-text-dim)" }}>
                        <p className="text-3xl mb-2">📭</p>
                        <p className="text-sm">No approval requests sent yet</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {approvals.map((a) => (
                            <div key={a.id} className="p-3 rounded-lg flex items-center justify-between"
                                style={{ background: "var(--zaytri-surface)", border: "1px solid var(--zaytri-border)" }}>
                                <div className="flex items-center gap-3">
                                    {statusBadge(a.status)}
                                    <div>
                                        <p className="text-xs font-medium">Content: {a.content_id.slice(0, 8)}…</p>
                                        <p className="text-[10px]" style={{ color: "var(--zaytri-text-dim)" }}>
                                            Sent {a.sent_at ? new Date(a.sent_at).toLocaleString() : "—"}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {a.responded_at ? (
                                        <p className="text-[10px]" style={{ color: "var(--zaytri-text-dim)" }}>
                                            Responded {new Date(a.responded_at).toLocaleString()}
                                        </p>
                                    ) : a.expires_at ? (
                                        <p className="text-[10px]" style={{ color: "var(--zaytri-text-dim)" }}>
                                            Expires {new Date(a.expires_at).toLocaleString()}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
