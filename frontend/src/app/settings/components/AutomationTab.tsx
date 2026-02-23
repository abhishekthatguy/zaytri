"use client";

import { useState, useEffect } from "react";
import { getCronSettings, updateCronSettings, type CronSettings } from "@/lib/api";
import Section from "./shared/Section";
import StatusBadge from "./shared/StatusBadge";
import Tooltip from "./shared/Tooltip";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AutomationTabProps {
    onToast: (msg: string, t: "success" | "error") => void;
}

export default function AutomationTab({ onToast }: AutomationTabProps) {
    const [settings, setSettings] = useState<CronSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
            const updated = await updateCronSettings(settings);
            setSettings(updated);
            onToast("Automation schedules saved", "success");
        } catch {
            onToast("Failed to save automation settings", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="animate-pulse text-slate-400">Loading Automation...</div>;
    if (!settings) return <div className="text-red-400">Error loading settings</div>;

    return (
        <div className="animate-fade-in max-w-4xl">
            <Section title="Scheduler Bot" icon="📅" description="Daily content publishing bot">
                <div className="flex flex-col md:flex-row gap-8 items-center bg-white/5 p-4 rounded-xl border border-white/5 mb-6">
                    <div className="flex-1">
                        <p className="text-sm font-medium">Automatic Mode</p>
                        <p className="text-xs text-slate-400">The scheduler will automatically pick up and publish approved content at the specified time.</p>
                    </div>
                    <StatusBadge status="Active" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Hour (0-23)</label>
                        <input
                            type="number"
                            min={0} max={23}
                            className="input-field"
                            value={settings.scheduler_hour}
                            onChange={(e) => setSettings({ ...settings, scheduler_hour: +e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Minute (0-59)</label>
                        <input
                            type="number"
                            min={0} max={59}
                            className="input-field"
                            value={settings.scheduler_minute}
                            onChange={(e) => setSettings({ ...settings, scheduler_minute: +e.target.value })}
                        />
                    </div>
                </div>
            </Section>

            <Section title="Engagement Bot" icon="💬" description="Comment monitoring & auto-reply system">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-8 items-center bg-white/5 p-4 rounded-xl border border-white/5">
                        <div className="flex-1">
                            <p className="text-sm font-medium">Scan Frequency</p>
                            <p className="text-xs text-slate-400">Controls how long the agent waits after a post is published before checking for initial comments.</p>
                        </div>
                        <StatusBadge status="Active" />
                    </div>

                    <div className="space-y-2 max-w-xs">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Initial Delay (Hours)</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min={1} max={48}
                                className="input-field w-24"
                                value={settings.engagement_delay_hours}
                                onChange={(e) => setSettings({ ...settings, engagement_delay_hours: +e.target.value })}
                            />
                            <span className="text-sm text-slate-400">hours</span>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Analytics Agent" icon="📊" description="Weekly platform performance reports">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Scan Day</label>
                        <select
                            className="input-field"
                            value={settings.analytics_day_of_week}
                            onChange={(e) => setSettings({ ...settings, analytics_day_of_week: +e.target.value })}
                        >
                            {DAYS.map((d, i) => (
                                <option key={d} value={i}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Hour (0-23)</label>
                        <input
                            type="number"
                            min={0} max={23}
                            className="input-field"
                            value={settings.analytics_hour}
                            onChange={(e) => setSettings({ ...settings, analytics_hour: +e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Minute (0-59)</label>
                        <input
                            type="number"
                            min={0} max={59}
                            className="input-field"
                            value={settings.analytics_minute}
                            onChange={(e) => setSettings({ ...settings, analytics_minute: +e.target.value })}
                        />
                    </div>
                </div>
            </Section>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-12 py-3"
                >
                    {saving ? "Saving Changes..." : "💾 Save Automation Config"}
                </button>
            </div>
        </div>
    );
}
