"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Edit2, Trash2, CheckCircle2, Rocket, RotateCcw, Info, MoreVertical } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

interface ContentCardProps {
    id: string;
    topic: string;
    platform: string;
    brand?: string; // Newly added
    caption: string;
    hook: string;
    post_text?: string;
    improved_text?: string;
    status: string;
    score: number | null;
    createdAt: string;
    scheduledAt?: string;
    deletedAt?: string;
    metadata?: Record<string, any>; // Used for Metadata Drawer mock
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onEdit?: (id: string, data: Record<string, string>) => void;
    onPublishNow?: (id: string) => void;
    onDelete?: (id: string) => void;
    onRetry?: (id: string) => void;
}

const PLATFORM_ICONS: Record<string, string> = {
    instagram: "📸",
    facebook: "👤",
    twitter: "🐦",
    youtube: "▶️",
    linkedin: "💼"
};

export default function ContentCard({
    id, topic, platform, brand = "Zaytri", caption, hook, post_text, improved_text,
    status, score, createdAt, scheduledAt, deletedAt, metadata = {},
    onApprove, onReject, onEdit, onPublishNow, onDelete, onRetry
}: ContentCardProps) {
    const [editing, setEditing] = useState(false);
    const [editCaption, setEditCaption] = useState(caption);
    const [editHook, setEditHook] = useState(hook);
    const [editPostText, setEditPostText] = useState(post_text || "");
    const [saving, setSaving] = useState(false);

    const platformIcon = PLATFORM_ICONS[platform] || "🌐";

    // Derived UI states
    const isEditable = status === "draft" || status === "reviewed" || status === "failed";
    const isPublishable = status === "approved";
    const isFailed = status === "failed";
    const isWaiting = status === "waiting_approval" || status === "reviewed"; // mock waiting

    // Rule: content body empty & topic exists
    const isEmptyGenerate = (!caption && !post_text && !!topic);

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

    return (
        <>
            <div className={cn(
                "group relative bg-[#161a29] border border-[#1e293b] rounded-2xl p-4 transition-all duration-300 hover:border-[#06b6d4]/30 hover:shadow-[0_4px_30px_rgba(6,182,212,0.05)] focus-within:ring-2 focus-within:ring-[#06b6d4]/50 overflow-hidden",
                status === "deleted" ? "opacity-60 grayscale-[30%]" : ""
            )}>
                {/* Header Row: Platform Icon, Brand, Status Badge, Actions */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0f111a] flex items-center justify-center text-lg border border-[#1e293b] shadow-sm shadow-black/20">
                            {platformIcon}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white tracking-wide">{brand}</span>
                            <StatusBadge status={status} />

                            {/* Conditional Badge for Empty */}
                            {isEmptyGenerate && (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#eab308]/10 text-[#eab308] tracking-wider uppercase">
                                    <span className="text-[12px]">⚠️</span> Topic Only <span>• Content Not Generated</span>
                                </span>
                            )}

                            {/* Conditional Tooltip for waiting approval */}
                            {isWaiting && (
                                <TooltipProvider>
                                    <div className="flex items-center text-xs text-yellow-400 opacity-80 cursor-help" title="Pending approval via WhatsApp/Email">
                                        ⏳ Sent
                                    </div>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>

                    {/* Compact Icon Actions (right aligned) - Hide mostly if deleted */}
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">

                        {isEditable && onEdit && !isEmptyGenerate && (
                            <IconButton icon={Edit2} tooltip="Edit content" onClick={() => setEditing(true)} />
                        )}

                        {isPublishable && onPublishNow && (
                            <IconButton icon={Rocket} variant="primary" tooltip="Publish immediately" onClick={() => onPublishNow(id)} />
                        )}

                        {isEditable && onApprove && (
                            <IconButton icon={CheckCircle2} variant="success" tooltip="Approve for publishing" onClick={() => onApprove(id)} />
                        )}

                        {isFailed && onRetry && (
                            <IconButton icon={RotateCcw} variant="primary" tooltip="Retry failed publishing" onClick={() => onRetry(id)} />
                        )}

                        {onDelete && status !== "deleted" && (
                            <IconButton icon={Trash2} variant="danger" tooltip="Delete permanently" onClick={() => onDelete(id)} />
                        )}

                        {/* Metadata Info Popover */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <IconButton icon={Info} tooltip="View detailed metadata" />
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 p-3 bg-[#0f111a] border border-[#1e293b] rounded-xl text-xs space-y-2 text-[#94a3b8]">
                                <div className="flex items-center gap-2 pb-2 border-b border-[#1e293b] mb-2">
                                    <Info size={14} className="text-[#06b6d4]" />
                                    <span className="font-semibold text-white">Advanced Metadata</span>
                                </div>
                                <div className="flex justify-between"><span>Model Used:</span> <span className="text-white">{metadata.model || "GPT-4o"}</span></div>
                                <div className="flex justify-between"><span>Token Count:</span> <span className="text-white">{metadata.tokens || Math.floor(Math.random() * 800) + 200}</span></div>
                                <div className="flex justify-between"><span>Est. Cost:</span> <span className="text-white">${metadata.cost || "0.02"}</span></div>
                                <div className="flex justify-between"><span>Retry Count:</span> <span className="text-white">{metadata.retries || 0}</span></div>
                                <div className="flex justify-between"><span>Creation Date:</span> <span className="text-white">{new Date(createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                                <div className="flex justify-between"><span>Approval via:</span> <span className="text-white">{isWaiting ? "WhatsApp" : "Auto"}</span></div>
                                <div className="flex justify-between"><span>Brand Tone:</span> <span className="text-white">{metadata.tone || "Professional"}</span></div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Content Preview (Minimal) */}
                <div className="mt-1 mb-4 flex-1">
                    <h3 className="text-sm font-bold text-[#f1f5f9] mb-1 line-clamp-1">
                        {topic || "Untitled Post"}
                    </h3>
                    {!isEmptyGenerate && (
                        <p className="text-xs text-[#94a3b8] line-clamp-2 leading-relaxed">
                            {caption || hook || post_text || "No preview available..."}
                        </p>
                    )}
                </div>

                {/* Footer Dates */}
                <div className="flex items-center gap-3 pt-3 border-t border-[#1e293b] text-[11px] font-medium text-[#64748b]">
                    {scheduledAt ? (
                        <div className="flex items-center gap-1.5 bg-[#1e293b]/50 px-2 py-1 rounded">
                            <span className="text-[#c084fc]">🗓</span>
                            <span>{new Date(scheduledAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <span className="opacity-70">Created:</span>
                            <span>{new Date(createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    )}

                    {/* Trash Timer Component */}
                    {status === "deleted" && deletedAt && (
                        <div className="ml-auto flex items-center gap-1 font-bold text-[#fb7185]/80 bg-[#f43f5e]/10 px-2 py-0.5 rounded-full uppercase text-[9px] tracking-wider">
                            <span>Moving to trash in {Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)))}d</span>
                        </div>
                    )}
                </div>

                {/* Optional generate banner at bottom if completely empty */}
                {isEmptyGenerate && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#161a29] to-transparent h-20 pointer-events-none flex items-end justify-center pb-3">
                        <button className="pointer-events-auto bg-[#0f111a] border border-[#1e293b] text-[#06b6d4] text-[11px] font-bold tracking-wide uppercase px-4 py-1.5 rounded-full shadow-lg hover:border-[#06b6d4]/50 transition-colors">
                            Generate Now
                        </button>
                    </div>
                )}
            </div>

            {/* Edit Modal (unchanged except using Tailwind colors for dialog) */}
            {editing && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setEditing(false)}
                >
                    <div
                        className="bg-[#0f111a] border border-[#1e293b] shadow-2xl rounded-2xl p-6 w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold mb-4 text-white">✏️ Edit Content</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold mb-1 block text-[#94a3b8]">
                                    Hook
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-[#161a29] text-sm text-[#f1f5f9] border border-[#1e293b] rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors"
                                    value={editHook}
                                    onChange={(e) => setEditHook(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold mb-1 block text-[#94a3b8]">
                                    Caption (Markdown Supported)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <textarea
                                        className="w-full bg-[#161a29] text-sm text-[#f1f5f9] border border-[#1e293b] rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors resize-y h-40"
                                        value={editCaption}
                                        onChange={(e) => setEditCaption(e.target.value)}
                                    />
                                    <div className="overflow-auto bg-black/40 border border-[#1e293b] rounded-lg text-xs prose prose-invert prose-p:my-1 p-3 h-40">
                                        <ReactMarkdown>{editCaption || "*Preview*"}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold mb-1 block text-[#94a3b8]">
                                    Post Text
                                </label>
                                <textarea
                                    className="w-full bg-[#161a29] text-sm text-[#f1f5f9] border border-[#1e293b] rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors resize-y"
                                    rows={4}
                                    value={editPostText}
                                    onChange={(e) => setEditPostText(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 justify-end">
                            <button
                                onClick={() => setEditing(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#161a29] text-[#94a3b8] border border-[#1e293b] hover:bg-[#1e293b] hover:text-white cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#06b6d4] hover:bg-[#22d3ee] text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
