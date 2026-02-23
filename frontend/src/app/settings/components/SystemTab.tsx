"use client";

import { useState, useEffect } from "react";
import { getCronSettings, updateCronSettings, type CronSettings } from "@/lib/api";
import Section from "./shared/Section";
import StatusBadge from "./shared/StatusBadge";
import Tooltip from "./shared/Tooltip";

const TIMEZONES = [
    "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
    "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland", "UTC",
];

interface SystemTabProps {
    onToast: (msg: string, t: "success" | "error") => void;
}

export default function SystemTab({ onToast }: SystemTabProps) {
    const [settings, setSettings] = useState<CronSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    useEffect(() => {
        getCronSettings()
            .then(setSettings)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await updateCronSettings(settings);
            onToast("System settings updated", "success");
        } catch {
            onToast("Failed to update settings", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="animate-pulse text-slate-400">Loading System Config...</div>;

    return (
        <div className="animate-fade-in max-w-4xl">
            <Section title="Localization" icon="🌍" description="Time and regional settings">
                <div className="space-y-4">
                    <div className="space-y-2 max-w-sm">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">System Timezone</label>
                        <select
                            className="input-field"
                            value={settings?.timezone || "UTC"}
                            onChange={(e) => settings && setSettings({ ...settings, timezone: e.target.value })}
                        >
                            {TIMEZONES.map((tz) => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 italic">This affects when your bots run and how analytics are grouped.</p>
                    </div>
                </div>
            </Section>

            <Section title="Reliability & Retries" icon="🔄" description="System behavior during failures">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Max Task Retries</label>
                        <input type="number" defaultValue={3} className="input-field" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Initial Retry Delay (s)</label>
                        <input type="number" defaultValue={60} className="input-field" />
                    </div>
                </div>
            </Section>

            <Section title="Logging & Diagnostics" icon="📜" description="Monitor system activity">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <div>
                            <p className="text-sm font-medium">Debug Mode</p>
                            <p className="text-xs text-slate-400">Enables verbose logging and extra error data in API responses.</p>
                        </div>
                        <button
                            onClick={() => setDebugMode(!debugMode)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${debugMode ? 'bg-cyan-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${debugMode ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button className="btn-secondary flex-1 py-2 text-xs">View API Logs</button>
                        <button className="btn-secondary flex-1 py-2 text-xs">View Worker Logs</button>
                        <button className="btn-secondary flex-1 py-2 text-xs text-red-400 border-red-500/20">Clear History</button>
                    </div>
                </div>
            </Section>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-12 py-3"
                >
                    {saving ? "Saving Changes..." : "💾 Save System Config"}
                </button>
            </div>
        </div>
    );
}
