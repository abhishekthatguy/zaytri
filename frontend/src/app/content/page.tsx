"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ContentCard from "@/components/ContentCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";
import { listContent, approveContent, rejectContent, editContent, publishNow, deleteContent } from "@/lib/api";

interface ContentItem {
    id: string;
    topic: string;
    platform: string;
    caption: string;
    hook: string;
    post_text: string;
    improved_text: string;
    status: string;
    review_score: number | null;
    created_at: string;
    deleted_at?: string;
}

const ALL_STATUSES = ["draft", "reviewed", "approved", "waiting_approval", "scheduled", "published", "failed", "deleted"];
const ALL_BRANDS = ["Zaytri", "FitPro", "TechCorp"]; // Simulated until API gives brands
const ALL_PLATFORMS = ["instagram", "facebook", "twitter", "youtube", "linkedin"];

export default function ContentPage() {
    const [content, setContent] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Filter Bar State
    const [activeBrand, setActiveBrand] = useState("");
    const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
    const [activeStatus, setActiveStatus] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Persist filters in URL on change could go here if Next Router used

    const fetchContent = useCallback(async () => {
        setLoading(true);
        try {
            // Note: mapping `waiting_approval` to API status if needed, 
            // relying on backend implementation for proper filtering.
            let filterStatus = activeStatus;
            if (activeStatus === "waiting_approval") filterStatus = "reviewed";

            const data: any = await listContent({
                status: filterStatus || undefined,
                platform: activePlatforms.length === 1 ? activePlatforms[0] : undefined // simple query logic
            });
            // Client-side filtering to supplement basic API
            let items: ContentItem[] = data.items || [];
            if (activePlatforms.length > 0) {
                items = items.filter(item => activePlatforms.includes(item.platform.toLowerCase()));
            }
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                items = items.filter(item =>
                    item.topic.toLowerCase().includes(q) ||
                    (item.caption && item.caption.toLowerCase().includes(q))
                );
            }
            setContent(items);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load content");
        } finally {
            setLoading(false);
        }
    }, [activeStatus, activePlatforms, searchQuery]);

    useEffect(() => {
        const t = setTimeout(() => {
            fetchContent();
        }, 300); // debounce API calls for search
        return () => clearTimeout(t);
    }, [fetchContent]);

    // Auto-clear messages
    useEffect(() => {
        if (error || success) {
            const t = setTimeout(() => { setError(""); setSuccess(""); }, 5000);
            return () => clearTimeout(t);
        }
    }, [error, success]);

    const handlePlatformToggle = (p: string) => {
        setActivePlatforms(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
        );
    }

    /* Handlers */
    const handleApprove = async (id: string) => {
        try {
            await approveContent(id);
            setSuccess("Content approved!");
            fetchContent();
        } catch (err: unknown) {
            setError("Failed to approve");
        }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectContent(id);
            setSuccess("Content sent back to draft.");
            fetchContent();
        } catch (err: unknown) {
            setError("Failed to reject");
        }
    };

    const handleEdit = async (id: string, data: Record<string, string>) => {
        try {
            await editContent(id, data);
            setSuccess("Content updated!");
            fetchContent();
        } catch (err: unknown) {
            setError("Failed to save edits");
        }
    };

    const handlePublishNow = async (id: string) => {
        try {
            await publishNow(id);
            setSuccess("Published successfully!");
            fetchContent();
        } catch (err: unknown) {
            setError("Failed to publish");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteContent(id);
            setSuccess("Content moved to trash.");
            fetchContent();
        } catch (err: unknown) {
            setError("Failed to delete");
        }
    };

    const handleRetry = async (id: string) => {
        try {
            await publishNow(id); // Using publish as retry
            setSuccess("Retrying publish sequence...");
            fetchContent();
        } catch (err: unknown) {
            setError("Failed to retry publish");
        }
    }

    return (
        <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2 ml-1/2">
                        💬 Content
                    </h1>
                    <p className="text-sm text-[#94a3b8] ml-2">
                        Manage AI-generated social media content across platforms
                    </p>
                </div>
                {/* Could add a 'New Content' button here */}
            </div>

            {/* Filter Bar Component */}
            <FilterBar
                brands={ALL_BRANDS}
                activeBrand={activeBrand}
                onBrandChange={setActiveBrand}
                platforms={ALL_PLATFORMS}
                activePlatforms={activePlatforms}
                onPlatformToggle={handlePlatformToggle}
                statuses={ALL_STATUSES}
                activeStatus={activeStatus}
                onStatusChange={setActiveStatus}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
            />

            {/* Notifications */}
            {success && (
                <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20 flex items-center gap-2">
                    ✅ {success}
                </div>
            )}
            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium bg-[#f43f5e]/10 text-[#fb7185] border border-[#f43f5e]/20 flex items-center gap-2">
                    ❌ {error}
                </div>
            )}

            {/* Grid Layout */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 opacity-50 space-y-4">
                    <div className="w-10 h-10 rounded-full border-4 border-[#1e293b] border-t-[#06b6d4] animate-spin" />
                    <p className="text-sm text-[#94a3b8] font-bold tracking-widest uppercase">Syncing...</p>
                </div>
            ) : content.length === 0 ? (
                <div className="bg-[#0f111a] border border-[#1e293b] rounded-3xl p-16 flex flex-col items-center text-center shadow-lg">
                    <span className="text-5xl block mb-6 drop-shadow-lg filter grayscale opacity-80">📭</span>
                    <h3 className="text-xl font-bold text-white mb-2">
                        No Content Found
                    </h3>
                    <p className="text-sm text-[#94a3b8] max-w-sm leading-relaxed mb-6">
                        Either your filter combination produced no results or you need to run a workflow to populate content.
                    </p>
                    <button className="bg-[#1e293b] text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-[#334155] transition-colors cursor-pointer border border-[#334155]"
                        onClick={() => { setActiveStatus(""); setActivePlatforms([]); setSearchQuery(""); }}>
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className={cn(
                    "stagger-children",
                    viewMode === "grid"
                        ? "grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5"
                        : "flex flex-col gap-4"
                )}>
                    {content.map((item, i) => (
                        <div key={item.id} style={{ animationDelay: `${i * 0.05}s` }}>
                            <ContentCard
                                id={item.id}
                                topic={item.topic}
                                platform={item.platform}
                                brand={activeBrand || "Zaytri"} // Simulating brand selection map
                                caption={item.caption || ""}
                                hook={item.hook || ""}
                                post_text={item.post_text || ""}
                                improved_text={item.improved_text || ""}
                                status={item.status}
                                score={item.review_score}
                                createdAt={item.created_at}
                                deletedAt={item.deleted_at}
                                metadata={{
                                    model: item.id.charCodeAt(0) % 2 === 0 ? "GPT-4o" : "Claude 3 Sonnet",
                                    tokens: Math.floor(item.topic.length * 9.5),
                                    cost: (Math.random() * 0.05).toFixed(3),
                                    tone: "Professional & Sharp",
                                    retries: item.status === "failed" ? 1 : 0,
                                }}
                                onApprove={handleApprove}
                                onReject={handleReject}
                                onEdit={handleEdit}
                                onPublishNow={handlePublishNow}
                                onDelete={handleDelete}
                                onRetry={item.status === "failed" ? handleRetry : undefined}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
