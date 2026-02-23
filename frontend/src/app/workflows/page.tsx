"use client";

import { useState, useEffect } from "react";
import { runWorkflow, getWorkflowStatus } from "@/lib/api";
import {
    Plus, Save, History, Search,
    Zap, Hash, Image as ImageIcon, Video, Search as SearchIcon, Brain, CheckCircle,
    ChevronDown, ChevronUp, Play, FileText, Settings, Clock, RefreshCw, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";

// Custom Switch
const Switch = ({ checked, onChange, disabled = false }: { checked: boolean, onChange?: (c: boolean) => void, disabled?: boolean }) => (
    <div
        className={cn(
            "w-9 h-5 rounded-full relative transition-colors duration-200",
            checked ? "bg-[#06b6d4]" : "bg-[#1e293b]",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        )}
        onClick={() => !disabled && onChange?.(!checked)}
    >
        <div className={cn(
            "absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 shadow-sm",
            checked ? "transform translate-x-4" : ""
        )} />
    </div>
);

// Module Row Component
const ModuleRow = ({ icon: Icon, title, description, checked, onChange, locked = false }: any) => (
    <div className={cn(
        "flex items-center justify-between p-3 rounded-xl transition-all duration-300",
        "bg-[#161a29] border border-[#1e293b] hover:border-[#06b6d4]/30"
    )}>
        <div className="flex items-center gap-3">
            <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                checked ? "bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4]" : "bg-[#0f111a] border border-[#1e293b] text-[#94a3b8]"
            )}>
                <Icon size={16} />
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{title}</span>
                    {locked && <span className="text-[10px] font-bold bg-[#1e293b] text-[#64748b] px-1.5 py-0.5 rounded tracking-wider uppercase">Required</span>}
                </div>
                {description && <span className="text-xs text-[#64748b]">{description}</span>}
            </div>
        </div>
        <Switch checked={checked} onChange={onChange} disabled={locked} />
    </div>
);

// Platform Toggles
const PLATFORMS = [
    { id: "instagram", icon: "📸" },
    { id: "facebook", icon: "👤" },
    { id: "linkedin", icon: "💼" },
    { id: "twitter", icon: "🐦" },
    { id: "youtube", icon: "▶️" },
];

export default function WorkflowsPage() {
    const [workflowName, setWorkflowName] = useState("My Campaign Workflow");
    const [brand, setBrand] = useState("Zaytri");
    const [tone, setTone] = useState("Professional");
    const [topic, setTopic] = useState("");
    const [activePlatforms, setActivePlatforms] = useState<string[]>(["linkedin"]);

    // AI Modules
    const [modules, setModules] = useState({
        content: true, // locked
        hashtag: true,
        image: false,
        video: false,
        seo: false,
        memory: true,
        approval: true
    });

    const [advancedOpen, setAdvancedOpen] = useState(false);

    // Status
    const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
    const [progress, setProgress] = useState(0);
    const [logSteps, setLogSteps] = useState<Array<{ name: string, stat: "pending" | "running" | "done" | "error", time?: string, meta?: string }>>([]);

    const handleRun = async () => {
        if (!topic) {
            alert("Please enter a topic to trigger the workflow.");
            return;
        }

        setStatus("running");
        setProgress(10);

        // Setup initial steps based on modules
        const steps: any[] = [
            { name: "Content Generator", stat: "running", meta: "GPT-4o (est. 480 tokens)" }
        ];
        if (modules.hashtag) steps.push({ name: "Hashtag Generator", stat: "pending" });
        if (modules.image) steps.push({ name: "Image Generator", stat: "pending" });
        if (modules.seo) steps.push({ name: "SEO Optimizer", stat: "pending" });
        steps.push({ name: "Review Agent", stat: "pending" });
        steps.push({ name: "Save to Database", stat: "pending" });

        setLogSteps(steps);

        try {
            // Mocking a live pipeline execution progress
            await new Promise(r => setTimeout(r, 1500));
            setLogSteps(prev => { const n = [...prev]; n[0].stat = "done"; n[0].time = "3.2 sec"; if (n[1]) n[1].stat = "running"; return n; });
            setProgress(30);

            await new Promise(r => setTimeout(r, 1200));
            setLogSteps(prev => {
                const n = [...prev];
                if (n[1]) { n[1].stat = "done"; n[1].time = "1.8 sec"; if (n[2]) n[2].stat = "running"; }
                return n;
            });
            setProgress(60);

            await new Promise(r => setTimeout(r, 2000));

            // Execute actual API for content creation
            await runWorkflow(topic, activePlatforms[0] || "linkedin", tone.toLowerCase());

            setProgress(100);
            setStatus("completed");
            setLogSteps(prev => prev.map(s => s.stat === "running" || s.stat === "pending" ? { ...s, stat: "done", time: "0.5 sec" } : s));

        } catch (err) {
            setStatus("failed");
            setLogSteps(prev => prev.map(s => s.stat === "running" ? { ...s, stat: "error" } : s));
        }
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500 h-[calc(100vh-6rem)] flex flex-col">

            {/* Top Navigation / Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Layers className="text-[#06b6d4]" size={28} /> Workflows
                    </h1>
                    <p className="text-sm text-[#94a3b8] mt-1 ml-10">Build & trigger AI automation pipelines</p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 text-sm font-semibold bg-[#161a29] border border-[#1e293b] text-white px-4 py-2 rounded-xl hover:bg-[#1e293b] transition-all">
                        <Plus size={16} className="text-[#06b6d4]" /> New Workflow
                    </button>
                    <button className="flex items-center gap-2 text-sm font-semibold bg-[#0f111a] border border-[#1e293b] text-[#94a3b8] px-4 py-2 rounded-xl hover:text-white transition-all">
                        <Save size={16} /> Saved Templates
                    </button>
                    <button className="flex items-center gap-2 text-sm font-semibold bg-[#0f111a] border border-[#1e293b] text-[#94a3b8] px-4 py-2 rounded-xl hover:text-white transition-all">
                        <History size={16} /> Execution History
                    </button>
                </div>
            </div>

            {/* Split Layout */}
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-0">

                {/* LEFT PANEL: Builder */}
                <div className="xl:col-span-7 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">

                    {/* Basic Setup Wrapper */}
                    <div className="bg-[#0f111a] border border-[#1e293b] rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                            <FileText size={18} className="text-[#06b6d4]" /> Workflow Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Workflow Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-[#161a29] text-sm text-white border border-[#1e293b] rounded-xl px-4 py-2.5 outline-none focus:border-[#06b6d4] transition-colors"
                                    value={workflowName}
                                    onChange={e => setWorkflowName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Target Brand</label>
                                <select
                                    className="w-full bg-[#161a29] text-sm text-white border border-[#1e293b] rounded-xl px-4 py-2.5 outline-none focus:border-[#06b6d4] transition-colors"
                                    value={brand}
                                    onChange={e => setBrand(e.target.value)}
                                >
                                    <option>Zaytri</option>
                                    <option>FitPro</option>
                                    <option>TechCorp</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5 mb-5">
                            <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Content Topic / Prompt *</label>
                            <input
                                type="text"
                                className="w-full bg-[#161a29] text-sm text-white border border-[#1e293b] rounded-xl px-4 py-2.5 outline-none focus:border-[#06b6d4] transition-colors"
                                placeholder="Describe exactly what this workflow should generate..."
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Publish Platforms</label>
                                <div className="flex gap-2">
                                    {PLATFORMS.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setActivePlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                            className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all",
                                                activePlatforms.includes(p.id) ? "bg-[#1e293b] shadow-sm transform scale-105" : "bg-[#161a29] border border-[#1e293b] opacity-50 hover:opacity-100"
                                            )}
                                        >
                                            {p.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Brand Tone</label>
                                <select
                                    className="w-full bg-[#161a29] text-sm text-white border border-[#1e293b] rounded-xl px-4 py-2.5 outline-none focus:border-[#06b6d4] transition-colors"
                                    value={tone}
                                    onChange={e => setTone(e.target.value)}
                                >
                                    <option>Professional</option>
                                    <option>Educational</option>
                                    <option>Casual</option>
                                    <option>Humorous</option>
                                    <option>Inspirational</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* AI Modules configuration */}
                    <div className="bg-[#0f111a] border border-[#1e293b] rounded-2xl p-6 shadow-sm flex-1">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap size={18} className="text-[#06b6d4]" /> AI Agent Modules
                            </h2>
                            <span className="text-xs font-semibold bg-[#1e293b] text-[#06b6d4] px-2 py-1 rounded cursor-help" title="These specialized agents run sequentially.">
                                Sequential Pipeline
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                            <ModuleRow icon={FileText} title="Content Generator" description="Core copy & hook creation" checked={modules.content} locked />
                            <ModuleRow icon={Hash} title="Hashtag Generator" description="SEO targeted tags" checked={modules.hashtag} onChange={(c: boolean) => setModules({ ...modules, hashtag: c })} />
                            <ModuleRow icon={ImageIcon} title="Image Generator" description="DALL-E 3 visual assets" checked={modules.image} onChange={(c: boolean) => setModules({ ...modules, image: c })} />
                            <ModuleRow icon={Video} title="Short Video Script" description="Reels / TikTok frameworks" checked={modules.video} onChange={(c: boolean) => setModules({ ...modules, video: c })} />
                            <ModuleRow icon={SearchIcon} title="SEO Optimizer" description="Keyword density analysis" checked={modules.seo} onChange={(c: boolean) => setModules({ ...modules, seo: c })} />
                            <ModuleRow icon={Brain} title="Brand Memory" description="RAG contextual alignment" checked={modules.memory} onChange={(c: boolean) => setModules({ ...modules, memory: c })} />
                        </div>

                        <div className="w-full h-px bg-[#1e293b] mb-6" />

                        {/* Approval & Advanced */}
                        <div className="flex flex-col gap-4">
                            <ModuleRow icon={CheckCircle} title="Human Approval Required" description="Sends previews via WhatsApp/Email before dispatch" checked={modules.approval} onChange={(c: boolean) => setModules({ ...modules, approval: c })} />

                            <div className="border border-[#1e293b] rounded-xl overflow-hidden">
                                <button
                                    className="w-full flex items-center justify-between p-4 bg-[#161a29] text-sm font-semibold hover:bg-[#1e293b]/50 transition-colors"
                                    onClick={() => setAdvancedOpen(!advancedOpen)}
                                >
                                    <span className="flex items-center gap-2 text-[#94a3b8]"><Settings size={16} /> Advanced Executor Settings</span>
                                    {advancedOpen ? <ChevronUp size={16} className="text-[#94a3b8]" /> : <ChevronDown size={16} className="text-[#94a3b8]" />}
                                </button>
                                {advancedOpen && (
                                    <div className="p-4 bg-[#0f111a] grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#1e293b]">
                                        <div>
                                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1 block">Primary Model</label>
                                            <select className="w-full bg-[#161a29] text-xs text-white border border-[#1e293b] rounded-lg px-2 py-1.5 outline-none">
                                                <option>GPT-4o</option>
                                                <option>Claude 3.5 Sonnet</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1 block">Max Tokens</label>
                                            <input type="number" defaultValue={2000} className="w-full bg-[#161a29] text-xs text-white border border-[#1e293b] rounded-lg px-2 py-1.5 outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1 block">Max Retries</label>
                                            <select className="w-full bg-[#161a29] text-xs text-white border border-[#1e293b] rounded-lg px-2 py-1.5 outline-none">
                                                <option>3 attempts</option>
                                                <option>1 attempt</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center gap-4 mt-auto drop-shadow-2xl">
                        <button className="flex-1 bg-[#161a29] border border-[#1e293b] text-[#94a3b8] hover:text-white px-6 py-4 rounded-xl font-bold text-sm transition-all hover:bg-[#1e293b]">
                            Save as Template
                        </button>
                        <button
                            onClick={handleRun}
                            disabled={status === "running"}
                            className="flex-[2] bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white px-6 py-4 rounded-xl font-bold text-sm shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {status === "running" ? (
                                <><RefreshCw size={18} className="animate-spin" /> Executing Pipeline...</>
                            ) : (
                                <><Play size={18} fill="currentColor" /> Run Auto Pipeline</>
                            )}
                        </button>
                    </div>

                </div>

                {/* RIGHT PANEL: Tracker & Logs */}
                <div className="xl:col-span-5 flex flex-col gap-6 h-full">

                    {/* Live Tracker */}
                    <div className="bg-[#0f111a] border border-[#1e293b] rounded-2xl p-6 shadow-sm flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Activity size={18} className="text-[#06b6d4]" /> Pipeline Status
                            </h2>
                            {status === "running" && <span className="flex items-center gap-1.5 text-xs font-bold text-[#eab308] bg-[#eab308]/10 px-2.5 py-1 rounded-full"><span className="w-2 h-2 rounded-full bg-[#eab308] animate-ping" /> Running</span>}
                            {status === "completed" && <span className="flex items-center gap-1 text-xs font-bold text-[#4ade80] bg-[#4ade80]/10 px-2.5 py-1 rounded-full"><CheckCircle size={12} /> Completed</span>}
                            {status === "idle" && <span className="flex items-center gap-1 text-xs font-bold text-[#94a3b8] bg-[#1e293b] px-2.5 py-1 rounded-full">Ready</span>}
                        </div>

                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-[#94a3b8]">Overall Progress</span>
                                <span className="text-[#06b6d4]">{progress}%</span>
                            </div>
                            <div className="w-full bg-[#161a29] rounded-full h-2 overflow-hidden border border-[#1e293b]">
                                <div
                                    className="h-full bg-gradient-to-r from-[#06b6d4] to-[#a855f7] transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%`, boxShadow: progress > 0 ? "0 0 10px rgba(6,182,212,0.5)" : "none" }}
                                />
                            </div>
                        </div>

                        {/* Execution Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#161a29] p-3 rounded-xl border border-[#1e293b]">
                                <div className="text-[10px] uppercase font-bold text-[#64748b] mb-1">Elapsed Time</div>
                                <div className="text-sm font-semibold text-white">{status === "idle" ? "-- : --" : status === "running" ? "00:04" : "00:12"}</div>
                            </div>
                            <div className="bg-[#161a29] p-3 rounded-xl border border-[#1e293b]">
                                <div className="text-[10px] uppercase font-bold text-[#64748b] mb-1">Est. Cost</div>
                                <div className="text-sm font-semibold text-white">{status === "idle" ? "$0.00" : "$0.02"}</div>
                            </div>
                        </div>

                        <div className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-4 pb-2 border-b border-[#1e293b]">Execution Steps</div>

                        {/* Step Details */}
                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                            {logSteps.length === 0 ? (
                                <div className="text-sm text-[#64748b] text-center mt-10 italic">
                                    Configure parameters and run the pipeline to view tracking data.
                                </div>
                            ) : (
                                logSteps.map((step, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="flex flex-col items-center mt-0.5">
                                            <div className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors",
                                                step.stat === "done" ? "bg-[#4ade80]/20 border-[#4ade80] text-[#4ade80]" :
                                                    step.stat === "running" ? "bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]" :
                                                        step.stat === "error" ? "bg-[#f43f5e]/20 border-[#f43f5e] text-[#f43f5e]" :
                                                            "border-[#1e293b] bg-[#161a29] text-[#64748b]"
                                            )}>
                                                {step.stat === "done" ? <CheckCircle size={10} strokeWidth={3} /> :
                                                    step.stat === "running" ? <div className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" /> :
                                                        i + 1}
                                            </div>
                                            {i !== logSteps.length - 1 && <div className={cn("w-px h-full my-1", step.stat === "done" ? "bg-[#4ade80]/30" : "bg-[#1e293b]")} />}
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="flex items-center justify-between">
                                                <span className={cn("text-sm font-bold", step.stat === "pending" ? "text-[#94a3b8]" : "text-white")}>{step.name}</span>
                                                {step.time && <span className="text-xs text-[#64748b] font-mono">{step.time}</span>}
                                            </div>
                                            {step.meta && step.stat !== "pending" && (
                                                <span className="text-[11px] text-[#64748b] border border-[#1e293b] bg-[#161a29] px-2 py-0.5 rounded mt-1 inline-block font-mono">
                                                    {step.meta}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                    </div>

                    {/* Quick Output Preview */}
                    {status === "completed" && (
                        <div className="bg-[#161a29] border border-[#1e293b] rounded-2xl p-4 shadow-sm animate-fade-in flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center text-green-400">
                                    <CheckCircle size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white">Generation Successful</div>
                                    <div className="text-xs text-[#94a3b8]">Content is ready in the manager.</div>
                                </div>
                            </div>
                            <button className="text-sm font-bold bg-[#06b6d4] text-black px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:bg-[#22d3ee] transition-colors">
                                View Item
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* Custom Scrollbar CSS for this view */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}} />
        </div>
    );
}

// Ensure Activity icon is available
function Activity(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    );
}
