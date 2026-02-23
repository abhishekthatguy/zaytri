"use client";

import { useState, useCallback } from "react";
import BrandsTab from "./components/BrandsTab";
import AutomationTab from "./components/AutomationTab";
import IntegrationsTab from "./components/IntegrationsTab";
import AIModelsTab from "./components/AIModelsTab";
import SystemTab from "./components/SystemTab";
import { useToast } from "@/components/Toast";

const TOP_LEVEL_TABS = [
    { id: "brands", label: "Brands", icon: "🏢" },
    { id: "automation", label: "Automation", icon: "🤖" },
    { id: "integrations", label: "Integrations", icon: "🔌" },
    { id: "aimodels", label: "AI & Models", icon: "🧠" },
    { id: "system", label: "System", icon: "⚙️" },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("brands");
    const { success, error } = useToast();

    const showToast = useCallback((message: string, type: "success" | "error") => {
        if (type === "success") success(message);
        else error(message);
    }, [success, error]);

    return (
        <div className="min-h-screen p-4 md:p-8 space-y-8 animate-fade-in" style={{ background: "var(--zaytri-bg)" }}>
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">Settings</h1>
                    <p className="text-slate-400 max-w-2xl">
                        Configure brands, automation logic, platform integrations, and AI models for your agent system.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => showToast("Settings exported", "success")} className="btn-secondary py-2 px-4 text-xs">Export Config</button>
                    <button onClick={() => window.location.reload()} className="btn-secondary py-2 px-4 text-xs">Reload System</button>
                </div>
            </div>

            {/* Top Navigation */}
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 w-fit overflow-x-auto no-scrollbar">
                {TOP_LEVEL_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        <span className="text-xl">{tab.icon}</span>
                        <span className="font-bold text-sm">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content Area */}
            <div className="min-h-[60vh] py-4">
                {activeTab === "brands" && <BrandsTab onToast={showToast} />}
                {activeTab === "automation" && <AutomationTab onToast={showToast} />}
                {activeTab === "integrations" && <IntegrationsTab onToast={showToast} />}
                {activeTab === "aimodels" && <AIModelsTab onToast={showToast} />}
                {activeTab === "system" && <SystemTab onToast={showToast} />}
            </div>

        </div>
    );
}
