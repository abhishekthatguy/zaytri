"use client";

import { useState } from "react";

interface ContentCardProps {
    id: string;
    topic: string;
    platform: string;
    caption: string;
    hook: string;
    post_text?: string;
    improved_text?: string;
    status: string;
    score: number | null;
    createdAt: string;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onEdit?: (id: string, data: Record<string, string>) => void;
    onPublishNow?: (id: string) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
    instagram: "📸",
    facebook: "👤",
    twitter: "🐦",
    youtube: "▶️",
};

export default function ContentCard({
    id, topic, platform, caption, hook, post_text, improved_text,
    status, score, createdAt, onApprove, onReject, onEdit, onPublishNow,
}: ContentCardProps) {
    const [editing, setEditing] = useState(false);
    const [editCaption, setEditCaption] = useState(caption);
    const [editHook, setEditHook] = useState(hook);
    const [editPostText, setEditPostText] = useState(post_text || "");
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const badgeClass = `badge badge-${status}`;
    const platformIcon = PLATFORM_ICONS[platform] || "🌐";
    const isEditable = status === "draft" || status === "reviewed";
    const isPublishable = status === "approved";

    const handleSaveEdit = async () => {
        if (!onEdit) return;
        setSaving(true);
        try {
            await onEdit(id, {
                caption: editCaption,
                hook: editHook,
                post_text: editPostText,
            });
            setEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const handlePublishNow = async () => {
        if (!onPublishNow) return;
        setPublishing(true);
        try {
            await onPublishNow(id);
        } finally {
            setPublishing(false);
        }
    };

    return (
        <>
            <div className="glass-card p-5 animate-fade-in" style={{ position: "relative" }}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{platformIcon}</span>
                        <span className="text-sm font-semibold capitalize">{platform}</span>
                    </div>
                    <span className={badgeClass}>{status}</span>
                </div>

                {/* Topic */}
                <h3 className="text-sm font-bold mb-2 line-clamp-1" style={{ color: "var(--zaytri-text)" }}>
                    {topic}
                </h3>

                {/* Hook */}
                {hook && (
                    <p className="text-sm mb-2 line-clamp-2 italic" style={{ color: "var(--zaytri-red-glow)" }}>
                        &ldquo;{hook}&rdquo;
                    </p>
                )}

                {/* Caption Preview */}
                <p className="text-xs mb-4 line-clamp-3" style={{ color: "var(--zaytri-text-dim)" }}>
                    {caption}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--zaytri-border)" }}>
                    <div className="flex items-center gap-3">
                        {score !== null && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>Score:</span>
                                <span className={`text-sm font-bold ${score >= 7 ? "text-green-400" : score >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                                    {score}/10
                                </span>
                            </div>
                        )}
                        <span className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            {new Date(createdAt).toLocaleDateString()}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap justify-end">
                        {/* Edit button for draft/reviewed */}
                        {isEditable && onEdit && (
                            <button
                                onClick={() => setEditing(true)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105 cursor-pointer"
                                style={{
                                    background: "rgba(59, 130, 246, 0.15)",
                                    color: "#60a5fa",
                                    border: "1px solid rgba(59, 130, 246, 0.3)",
                                }}
                            >
                                ✏️ Edit
                            </button>
                        )}

                        {/* Approve/Reject for draft/reviewed */}
                        {isEditable && (
                            <>
                                {onApprove && (
                                    <button
                                        onClick={() => onApprove(id)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105 cursor-pointer"
                                        style={{
                                            background: "rgba(34, 197, 94, 0.15)",
                                            color: "var(--zaytri-green)",
                                            border: "1px solid rgba(34, 197, 94, 0.3)",
                                        }}
                                    >
                                        ✓ Approve
                                    </button>
                                )}
                                {onReject && status !== "draft" && (
                                    <button
                                        onClick={() => onReject(id)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105 cursor-pointer"
                                        style={{
                                            background: "rgba(6, 182, 212, 0.15)",
                                            color: "var(--zaytri-red-glow)",
                                            border: "1px solid rgba(6, 182, 212, 0.3)",
                                        }}
                                    >
                                        ✕ Reject
                                    </button>
                                )}
                            </>
                        )}

                        {/* Publish Now for approved */}
                        {isPublishable && onPublishNow && (
                            <button
                                onClick={handlePublishNow}
                                disabled={publishing}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 hover:scale-105 cursor-pointer"
                                style={{
                                    background: publishing
                                        ? "rgba(6, 182, 212, 0.1)"
                                        : "linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.15))",
                                    color: "#f87171",
                                    border: "1px solid rgba(6, 182, 212, 0.4)",
                                }}
                            >
                                {publishing ? (
                                    <span className="flex items-center gap-1">
                                        <span className="w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                                        Publishing...
                                    </span>
                                ) : (
                                    "🚀 Publish Now"
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                    onClick={() => setEditing(false)}
                >
                    <div
                        className="glass-card p-6 w-full max-w-lg mx-4 animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold mb-4">✏️ Edit Content</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Hook
                                </label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={editHook}
                                    onChange={(e) => setEditHook(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Caption
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={3}
                                    value={editCaption}
                                    onChange={(e) => setEditCaption(e.target.value)}
                                    style={{ resize: "vertical" }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Post Text
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={4}
                                    value={editPostText}
                                    onChange={(e) => setEditPostText(e.target.value)}
                                    style={{ resize: "vertical" }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 justify-end">
                            <button
                                onClick={() => setEditing(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                style={{
                                    background: "var(--zaytri-surface-2)",
                                    color: "var(--zaytri-text-dim)",
                                    border: "1px solid var(--zaytri-border)",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                style={{
                                    background: "linear-gradient(135deg, #06b6d4, #164e63)",
                                    color: "white",
                                    border: "none",
                                }}
                            >
                                {saving ? "Saving..." : "💾 Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
