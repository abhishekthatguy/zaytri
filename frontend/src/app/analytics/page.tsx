"use client";

import { useState, useMemo } from "react";
import {
    BarChart3, TrendingUp, TrendingDown, Calendar, Search,
    Instagram, Facebook, Linkedin, Twitter, Youtube,
    MoreVertical, ArrowUpRight, ArrowDownRight, Activity,
    Zap, Clock, Target, CheckCircle2, AlertCircle, Sparkles, Sliders, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// Make sure to remove any other imports if not needed, like AnalyticsChart

// --- Mock Data Generators ---
const BRANDS = ["All Brands", "CorpEdge", "FitPro", "Estene", "BrandX"];
const TIME_RANGES = [
    { label: "7 Days", val: 7 },
    { label: "14 Days", val: 14 },
    { label: "30 Days", val: 30 },
    { label: "90 Days", val: 90 },
    { label: "Custom", val: 0 },
];
const PLATFORMS = [
    { id: "all", label: "All Platforms", icon: null },
    { id: "instagram", label: "Instagram", icon: Instagram },
    { id: "facebook", label: "Facebook", icon: Facebook },
    { id: "linkedin", label: "LinkedIn", icon: Linkedin },
    { id: "twitter", label: "X", icon: Twitter },
    { id: "youtube", label: "YouTube", icon: Youtube },
];

const MOCK_TOP_POSTS = [
    { id: 1, brand: "FitPro", platform: "instagram", title: "10 Proven Tips to Enhance Your Workout", likes: 812, comments: 85, shares: 14, saves: 5, approval: "Approved", score: 9.2 },
    { id: 2, brand: "CorpEdge", platform: "linkedin", title: "5 Strategies for Streamlining Your Enterprise Workflow", likes: 786, comments: 86, shares: 14, saves: 5, approval: "Approved", score: 8.8 },
    { id: 3, brand: "BrandX", platform: "twitter", title: "The Future of AI in Financial Markets", likes: 646, comments: 105, shares: 32, saves: 5, approval: "Pending", score: 8.1 },
    { id: 4, brand: "Estene", platform: "facebook", title: "Our latest summer collection is here! ☀️", likes: 512, comments: 40, shares: 8, saves: 12, approval: "Approved", score: 7.9 },
    { id: 5, brand: "FitPro", platform: "youtube", title: "Full Body HIIT Workout - No Equipment", likes: 420, comments: 30, shares: 50, saves: 100, approval: "Approved", score: 7.5 }
];

const MOCK_UNDERPERFORMING = [
    { id: 6, brand: "CorpEdge", platform: "facebook", title: "Weekly update #45", issue: "Low hook strength", recommendation: "Add a compelling question in the first sentence." },
    { id: 7, brand: "BrandX", platform: "linkedin", title: "New API docs", issue: "Poor posting time", recommendation: "Reschedule to Tuesday 9:00 AM." },
];

const generateChartData = (days: number) => {
    return Array.from({ length: days === 0 ? 14 : Math.min(days, 30) }, (_, i) => ({
        day: i + 1,
        reach: Math.floor(Math.random() * 5000) + 1000,
        engagement: Math.floor(Math.random() * 1000) + 200,
    }));
};

const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <div
        className={cn("w-8 h-4.5 rounded-full relative cursor-pointer transition-colors", checked ? "bg-[#8b5cf6]" : "bg-[#1e293b]")}
        onClick={() => onChange(!checked)}
    >
        <div className={cn("absolute top-[2px] left-[2px] bg-white w-3.5 h-3.5 rounded-full transition-transform", checked ? "translate-x-[14px]" : "")} />
    </div>
);

export default function AnalyticsPage() {
    const [days, setDays] = useState(30);
    const [platform, setPlatform] = useState("all");
    const [brand, setBrand] = useState("All Brands");
    const [advancedMode, setAdvancedMode] = useState(false);
    const [chartMode, setChartMode] = useState("reach");

    const chartData = useMemo(() => generateChartData(days), [days, brand, platform]);
    const maxChartVal = useMemo(() => Math.max(...chartData.map(d => d.reach)), [chartData]);

    // Derived mock stats based on filters
    const baseMultiplier = (days || 14) * (platform === "all" ? 4 : 1) * (brand === "All Brands" ? 3 : 1);

    const stats = {
        likes: Math.floor(100 * baseMultiplier * (Math.random() * 0.5 + 0.8)),
        shares: Math.floor(12 * baseMultiplier * (Math.random() * 0.5 + 0.8)),
        impressions: Math.floor(9200 * baseMultiplier * (Math.random() * 0.5 + 0.8)),
        reach: Math.floor(6500 * baseMultiplier * (Math.random() * 0.5 + 0.8)),
        engagementRate: (5.72 * (Math.random() * 0.4 + 0.8)).toFixed(2),
        comments: Math.floor(40 * baseMultiplier * (Math.random() * 0.5 + 0.8)),
        saves: Math.floor(5 * baseMultiplier * (Math.random() * 0.5 + 0.8)),
    };

    const topPosts = MOCK_TOP_POSTS.filter(p =>
        (brand === "All Brands" || p.brand === brand) &&
        (platform === "all" || p.platform === platform)
    ).slice(0, 5);

    const underPosts = MOCK_UNDERPERFORMING.filter(p =>
        (brand === "All Brands" || p.brand === brand) &&
        (platform === "all" || p.platform === platform)
    );

    return (
        <div className="flex h-[calc(100vh-2rem)] bg-[#0f111a] text-sm animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">

            <div className="flex-1 p-6 space-y-6 min-w-0 pb-12">

                {/* Header & Filters */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                            <BarChart3 className="text-[#8b5cf6]" /> Analytics
                        </h1>
                        <p className="text-[#94a3b8] mt-1 text-xs">Track your social media performance across all channels</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Brand Selector */}
                        <div className="relative group">
                            <select
                                value={brand}
                                onChange={e => setBrand(e.target.value)}
                                className="appearance-none bg-[#161a29] border border-[#1e293b] text-white px-4 py-2 pr-8 rounded-xl outline-none focus:border-[#8b5cf6] cursor-pointer text-xs font-semibold"
                            >
                                {BRANDS.map(b => <option key={b}>{b}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
                        </div>

                        <div className="relative w-56">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                            <input
                                type="text"
                                placeholder="Search content..."
                                className="w-full bg-[#161a29] border border-[#1e293b] text-white pl-9 pr-3 py-2 rounded-xl outline-none focus:border-[#8b5cf6] transition-colors text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-2 bg-[#161a29] p-2 rounded-xl border border-[#1e293b]">
                    <div className="flex bg-[#0f111a] p-1 rounded-lg border border-[#1e293b]">
                        {TIME_RANGES.map(t => (
                            <button
                                key={t.label}
                                onClick={() => setDays(t.val)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                    days === t.val ? "bg-[#1e293b] text-white" : "text-[#64748b] hover:text-white"
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-[#1e293b] mx-2" />

                    <div className="flex bg-[#0f111a] p-1 rounded-lg border border-[#1e293b]">
                        {PLATFORMS.map(p => {
                            const Icon = p.icon;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setPlatform(p.id)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                                        platform === p.id ? "bg-[#1e293b] text-[#06b6d4]" : "text-[#64748b] hover:text-white"
                                    )}
                                >
                                    {Icon && <Icon size={12} />} {p.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Section 1: Top Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">

                    {[
                        { title: "Total Likes", val: stats.likes.toLocaleString(), grow: "+13%", up: true, icon: "❤️" },
                        { title: "Shares", val: stats.shares.toLocaleString(), grow: "+22%", up: true, icon: "🔄" },
                        { title: "Total Reach", val: (stats.reach / 1000).toFixed(1) + "k", grow: "-5%", up: false, icon: "👁️" },
                        { title: "Impressions", val: (stats.impressions / 1000).toFixed(1) + "k", grow: "+18%", up: true, icon: "📈" },
                    ].map((m, i) => (
                        <div key={i} className="bg-[#161a29] border border-[#1e293b] rounded-xl p-4 flex flex-col justify-between hover:border-[#334155] transition-colors relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-2 z-10">
                                <span className="text-xs font-medium text-[#94a3b8] flex items-center gap-2">
                                    <span className="opacity-50 text-[10px]">{m.icon}</span> {m.title}
                                </span>
                            </div>
                            <div className="flex items-end gap-3 z-10">
                                <h3 className="text-2xl font-bold text-white">{m.val}</h3>
                                <span className={cn("text-xs font-bold mb-1 flex items-center", m.up ? "text-[#4ade80]" : "text-[#f87171]")}>
                                    {m.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {m.grow}
                                </span>
                            </div>
                            {/* Glow effect */}
                            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-[#06b6d4] opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity" />
                        </div>
                    ))}

                    {/* Hero Metric: Engagement Rate */}
                    <div className="bg-gradient-to-br from-[#1e1b4b] to-[#161a29] border border-[#8b5cf6]/30 rounded-xl p-4 col-span-1 md:col-span-4 lg:col-span-1 flex flex-col justify-center relative overflow-hidden">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#a78bfa] mb-2 z-10">
                            <Activity size={14} /> Engagement Rate
                        </div>
                        <div className="text-4xl font-extrabold text-white z-10 mb-1">{stats.engagementRate}%</div>
                        <div className="text-[10px] font-bold text-[#4ade80] flex items-center gap-1 z-10">
                            <TrendingUp size={12} /> Top 10% benchmark
                        </div>

                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-10" />
                        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#8b5cf6] opacity-20 rounded-full blur-3xl pointer-events-none" />
                    </div>

                </div>

                {/* Section 2: Chart Overview */}
                <div className="bg-[#161a29] border border-[#1e293b] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp size={14} /> Performance Overview</h3>
                            <div className="flex bg-[#0f111a] p-1 rounded-lg border border-[#1e293b]">
                                <button onClick={() => setChartMode("reach")} className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded", chartMode === "reach" ? "bg-[#1e293b] text-white" : "text-[#64748b]")}>Reach</button>
                                <button onClick={() => setChartMode("engagement")} className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded", chartMode === "engagement" ? "bg-[#1e293b] text-white" : "text-[#64748b]")}>Engage</button>
                            </div>
                        </div>
                        <div className="text-xs text-[#64748b] bg-[#0f111a] px-3 py-1.5 rounded-lg border border-[#1e293b]">
                            {brand} • {platform === "all" ? "All Platforms" : platform}
                        </div>
                    </div>

                    <div className="h-56 flex items-end gap-1.5 w-full relative pt-6">
                        {/* Mock Y Axis lines */}
                        <div className="absolute inset-x-0 bottom-0 h-px bg-[#1e293b]" />
                        <div className="absolute inset-x-0 bottom-1/4 h-px bg-[#1e293b]/50 border-t border-dashed border-[#334155]" />
                        <div className="absolute inset-x-0 bottom-2/4 h-px bg-[#1e293b]/50 border-t border-dashed border-[#334155]" />
                        <div className="absolute inset-x-0 bottom-3/4 h-px bg-[#1e293b]/50 border-t border-dashed border-[#334155]" />

                        {chartData.map((d, i) => {
                            const val = chartMode === "reach" ? d.reach : d.engagement;
                            const heightPct = Math.max(5, (val / (chartMode === "reach" ? maxChartVal : Math.max(...chartData.map(c => c.engagement)))) * 100);
                            return (
                                <div key={i} className="flex-1 flex justify-center group relative z-10 h-full items-end pb-0">
                                    <div
                                        className="w-full max-w-[12px] rounded-t-sm transition-all duration-500 overflow-hidden relative"
                                        style={{ height: `${heightPct}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#8b5cf6]/20 to-[#06b6d4] hover:from-[#8b5cf6] hover:to-[#06b6d4]" />
                                    </div>
                                    <div className="absolute bottom-full mb-2 bg-[#0a0c10] border border-[#1e293b] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl">
                                        Day {d.day}: {val.toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-[10px] text-[#64748b] mt-3 uppercase font-bold tracking-wider">
                        <span>Day 1</span>
                        <span>Day {chartData.length}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column - Quick Metrics & Underperforming */}
                    <div className="space-y-6">
                        {/* Quick Stats list */}
                        <div className="bg-[#161a29] border border-[#1e293b] rounded-xl p-4">
                            <div className="space-y-0 divide-y divide-[#1e293b]">
                                {[
                                    { label: "Likes", val: stats.likes, grow: "+19%", up: true },
                                    { label: "Comments", val: stats.comments, grow: "+22%", up: true },
                                    { label: "Shares", val: stats.shares, grow: "-5%", up: false },
                                    { label: "Saves", val: stats.saves, grow: "+68%", up: true },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-3">
                                        <span className="text-xs font-semibold text-[#cbd5e1]">{item.label}</span>
                                        <div className="flex items-center gap-4">
                                            <span className={cn("text-[10px] font-bold flex items-center", item.up ? "text-[#4ade80]" : "text-[#f87171]")}>
                                                {item.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {item.grow}
                                            </span>
                                            <span className="text-sm font-bold text-white w-12 text-right">{item.val.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Underperforming Insights */}
                        <div className="bg-[#161a29] border border-[#1e293b] rounded-xl p-4 border-l-4 border-l-[#f59e0b]">
                            <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                                <AlertCircle size={14} className="text-[#f59e0b]" /> Underperforming Alerts
                            </h3>
                            {underPosts.length > 0 ? (
                                <div className="space-y-3">
                                    {underPosts.map(p => (
                                        <div key={p.id} className="bg-[#0f111a] border border-[#1e293b]/50 p-3 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#334155]/50 text-[#94a3b8]">{p.platform}</span>
                                                <span className="text-[10px] font-semibold text-white truncate">{p.title}</span>
                                            </div>
                                            <p className="text-[10px] text-[#f87171] mb-1 font-medium">Issue: {p.issue}</p>
                                            <p className="text-[10px] text-[#cbd5e1] flex items-start gap-1">
                                                <Sparkles size={10} className="text-[#06b6d4] mt-0.5 shrink-0" /> {p.recommendation}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-[#64748b]">No active alerts for this period.</p>
                            )}
                        </div>
                    </div>

                    {/* Middle Column - Top Performing Posts */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-[#161a29] border border-[#1e293b] rounded-xl p-5 h-full">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-[#4ade80]" /> Content Intelligence // Top Posts
                                </h3>
                                <button className="text-xs text-[#06b6d4] hover:text-[#22d3ee] font-semibold">View All Content</button>
                            </div>

                            {topPosts.length > 0 ? (
                                <div className="space-y-3">
                                    {topPosts.map(post => {
                                        const PlatformIcon = PLATFORMS.find(p => p.id === post.platform)?.icon || Globe;
                                        return (
                                            <div key={post.id} className="group bg-[#0f111a] border border-[#1e293b] hover:border-[#334155] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors relative overflow-hidden">

                                                {/* Left details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider bg-[#1e293b] text-[#cbd5e1] px-2 py-0.5 rounded flex items-center gap-1">
                                                            <PlatformIcon size={10} /> {post.platform}
                                                        </span>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/30 px-2 py-0.5 rounded">
                                                            {post.brand}
                                                        </span>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#4ade80] bg-[#4ade80]/10 border border-[#4ade80]/20 px-2 py-0.5 rounded">
                                                            AI Score: {post.score}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-white truncate pr-4 group-hover:text-[#06b6d4] transition-colors cursor-pointer">
                                                        {post.title}
                                                    </h4>
                                                </div>

                                                {/* Right stats */}
                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div className="flex gap-4 text-xs font-semibold text-[#cbd5e1]">
                                                        <span className="flex items-center gap-1.5"><span className="text-[10px] opacity-50">❤️</span> {post.likes}</span>
                                                        <span className="flex items-center gap-1.5"><span className="text-[10px] opacity-50">💬</span> {post.comments}</span>
                                                        <span className="flex items-center gap-1.5"><span className="text-[10px] opacity-50">🔄</span> {post.shares}</span>
                                                    </div>
                                                    <button className="bg-[#1e293b] hover:bg-[#334155] text-white p-2 rounded-lg transition-colors border border-[#334155]">
                                                        <ArrowUpRight size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-[#64748b] text-xs">
                                    No posts found for the current filter selection.
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Section 4 & 5: AI Insights + Advanced/Automation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 border-t border-[#1e293b] pt-6">

                    {/* Insights Hub */}
                    <div className="bg-gradient-to-br from-[#161a29] to-[#0f111a] border border-[#1e293b] rounded-xl p-5">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Sparkles size={14} className="text-[#06b6d4]" /> AI Performance Insights
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <InsightCard title="Best Posting Time" val="Tue, 9:00 AM" desc="Peak engagement detected." />
                            <InsightCard title="Top Platform" val="LinkedIn" desc="Yielding highest B2B reach." />
                            <InsightCard title="Content Format" val="Listicles" desc="Drives +24% more saves." />
                            <InsightCard title="Theme Suggestion" val="AI Automation" desc="High trending hook score." />
                        </div>
                    </div>

                    {/* Advanced Enterprise Controls */}
                    <div className="bg-[#161a29] border border-[#1e293b] rounded-xl p-5 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Sliders size={14} className="text-[#a78bfa]" /> Advanced Analytics (Enterprise)
                            </h3>
                            <ToggleSwitch checked={advancedMode} onChange={setAdvancedMode} />
                        </div>

                        {advancedMode ? (
                            <div className="space-y-3 animate-in fade-in flex-1">
                                <div className="flex justify-between items-center text-xs p-2.5 bg-[#0f111a] border border-[#1e293b] rounded-lg">
                                    <span className="text-[#94a3b8]">Token Usage Loop</span>
                                    <span className="font-mono text-[#cbd5e1]">124,500 GPT-4o</span>
                                </div>
                                <div className="flex justify-between items-center text-xs p-2.5 bg-[#0f111a] border border-[#1e293b] rounded-lg">
                                    <span className="text-[#94a3b8]">Auto Publish Success</span>
                                    <span className="font-bold text-[#4ade80]">98.2%</span>
                                </div>
                                <div className="flex justify-between items-center text-xs p-2.5 bg-[#0f111a] border border-[#1e293b] rounded-lg">
                                    <span className="text-[#94a3b8]">AI vs Manual</span>
                                    <div className="flex items-center gap-2 w-32">
                                        <div className="flex-1 h-2 bg-[#1e293b] rounded-full overflow-hidden flex">
                                            <div className="w-[85%] bg-[#06b6d4]" />
                                            <div className="w-[15%] bg-[#8b5cf6]" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs p-2.5 bg-[#0f111a] border border-[#1e293b] rounded-lg">
                                    <span className="text-[#94a3b8]">Approval Rejection Rate</span>
                                    <span className="font-bold text-[#f87171]">4.5%</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                                <Zap size={24} className="text-[#64748b] mb-2" />
                                <p className="text-xs text-[#94a3b8] max-w-xs">Enable Advanced Mode to view token usage, pipeline success rates, and LLM cost intelligence.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
            `}} />
        </div >
    );
}

// Subcomponent
function InsightCard({ title, val, desc }: { title: string, val: string, desc: string }) {
    return (
        <div className="bg-[#0a0c10] border border-[#1e293b] p-3 rounded-xl flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">{title}</span>
            <span className="text-sm font-bold text-white mb-0.5">{val}</span>
            <span className="text-[10px] text-[#06b6d4]">{desc}</span>
        </div>
    );
}

function Globe(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
}
