"use client";

import { useState } from "react";
import {
    Calendar as CalendarIcon, Upload, Link2, Plus, Search,
    List, CalendarDays, LayoutGrid, ChevronLeft, ChevronRight,
    MoreVertical, CheckCircle2, Clock, Zap, Shield, Image as ImageIcon,
    FileJson, Table
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";

// Mock Data
const MOCK_RULES = [
    { id: 1, title: "Every Monday at 9:00 AM", desc: "Generate LinkedIn thought leadership...", active: true, brand: "CorpEdge" },
    { id: 2, title: "Weekly Thought Leaders", desc: "Weekly entry updates", active: true, brand: "FitPro" },
    { id: 3, title: "First Day of Each Month", desc: "Monthly summary metrics", active: false, brand: "MemeHouse" }
];

const MOCK_CALENDAR_DAYS = Array.from({ length: 35 }, (_, i) => ({
    date: i + 1,
    isCurrentMonth: i >= 4 && i < 34,
    events: i % 5 === 0 ? [{ title: "FitPro", type: "approved" }] : i % 8 === 0 ? [{ title: "CorpEdge", type: "pending" }] : []
}));

const MOCK_PARSED_DATA = [
    { date: "2026-04-12", platform: "LinkedIn", brand: "FitPro", topic: "Realign... ", status: "Valid" },
    { date: "2026-04-14", platform: "Twitter", brand: "CorpEdge", topic: "New API...", status: "Valid" },
    { date: "2026-04-15", platform: "Instagram", brand: "Estene", topic: "Product launch", status: "Warning" },
    { date: "2026-04-16", platform: "Facebook", brand: "BrandX", topic: "Weekly...", status: "Error" },
];

const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange?: () => void }) => (
    <div
        className={cn("w-8 h-4.5 rounded-full relative cursor-pointer transition-colors", checked ? "bg-[#06b6d4]" : "bg-[#1e293b]")}
        onClick={onChange}
    >
        <div className={cn("absolute top-[2px] left-[2px] bg-white w-3.5 h-3.5 rounded-full transition-transform", checked ? "translate-x-[14px]" : "")} />
    </div>
);

export default function CalendarPage() {
    const [activeTab, setActiveTab] = useState("calendar");
    const [viewMode, setViewMode] = useState("month");
    const [showUploadModal, setShowUploadModal] = useState(true);
    const [uploadStep, setUploadStep] = useState(2); // 1: Upload, 2: Parse/Map

    return (
        <div className="flex h-[calc(100vh-2rem)] bg-[#0f111a] text-sm animate-in fade-in duration-500 overflow-hidden">

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-[#1e293b] relative">

                {/* Header */}
                <div className="p-6 pb-4 border-b border-[#1e293b]">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                📅 Content Calendar
                            </h1>
                            <p className="text-[#94a3b8] mt-1text-xs">Import, map & automate content planning across all brands</p>
                        </div>
                    </div>

                    {/* Top Action Bar */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setShowUploadModal(true); setUploadStep(1); }}
                                className="flex items-center gap-2 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white px-4 py-2 rounded-xl font-medium transition-all"
                            >
                                <Plus size={16} /> Upload Calendar
                            </button>
                            <button className="flex items-center gap-2 bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 border border-[#06b6d4]/20 text-[#22d3ee] px-4 py-2 rounded-xl font-medium transition-all">
                                <Table size={16} /> Connect Google Sheet
                            </button>
                            <button className="flex items-center gap-2 bg-[#1e293b] hover:bg-[#334155] text-white px-4 py-2 rounded-xl font-medium transition-all border border-transparent">
                                <FileJson size={16} /> Create Manual Entry
                            </button>
                        </div>

                        <div className="relative w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                            <input
                                type="text"
                                placeholder="Search content..."
                                className="w-full bg-[#161a29] border border-[#1e293b] text-white pl-9 pr-3 py-2 rounded-xl outline-none focus:border-[#06b6d4] transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs & View Controls */}
                <div className="flex items-center justify-between p-4 border-b border-[#1e293b] bg-[#0a0c10]/50 backdrop-blur-md">
                    <div className="flex gap-1.5 p-1 rounded-lg bg-[#161a29] border border-[#1e293b]">
                        {[
                            { id: "uploads", label: "Uploads", icon: Upload },
                            { id: "calendar", label: "Calendar", icon: CalendarIcon },
                            { id: "rules", label: "Automation Rules", icon: Zap },
                            { id: "history", label: "History", icon: Clock },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all",
                                    activeTab === tab.id
                                        ? "bg-[#1e293b] text-white shadow-sm"
                                        : "text-[#94a3b8] hover:text-white"
                                )}
                            >
                                <tab.icon size={14} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[#cbd5e1] text-xs font-bold mr-2">
                            <ChevronLeft size={16} className="cursor-pointer hover:text-white" />
                            <span className="w-16 text-center">April 2026</span>
                            <ChevronRight size={16} className="cursor-pointer hover:text-white" />
                        </div>
                        <div className="flex gap-1 p-1 rounded-lg bg-[#161a29] border border-[#1e293b]">
                            {[
                                { id: "list", icon: List, label: "List" },
                                { id: "week", icon: LayoutGrid, label: "Week" },
                                { id: "month", icon: CalendarDays, label: "Month" },
                            ].map(view => (
                                <button
                                    key={view.id}
                                    onClick={() => setViewMode(view.id)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        viewMode === view.id
                                            ? "bg-[#1e293b] text-white shadow-sm border border-[#334155]"
                                            : "text-[#94a3b8] hover:text-white border border-transparent"
                                    )}
                                >
                                    <view.icon size={14} className={viewMode === view.id ? "text-[#06b6d4]" : ""} />
                                    {view.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Calendar Grid View (Mock) */}
                <div className="flex-1 overflow-auto bg-[#0a0c10] p-4 custom-scrollbar">
                    <div className="grid grid-cols-7 gap-px bg-[#1e293b] border border-[#1e293b] rounded-xl overflow-hidden shadow-lg">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                            <div key={day} className="bg-[#161a29] text-[#94a3b8] text-[10px] font-bold uppercase tracking-wider p-2 text-center">
                                {day}
                            </div>
                        ))}
                        {MOCK_CALENDAR_DAYS.map((day, i) => (
                            <div key={i} className={cn(
                                "min-h-[100px] p-2 bg-[#0f111a] transition-colors hover:bg-[#161a29]",
                                !day.isCurrentMonth && "opacity-40"
                            )}>
                                <span className={cn(
                                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1",
                                    day.date === 15 && day.isCurrentMonth ? "bg-[#06b6d4] text-white" : "text-[#cbd5e1]"
                                )}>
                                    {day.isCurrentMonth ? (day.date - 3 > 0 ? day.date - 3 : day.date) : day.date}
                                </span>
                                <div className="space-y-1">
                                    {day.events.map((ev, idx) => (
                                        <div key={idx} className={cn(
                                            "text-[10px] px-2 py-1 rounded border truncate font-medium",
                                            ev.type === "approved" ? "bg-[#22c55e]/10 border-[#22c55e]/20 text-[#4ade80]" :
                                                ev.type === "pending" ? "bg-[#eab308]/10 border-[#eab308]/20 text-[#facc15]" : ""
                                        )}>
                                            {ev.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Upload Modal Overlay Overlay */}
                {showUploadModal && (
                    <div className="absolute inset-0 z-50 bg-[#0a0c10]/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in zoom-in-95">
                        <div className="bg-[#161a29] border border-[#1e293b] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">

                            <div className="p-5 border-b border-[#1e293b] flex justify-between items-center bg-[#0f111a]">
                                <div>
                                    <h2 className="text-lg font-bold text-white">Parse & Validate Imported Data</h2>
                                    <p className="text-xs text-[#94a3b8]">Review your CSV/JSON columns and configure injection rules.</p>
                                </div>
                                <button onClick={() => setShowUploadModal(false)} className="text-[#94a3b8] hover:text-white pb-6 px-2 text-2xl leading-none">&times;</button>
                            </div>

                            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                                {/* Table preview */}
                                <div className="border border-[#1e293b] rounded-xl overflow-hidden mb-6">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-[#1e293b] text-[#94a3b8]">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Date</th>
                                                <th className="px-3 py-2 font-medium">Platform</th>
                                                <th className="px-3 py-2 font-medium">Brand</th>
                                                <th className="px-3 py-2 font-medium">Topic</th>
                                                <th className="px-3 py-2 font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#1e293b] bg-[#0f111a]">
                                            {MOCK_PARSED_DATA.map((row, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2.5 text-[#cbd5e1]">{row.date}</td>
                                                    <td className="px-3 py-2.5 text-white flex items-center gap-1.5"><List size={12} className="text-[#06b6d4]" /> {row.platform}</td>
                                                    <td className="px-3 py-2.5 text-[#cbd5e1]">{row.brand}</td>
                                                    <td className="px-3 py-2.5 text-[#94a3b8] truncate max-w-[120px]">{row.topic}</td>
                                                    <td className="px-3 py-2.5">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                                                            row.status === "Valid" ? "bg-[#22c55e]/10 text-[#4ade80]" :
                                                                row.status === "Warning" ? "bg-[#eab308]/10 text-[#facc15]" : "bg-[#ef4444]/10 text-[#f87171]"
                                                        )}>
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Injection Settings */}
                                <div>
                                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Settings size={14} /> Inject Settings</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <div className="w-4 h-4 rounded border border-[#06b6d4] bg-[#06b6d4]/20 flex items-center justify-center">
                                                    <CheckCircle2 size={12} className="text-[#06b6d4]" />
                                                </div>
                                                <span className="text-xs text-[#cbd5e1] group-hover:text-white">Inject as Draft Content</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <div className="w-4 h-4 rounded border border-[#334155] bg-[#0f111a]"></div>
                                                <span className="text-xs text-[#cbd5e1] group-hover:text-white">Require Manual Approval</span>
                                            </label>
                                            <div className="pt-1">
                                                <p className="text-xs text-[#94a3b8] mb-1">Timezone for Schedule</p>
                                                <select className="w-full bg-[#161a29] border border-[#1e293b] rounded-lg px-2 py-1.5 text-xs text-white outline-none">
                                                    <option>Auto-detect (Manual)</option>
                                                    <option>UTC+00:00</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-3 border-l border-[#1e293b] pl-4">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <div className="w-4 h-4 rounded border border-[#06b6d4] bg-[#06b6d4]/20 flex items-center justify-center">
                                                    <CheckCircle2 size={12} className="text-[#06b6d4]" />
                                                </div>
                                                <span className="text-xs text-[#cbd5e1] group-hover:text-white">Auto-run Workflow Engine</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <div className="w-4 h-4 rounded border border-[#334155] bg-[#0f111a]"></div>
                                                <span className="text-xs text-[#cbd5e1] group-hover:text-white">Schedule automatically</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-[#1e293b] bg-[#0f111a] flex justify-between items-center">
                                <button onClick={() => setShowUploadModal(false)} className="text-[#94a3b8] hover:text-white text-xs font-semibold px-4 py-2">Cancel</button>
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] text-white px-6 py-2 rounded-xl font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2"
                                >
                                    <Zap size={14} /> Inject 15 Entries
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Panel - Rules & Stats */}
            <div className="w-80 flex flex-col bg-[#0a0c10] border-l border-[#1e293b] flex-shrink-0 z-10 overflow-y-auto custom-scrollbar">

                {/* Automation Rules */}
                <div className="p-5 border-b border-[#1e293b]">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Zap size={14} className="text-[#eab308]" /> Automation Rules
                        </h3>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] mb-4">Create recurring content generation rules</p>

                    <button className="w-full flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all mb-4">
                        <Plus size={14} /> New Rule
                    </button>

                    <div className="space-y-3">
                        {MOCK_RULES.map((rule) => (
                            <div key={rule.id} className="bg-[#161a29] border border-[#1e293b] rounded-xl p-3">
                                <div className="flex items-start justify-between mb-1.5">
                                    <span className="text-xs font-bold text-white">{rule.title}</span>
                                    <IconButton icon={MoreVertical} className="h-4 w-4 text-[#64748b] hover:text-white" />
                                </div>
                                <p className="text-[10px] text-[#94a3b8] mb-2 leading-tight">{rule.desc}</p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#06b6d4] bg-[#06b6d4]/10 px-1.5 py-0.5 rounded">
                                        {rule.brand}
                                    </span>
                                    <ToggleSwitch checked={rule.active} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Usage Stats Widget */}
                <div className="p-5">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Activity size={14} className="text-[#a855f7]" /> Usage Stats
                    </h3>
                    <div className="bg-[#161a29] border border-[#1e293b] p-4 rounded-xl relative overflow-hidden">

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <div className="text-xs font-bold text-white mb-0.5">150</div>
                                <div className="text-[9px] text-[#94a3b8]">Total generated entries</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-[#4ade80]">8743</div>
                                <div className="text-[9px] text-[#94a3b8]">Live media viewed</div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-[#1e293b]">
                            <div className="text-lg font-bold text-white mb-0.5">$4.32</div>
                            <div className="text-[9px] text-[#94a3b8]">Estimated cost saved</div>
                        </div>

                        {/* Subtle background graphic */}
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-[#06b6d4]/10 to-[#8b5cf6]/10 rounded-full blur-xl pointer-events-none" />
                    </div>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}} />
        </div>
    );
}

// Icon fallbacks that were missing natively
function Settings(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>; }
function Activity(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>; }
