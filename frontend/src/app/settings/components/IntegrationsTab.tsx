"use client";

import { useState, useEffect, useCallback } from "react";
import {
    listSocialPlatforms,
    getSocialConnectURL,
    handleSocialCallback,
    listSocialConnections,
    disconnectSocialAccount,
    getWhatsAppStatus,
    listWhatsAppApprovals,
    listBrands,
    updateSocialConnection,
    getGoogleDriveConfig,
    updateGoogleDriveConfig,
    disconnectGoogleDrive,
    type BrandSettings,
    type SocialPlatformInfo,
    type SocialConnectionInfo,
    type WhatsAppStatus,
    type WhatsAppApproval,
    type GoogleDriveConfig,
} from "@/lib/api";
import Section from "./shared/Section";
import StatusBadge from "./shared/StatusBadge";
import Tooltip from "./shared/Tooltip";

interface IntegrationsTabProps {
    onToast: (msg: string, t: "success" | "error") => void;
}

export default function IntegrationsTab({ onToast }: IntegrationsTabProps) {
    const [platforms, setPlatforms] = useState<SocialPlatformInfo[]>([]);
    const [connections, setConnections] = useState<SocialConnectionInfo[]>([]);
    const [brands, setBrands] = useState<BrandSettings[]>([]);
    const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
    const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
    const [folderUrl, setFolderUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [savingDrive, setSavingDrive] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [plats, conns, wa, drive, fetchedBrands] = await Promise.all([
                listSocialPlatforms(),
                listSocialConnections(),
                getWhatsAppStatus(),
                getGoogleDriveConfig(),
                listBrands(),
            ]);
            setPlatforms(plats);
            setConnections(conns);
            setWaStatus(wa);
            setDriveConfig(drive);
            setBrands(fetchedBrands);
            if (drive.folder_url) setFolderUrl(drive.folder_url);
        } catch (err) {
            console.error("Failed to load integrations", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

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
            const width = 600, height = 700;
            const left = window.screenX + (window.innerWidth - width) / 2;
            const top = window.screenY + (window.innerHeight - height) / 2;
            window.open(url, `Connect ${platform}`, `width=${width},height=${height},left=${left},top=${top}`);
        } catch (err) {
            onToast(`Failed to start OAuth: ${err instanceof Error ? err.message : "Not configured"}`, "error");
            setConnecting(null);
        }
    };

    const handleDisconnect = async (connectionId: string, platformName: string) => {
        setDisconnecting(connectionId);
        try {
            await disconnectSocialAccount(connectionId);
            onToast(`${platformName} disconnected`, "success");
            await loadData();
        } catch {
            onToast("Failed to disconnect", "error");
        } finally {
            setDisconnecting(null);
        }
    };

    const handleAssignBrand = async (connectionId: string, brandId: string) => {
        try {
            await updateSocialConnection(connectionId, { brand_id: brandId || null });
            onToast("Brand assigned to connection", "success");
            await loadData();
        } catch (err) {
            onToast(err instanceof Error ? err.message : "Failed to assign brand", "error");
        }
    };

    const handleDriveSave = async () => {
        if (!folderUrl.trim()) return onToast("Enter a folder URL", "error");
        setSavingDrive(true);
        try {
            const updated = await updateGoogleDriveConfig({ folder_url: folderUrl });
            setDriveConfig(updated);
            onToast("Drive connected", "success");
        } catch (err) {
            onToast(err instanceof Error ? err.message : "Failed", "error");
        } finally {
            setSavingDrive(true);
        }
    };

    const handleDriveDisconnect = async () => {
        try {
            await disconnectGoogleDrive();
            setDriveConfig({ folder_url: null, folder_id: null, is_connected: false, last_synced_at: null });
            setFolderUrl("");
            onToast("Drive disconnected", "success");
        } catch {
            onToast("Failed to disconnect", "error");
        }
    };

    if (loading) return <div className="animate-pulse text-slate-400">Loading Integrations...</div>;

    const connectionsByPlatform: Record<string, SocialConnectionInfo[]> = {};
    connections.forEach((c) => {
        if (!connectionsByPlatform[c.platform]) connectionsByPlatform[c.platform] = [];
        connectionsByPlatform[c.platform].push(c);
    });

    return (
        <div className="animate-fade-in max-w-5xl">
            <Section title="Social Media" icon="🔗" description="Manage your connected social accounts">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {platforms.map((plat) => {
                        const platConnections = connectionsByPlatform[plat.platform] || [];
                        const isConnected = platConnections.length > 0;
                        return (
                            <div key={plat.platform} className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between auto-rows-max h-auto min-h-48">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{plat.icon}</span>
                                        <div>
                                            <h4 className="font-semibold">{plat.display_name}</h4>
                                            <p className="text-xs text-slate-400">{plat.configured ? "Ready" : "Not Configured"}</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={isConnected ? "Connected" : "Disconnected"} />
                                </div>
                                <div className="space-y-2">
                                    {platConnections.map(c => (
                                        <div key={c.id} className="text-xs flex flex-col gap-1 text-slate-300 pb-2 border-b border-white/5 last:border-0">
                                            <div className="flex justify-between items-center">
                                                <span>{c.platform_username || "Account"}</span>
                                                <button
                                                    onClick={() => handleDisconnect(c.id, plat.display_name)}
                                                    className="text-red-400 hover:underline"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-slate-500">Brand:</span>
                                                <select
                                                    value={c.brand_id || ""}
                                                    onChange={(e) => handleAssignBrand(c.id, e.target.value)}
                                                    className="bg-black/20 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-slate-300 outline-none hover:border-white/20"
                                                >
                                                    <option value="">Global (All Brands)</option>
                                                    {brands.map(b => (
                                                        <option key={b.id} value={b.id}>{b.brand_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => handleConnect(plat.platform)}
                                        disabled={!plat.configured || connecting === plat.platform}
                                        className="btn-secondary w-full py-2 text-xs mt-2"
                                    >
                                        {connecting === plat.platform ? "..." : isConnected ? "+ Add Another" : "Connect"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Section>

            <Section title="WhatsApp Business" icon="📲" description="Meta WhatsApp Business API Integration">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Status</span>
                            <StatusBadge status={waStatus?.configured ? "Active" : "Disconnected"} />
                        </div>
                        {waStatus?.configured && (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">Phone ID</span>
                                    <code className="text-xs">{waStatus.phone_number_id}</code>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-400">Approval Phone</span>
                                    <span className="text-sm">{waStatus.approval_phone}</span>
                                </div>
                            </>
                        )}
                        <p className="text-xs text-slate-400 pt-2 border-t border-white/10">
                            WhatsApp integration is managed via the .env file. Contact admin to change Phone ID or Approval Mobile.
                        </p>
                    </div>
                </div>
            </Section>

            <Section title="Google Drive" icon="📁" description="Sync content assets from Drive folders">
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium">Drive Sync</p>
                            <p className="text-xs text-slate-400">Fetch images/docs from a specific folder</p>
                        </div>
                        <StatusBadge status={driveConfig?.is_connected ? "Connected" : "Disconnected"} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Folder URL</label>
                        <div className="flex gap-4">
                            <input
                                className="input-field flex-1"
                                placeholder="Paste your Google Drive folder URL"
                                value={folderUrl}
                                onChange={(e) => setFolderUrl(e.target.value)}
                            />
                            {driveConfig?.is_connected ? (
                                <button onClick={handleDriveDisconnect} className="btn-secondary border-red-500/30 text-red-500 hover:bg-red-500/10 px-6">
                                    Disconnect
                                </button>
                            ) : (
                                <button onClick={handleDriveSave} disabled={savingDrive} className="btn-primary px-8">
                                    {savingDrive ? "Connecting..." : "Connect"}
                                </button>
                            )}
                        </div>
                    </div>

                    {driveConfig?.is_connected && driveConfig.last_synced_at && (
                        <div className="pt-4 border-t border-white/5 flex justify-between text-xs text-slate-500 italic">
                            <span>Folder ID: {driveConfig.folder_id}</span>
                            <span>Last synced: {new Date(driveConfig.last_synced_at).toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}
