"use client";

import * as React from "react";
import { Search, Grid, List } from "lucide-react";

export interface FilterBarProps {
    brands: string[];
    activeBrand: string;
    onBrandChange: (b: string) => void;
    platforms: string[];
    activePlatforms: string[];
    onPlatformToggle: (p: string) => void;
    statuses: string[];
    activeStatus: string;
    onStatusChange: (s: string) => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    viewMode: "grid" | "list";
    onViewModeChange: (m: "grid" | "list") => void;
}

export function FilterBar({
    brands,
    activeBrand,
    onBrandChange,
    platforms,
    activePlatforms,
    onPlatformToggle,
    statuses,
    activeStatus,
    onStatusChange,
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
}: FilterBarProps) {

    return (
        <div className="flex flex-col md:flex-row items-center gap-4 bg-[#0f111a] border border-[#1e293b] p-3 rounded-2xl mb-6 shadow-sm">

            {/* Brand Dropdown (Simplified) */}
            <select
                value={activeBrand}
                onChange={(e) => onBrandChange(e.target.value)}
                className="bg-[#161a29] text-sm text-[#f1f5f9] border border-[#1e293b] rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors min-w-[140px]"
            >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* Platform Icons */}
            <div className="flex bg-[#161a29] rounded-lg p-1 border border-[#1e293b]">
                {platforms.map(p => {
                    let icon = "🌐"
                    if (p === "instagram") icon = "📸"
                    else if (p === "facebook") icon = "👤"
                    else if (p === "twitter") icon = "🐦"
                    else if (p === "youtube") icon = "▶️"
                    else if (p === "linkedin") icon = "💼"

                    return (
                        <button
                            key={p}
                            title={p}
                            onClick={() => onPlatformToggle(p)}
                            className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-all ${activePlatforms.includes(p) ? "bg-[#1e293b] shadow-sm transform scale-105" : "opacity-50 hover:opacity-100 hover:bg-[#1e293b]/50"
                                }`}
                        >
                            {icon}
                        </button>
                    )
                })}
            </div>

            {/* Status Dropdown */}
            <select
                value={activeStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="bg-[#161a29] text-sm text-[#f1f5f9] border border-[#1e293b] rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors min-w-[140px]"
            >
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>)}
            </select>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search Output */}
            <div className="relative flex-shrink-0 w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                    type="text"
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full bg-[#161a29] text-sm text-[#f1f5f9] border border-[#1e293b] rounded-lg pl-10 pr-4 py-2 outline-none focus:border-[#06b6d4] transition-colors"
                />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-[#161a29] rounded-lg p-1 border border-[#1e293b]">
                <button
                    onClick={() => onViewModeChange("list")}
                    className={`p-1.5 rounded text-[#94a3b8] ${viewMode === "list" ? "bg-[#1e293b] text-white" : "hover:text-white"}`}
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => onViewModeChange("grid")}
                    className={`p-1.5 rounded text-[#94a3b8] ${viewMode === "grid" ? "bg-[#1e293b] text-white" : "hover:text-white"}`}
                >
                    <Grid size={16} />
                </button>
            </div>

        </div>
    )
}
