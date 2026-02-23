"use client";

import { useState, useEffect, useCallback } from "react";
import {
    listLLMProviders,
    saveLLMProviderKey,
    deleteLLMProviderKey,
    testLLMProvider,
    listAgentModelConfigs,
    assignAgentModel,
    resetAgentModel,
    type LLMProvider,
    type AgentModelConfig,
} from "@/lib/api";
import Section from "./shared/Section";
import StatusBadge from "./shared/StatusBadge";
import Tooltip from "./shared/Tooltip";

interface AIModelsTabProps {
    onToast: (msg: string, t: "success" | "error") => void;
}

export default function AIModelsTab({ onToast }: AIModelsTabProps) {
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [agentConfigs, setAgentConfigs] = useState<AgentModelConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [newKeys, setNewKeys] = useState<Record<string, string>>({});

    const loadData = useCallback(async () => {
        try {
            const [p, a] = await Promise.all([
                listLLMProviders(),
                listAgentModelConfigs(),
            ]);
            setProviders(p);
            setAgentConfigs(a);
        } catch (err) {
            console.error("Failed to load AI config", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveKey = async (provider: string) => {
        const key = newKeys[provider];
        if (!key) return;
        setSaving(provider);
        try {
            await saveLLMProviderKey(provider, key);
            onToast(`${provider} key updated`, "success");
            setNewKeys({ ...newKeys, [provider]: "" });
            await loadData();
        } catch {
            onToast("Failed to save key", "error");
        } finally {
            setSaving(null);
        }
    };

    const handleDeleteKey = async (provider: string) => {
        try {
            await deleteLLMProviderKey(provider);
            onToast(`${provider} key deleted`, "success");
            await loadData();
        } catch {
            onToast("Failed to delete", "error");
        }
    };

    const handleTest = async (providerCode: string) => {
        setTesting(providerCode);
        try {
            const res = await testLLMProvider(providerCode) as any;
            onToast(`Test: ${res.test_status}`, res.test_status === "success" ? "success" : "error");
            await loadData();
        } catch {
            onToast("Test failed", "error");
        } finally {
            setTesting(null);
        }
    };

    const handleAssignAgent = async (agentId: string, provider: string, model: string) => {
        try {
            await assignAgentModel(agentId, provider, model);
            onToast("Agent model assigned", "success");
            await loadData();
        } catch {
            onToast("Failed to assign", "error");
        }
    };

    const handleResetAgent = async (agentId: string) => {
        try {
            await resetAgentModel(agentId);
            onToast("Agent model reset to default", "success");
            await loadData();
        } catch {
            onToast("Failed to reset", "error");
        }
    };

    if (loading) return <div className="animate-pulse text-slate-400">Loading AI Models...</div>;

    const availableModels = providers
        .filter(p => p.is_configured)
        .flatMap(p => p.models.map(m => ({ provider: p.provider, model: m })));

    return (
        <div className="animate-fade-in max-w-5xl">
            <Section title="AI Providers" icon="🔑" description="Manage API keys for foundation models">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {providers.map((p) => (
                        <div key={p.provider} className="glass-card !bg-white/5 p-5 border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-white uppercase tracking-tight">{p.provider}</h4>
                                    <p className="text-[10px] text-slate-500">{p.models.join(", ")}</p>
                                </div>
                                <StatusBadge status={p.is_configured ? "Connected" : "Disconnected"} />
                            </div>

                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder={p.masked_key || "Enter API Key..."}
                                        className="input-field pr-20"
                                        value={newKeys[p.provider] || ""}
                                        onChange={(e) => setNewKeys({ ...newKeys, [p.provider]: e.target.value })}
                                    />
                                    <button
                                        onClick={() => handleSaveKey(p.provider)}
                                        disabled={!newKeys[p.provider] || saving === p.provider}
                                        className="absolute right-2 top-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold"
                                    >
                                        Save
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleTest(p.provider)}
                                        disabled={!p.is_configured || testing === p.provider}
                                        className="btn-secondary py-1.5 flex-1 text-xs"
                                    >
                                        {testing === p.provider ? "Testing..." : "⚡ Test Provider"}
                                    </button>
                                    {p.is_configured && (
                                        <button
                                            onClick={() => handleDeleteKey(p.provider)}
                                            className="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-xl"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                                {p.test_status && (
                                    <p className={`text-[10px] ${p.test_status.includes("error") ? "text-red-400" : "text-green-400"}`}>
                                        Last Status: {p.test_status} {p.last_tested_at && `(${new Date(p.last_tested_at).toLocaleTimeString()})`}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Agent Model Assignments" icon="🧠" description="Override AI models per specialized agent">
                <div className="space-y-4">
                    {agentConfigs.map((cfg) => (
                        <div key={cfg.agent_id} className="flex flex-col md:flex-row gap-4 md:items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                                <h4 className="font-semibold text-white capitalize">{cfg.agent_id.replace(/_/g, " ")}</h4>
                                <p className="text-xs text-slate-400">Current Model: <span className="text-cyan-400 font-medium">{cfg.provider} - {cfg.model}</span></p>
                            </div>

                            <div className="flex gap-3">
                                <select
                                    className="input-field !py-2 !px-3 text-xs w-48"
                                    value={`${cfg.provider}:${cfg.model}`}
                                    onChange={(e) => {
                                        const [p, m] = e.target.value.split(":");
                                        handleAssignAgent(cfg.agent_id, p, m);
                                    }}
                                >
                                    {availableModels.map(am => (
                                        <option key={`${am.provider}:${am.model}`} value={`${am.provider}:${am.model}`}>
                                            {am.provider}: {am.model}
                                        </option>
                                    ))}
                                </select>
                                {cfg.is_custom && (
                                    <button
                                        onClick={() => handleResetAgent(cfg.agent_id)}
                                        className="text-xs text-slate-400 hover:text-white"
                                    >
                                        Reset to Default
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="System Model Policies" icon="🛡️" description="Configure fallback and default model logic">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Default Model</label>
                        <select className="input-field">
                            {availableModels.map(am => (
                                <option key={am.model} value={am.model}>{am.provider}: {am.model}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 italic">Used when no agent override is specified.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Fallback Model</label>
                        <select className="input-field">
                            {availableModels.map(am => (
                                <option key={am.model} value={am.model}>{am.provider}: {am.model}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 italic">Used if the primary model fails or is rate-limited.</p>
                    </div>
                </div>
            </Section>
        </div>
    );
}
