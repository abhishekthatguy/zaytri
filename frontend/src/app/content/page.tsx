"use client";

import { useState, useEffect, useCallback } from "react";
import ContentCard from "@/components/ContentCard";
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

export default function ContentPage() {
    const [content, setContent] = useState<ContentItem[]>([]);
    const [filter, setFilter] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const fetchContent = useCallback(async () => {
        setLoading(true);
        try {
            const data: any = await listContent({ status: filter || undefined });
            setContent(data.items || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load content");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    // Auto-clear messages
    useEffect(() => {
        if (error || success) {
            const t = setTimeout(() => { setError(""); setSuccess(""); }, 5000);
            return () => clearTimeout(t);
        }
    }, [error, success]);

    const handleApprove = async (id: string) => {
        try {
            await approveContent(id);
            setSuccess("Content approved! You can now publish it.");
            fetchContent();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to approve");
        }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectContent(id);
            setSuccess("Content sent back to draft.");
            fetchContent();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to reject");
        }
    };

    const handleEdit = async (id: string, data: Record<string, string>) => {
        try {
            await editContent(id, data);
            setSuccess("Content updated successfully!");
            fetchContent();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to save edits");
        }
    };

    const handlePublishNow = async (id: string) => {
        try {
            const result: any = await publishNow(id);
            setSuccess(result.message || "Published successfully! 🎉");
            fetchContent();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to publish");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Move this content to trash?")) return;
        try {
            await deleteContent(id);
            setSuccess("Content moved to trash 🗑️");
            fetchContent();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to delete");
        }
    };

    const FILTERS = ["", "draft", "reviewed", "approved", "published", "failed", "deleted"];

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">📝 Content</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                        Manage generated social media content
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {FILTERS.map((f) => (
                    <button
                        key={f || "all"}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 capitalize cursor-pointer ${filter === f ? "text-white" : ""
                            }`}
                        style={{
                            background: filter === f
                                ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                                : "var(--zaytri-surface-2)",
                            border: `1px solid ${filter === f ? "transparent" : "var(--zaytri-border)"}`,
                            color: filter === f ? "white" : "var(--zaytri-text-dim)",
                        }}
                    >
                        {f || "All"}
                    </button>
                ))}
            </div>

            {/* Success message */}
            {success && (
                <div className="mb-4 p-3 rounded-lg text-sm text-green-400"
                    style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                    ✅ {success}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mb-4 p-3 rounded-lg text-sm text-red-400"
                    style={{ background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.2)" }}>
                    ❌ {error}
                </div>
            )}

            {/* Content Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                </div>
            ) : content.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <span className="text-4xl block mb-4">📭</span>
                    <h3 className="text-lg font-bold mb-2">
                        {filter ? `No ${filter} content` : "No Content Yet"}
                    </h3>
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                        {filter
                            ? `No content with "${filter}" status found. Try a different filter.`
                            : "Run a workflow to generate your first content piece."
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {content.map((item) => (
                        <ContentCard
                            key={item.id}
                            id={item.id}
                            topic={item.topic}
                            platform={item.platform}
                            caption={item.caption || ""}
                            hook={item.hook || ""}
                            post_text={item.post_text || ""}
                            improved_text={item.improved_text || ""}
                            status={item.status}
                            score={item.review_score}
                            createdAt={item.created_at}
                            deletedAt={item.deleted_at}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onEdit={handleEdit}
                            onPublishNow={handlePublishNow}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
