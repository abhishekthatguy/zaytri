"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    uploadCalendarCSV,
    uploadCalendarGoogleSheet,
    uploadCalendarJSON,
    listCalendarUploads,
    listCalendarEntries,
    deleteCalendarUpload,
    processCalendarUpload,
    processCalendarEntry,
    getCalendarStats,
    type CalendarUpload,
    type CalendarEntry,
    type CalendarStats,
} from "@/lib/api";

/* ─── Platform metadata ─────────────────────────────────────────────────── */

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
    instagram: { icon: "📸", color: "#E1306C", label: "Instagram" },
    facebook: { icon: "📘", color: "#1877F2", label: "Facebook" },
    twitter: { icon: "𝕏", color: "#1DA1F2", label: "Twitter/X" },
    youtube: { icon: "▶️", color: "#FF0000", label: "YouTube" },
    linkedin: { icon: "💼", color: "#0A66C2", label: "LinkedIn" },
    medium: { icon: "✍️", color: "#00AB6C", label: "Medium" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
    pending: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8", icon: "⏳" },
    queued: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6", icon: "📤" },
    content_generated: { bg: "rgba(6,182,212,0.15)", text: "#06b6d4", icon: "✏️" },
    review_passed: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", icon: "✅" },
    approval_sent: { bg: "rgba(234,179,8,0.15)", text: "#eab308", icon: "📨" },
    approved: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", icon: "👍" },
    rejected: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", icon: "❌" },
    scheduled: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6", icon: "📅" },
    published: { bg: "rgba(139,92,246,0.15)", text: "#8b5cf6", icon: "🚀" },
    failed: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", icon: "⚠️" },
};

const PIPELINE_STAGES = [
    "parsed", "content_creation", "hashtag_generation", "review",
    "approval", "scheduling", "publishing", "engagement", "analytics", "completed",
];

/* ─── Calendar Page ──────────────────────────────────────────────────────── */

export default function CalendarPage() {
    const [activeTab, setActiveTab] = useState<"uploads" | "entries" | "stats">("uploads");
    const [uploads, setUploads] = useState<CalendarUpload[]>([]);
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [stats, setStats] = useState<CalendarStats | null>(null);
    const [totalEntries, setTotalEntries] = useState(0);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<Record<string, boolean>>({});
    const [selectedUpload, setSelectedUpload] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [brandFilter, setBrandFilter] = useState<string>("");
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

    /* ─── Data fetching ───────────────────────────────────────────────────── */

    const fetchUploads = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listCalendarUploads();
            setUploads(data.items);
        } catch {
            setUploads([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listCalendarEntries({
                upload_id: selectedUpload || undefined,
                status: statusFilter || undefined,
                brand: brandFilter || undefined,
                limit: 100,
            });
            setEntries(data.items);
            setTotalEntries(data.total);
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [selectedUpload, statusFilter, brandFilter]);

    const fetchStats = useCallback(async () => {
        try {
            const data = await getCalendarStats();
            setStats(data);
        } catch {
            setStats(null);
        }
    }, []);

    useEffect(() => {
        fetchUploads();
        fetchStats();
    }, [fetchUploads, fetchStats]);

    useEffect(() => {
        if (activeTab === "entries") fetchEntries();
    }, [activeTab, fetchEntries]);

    /* ─── Actions ─────────────────────────────────────────────────────────── */

    const showNotif = (type: "success" | "error", message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleProcess = async (uploadId: string) => {
        setProcessing((p) => ({ ...p, [uploadId]: true }));
        try {
            const result = await processCalendarUpload(uploadId) as { message?: string };
            showNotif("success", result.message || "Processing complete!");
            fetchEntries();
            fetchStats();
        } catch (e: unknown) {
            showNotif("error", e instanceof Error ? e.message : "Processing failed");
        } finally {
            setProcessing((p) => ({ ...p, [uploadId]: false }));
        }
    };

    const handleProcessEntry = async (entryId: string) => {
        setProcessing((p) => ({ ...p, [entryId]: true }));
        try {
            const result = await processCalendarEntry(entryId) as { message?: string };
            showNotif("success", result.message || "Entry processed!");
            fetchEntries();
            fetchStats();
        } catch (e: unknown) {
            showNotif("error", e instanceof Error ? e.message : "Processing failed");
        } finally {
            setProcessing((p) => ({ ...p, [entryId]: false }));
        }
    };

    const handleDelete = async (uploadId: string) => {
        if (!confirm("Delete this upload and all its entries?")) return;
        try {
            await deleteCalendarUpload(uploadId);
            showNotif("success", "Upload deleted");
            fetchUploads();
            fetchEntries();
            fetchStats();
        } catch (e: unknown) {
            showNotif("error", e instanceof Error ? e.message : "Delete failed");
        }
    };

    const handleUploadSuccess = () => {
        setShowUploadModal(false);
        fetchUploads();
        fetchStats();
        showNotif("success", "Calendar uploaded and parsed successfully!");
    };

    /* ─── Extract unique brands from entries ──────────────────────────────── */

    const uniqueBrands = Array.from(new Set(entries.map((e) => e.brand).filter(Boolean) as string[]));

    /* ─── Render ──────────────────────────────────────────────────────────── */

    return (
        <div className="animate-fade-in">
            {/* Notification */}
            {notification && (
                <div
                    className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg animate-fade-in"
                    style={{
                        background: notification.type === "success"
                            ? "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))"
                            : "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
                        border: `1px solid ${notification.type === "success" ? "#22c55e44" : "#ef444444"}`,
                        color: notification.type === "success" ? "#22c55e" : "#ef4444",
                        backdropFilter: "blur(12px)",
                    }}
                >
                    {notification.type === "success" ? "✅ " : "❌ "}{notification.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        📅 Content <span className="gradient-text">Calendar</span>
                    </h1>
                    <p style={{ color: "var(--zaytri-text-dim)" }}>
                        Upload, parse, and process content calendars through the AI pipeline
                    </p>
                </div>
                <button onClick={() => setShowUploadModal(true)} className="btn-primary">
                    + Upload Calendar
                </button>
            </div>

            {/* Stats Summary */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger-children">
                    <StatCard icon="📁" label="Uploads" value={stats.total_uploads} color="#06b6d4" />
                    <StatCard icon="📋" label="Total Entries" value={stats.total_entries} color="#8b5cf6" />
                    <StatCard
                        icon="🏢"
                        label="Brands"
                        value={Object.keys(stats.by_brand).length}
                        color="#f97316"
                    />
                    <StatCard
                        icon="🌐"
                        label="Platforms"
                        value={Object.keys(stats.by_platform).length}
                        color="#ec4899"
                    />
                </div>
            )}

            {/* Tabs */}
            <div
                className="flex gap-1 p-1 rounded-xl mb-6"
                style={{ background: "var(--zaytri-surface)" }}
            >
                {[
                    { key: "uploads" as const, label: "📁 Uploads", count: uploads.length },
                    { key: "entries" as const, label: "📋 Entries", count: totalEntries },
                    { key: "stats" as const, label: "📊 Analytics" },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                        style={{
                            background: activeTab === tab.key
                                ? "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))"
                                : "transparent",
                            color: activeTab === tab.key ? "white" : "var(--zaytri-text-dim)",
                            border: activeTab === tab.key
                                ? "1px solid rgba(6,182,212,0.3)"
                                : "1px solid transparent",
                        }}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span
                                className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Uploads Tab */}
            {activeTab === "uploads" && (
                <div className="space-y-4 stagger-children">
                    {loading ? (
                        <LoadingState message="Loading uploads..." />
                    ) : uploads.length === 0 ? (
                        <EmptyState
                            icon="📁"
                            title="No calendars uploaded"
                            description="Upload a CSV, connect a Google Sheet, or import JSON to get started."
                            action={() => setShowUploadModal(true)}
                            actionLabel="Upload Calendar"
                        />
                    ) : (
                        uploads.map((upload) => (
                            <UploadCard
                                key={upload.id}
                                upload={upload}
                                isProcessing={processing[upload.id] || false}
                                onProcess={() => handleProcess(upload.id)}
                                onDelete={() => handleDelete(upload.id)}
                                onViewEntries={() => {
                                    setSelectedUpload(upload.id);
                                    setActiveTab("entries");
                                }}
                            />
                        ))
                    )}
                </div>
            )}

            {/* Entries Tab */}
            {activeTab === "entries" && (
                <div>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <select
                            value={selectedUpload || ""}
                            onChange={(e) => setSelectedUpload(e.target.value || null)}
                            className="input-field text-sm"
                            style={{ width: "auto", padding: "8px 14px" }}
                        >
                            <option value="">All Uploads</option>
                            {uploads.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field text-sm"
                            style={{ width: "auto", padding: "8px 14px" }}
                        >
                            <option value="">All Statuses</option>
                            {Object.keys(STATUS_STYLES).map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                        <select
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            className="input-field text-sm"
                            style={{ width: "auto", padding: "8px 14px" }}
                        >
                            <option value="">All Brands</option>
                            {uniqueBrands.map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                        <button onClick={fetchEntries} className="btn-secondary text-sm">
                            ↻ Refresh
                        </button>
                    </div>

                    {loading ? (
                        <LoadingState message="Loading entries..." />
                    ) : entries.length === 0 ? (
                        <EmptyState
                            icon="📋"
                            title="No entries found"
                            description="Upload a calendar to see parsed entries here."
                        />
                    ) : (
                        <div className="space-y-3 stagger-children">
                            {entries.map((entry) => (
                                <EntryCard
                                    key={entry.id}
                                    entry={entry}
                                    isProcessing={processing[entry.id] || false}
                                    onProcess={() => handleProcessEntry(entry.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Stats Tab */}
            {activeTab === "stats" && (
                <CalendarAnalytics stats={stats} />
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <UploadModal
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={handleUploadSuccess}
                />
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Sub-components                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
    return (
        <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: `${color}22`, color }}
                >
                    Live
                </span>
            </div>
            <p className="text-2xl font-bold mb-1">{value}</p>
            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>{label}</p>
        </div>
    );
}

/* ─── Upload Card ────────────────────────────────────────────────────────── */

function UploadCard({
    upload,
    isProcessing,
    onProcess,
    onDelete,
    onViewEntries,
}: {
    upload: CalendarUpload;
    isProcessing: boolean;
    onProcess: () => void;
    onDelete: () => void;
    onViewEntries: () => void;
}) {
    const sourceIcons: Record<string, string> = {
        csv_file: "📄",
        google_sheet: "📊",
        google_doc: "📝",
        json_file: "📋",
        manual: "✍️",
    };

    return (
        <div
            className="p-6 rounded-xl transition-all duration-300 hover:border-opacity-50 group"
            style={{
                background: "var(--zaytri-surface)",
                border: "1px solid var(--zaytri-border)",
            }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{sourceIcons[upload.source_type] || "📁"}</span>
                        <div>
                            <h3 className="text-base font-semibold">{upload.name}</h3>
                            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                {upload.source_type.replace(/_/g, " ")} •{" "}
                                {new Date(upload.created_at).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Row counts */}
                    <div className="flex gap-4 mt-3">
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs font-medium px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}
                            >
                                {upload.parsed_rows} parsed
                            </span>
                        </div>
                        {upload.failed_rows > 0 && (
                            <div className="flex items-center gap-2">
                                <span
                                    className="text-xs font-medium px-2.5 py-1 rounded-lg"
                                    style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                                >
                                    {upload.failed_rows} failed
                                </span>
                            </div>
                        )}
                        <span
                            className="text-xs font-medium px-2.5 py-1 rounded-lg"
                            style={{
                                background: upload.is_processed ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                                color: upload.is_processed ? "#22c55e" : "#eab308",
                            }}
                        >
                            {upload.is_processed ? "✓ Processed" : "⏳ Ready"}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={onViewEntries}
                        className="btn-secondary text-xs"
                        style={{ padding: "8px 14px" }}
                    >
                        👁️ View Entries
                    </button>
                    <button
                        onClick={onProcess}
                        disabled={isProcessing}
                        className="btn-primary text-xs"
                        style={{
                            padding: "8px 14px",
                            opacity: isProcessing ? 0.6 : 1,
                        }}
                    >
                        {isProcessing ? "⏳ Processing..." : "▶️ Process All"}
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 rounded-lg text-xs transition-all duration-200"
                        style={{
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            color: "#ef4444",
                        }}
                        title="Delete"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Entry Card ─────────────────────────────────────────────────────────── */

function EntryCard({
    entry,
    isProcessing,
    onProcess,
}: {
    entry: CalendarEntry;
    isProcessing: boolean;
    onProcess: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const style = STATUS_STYLES[entry.status] || STATUS_STYLES.pending;

    // Pipeline progress
    const currentStageIndex = PIPELINE_STAGES.indexOf(entry.pipeline_stage);
    const progress = Math.max(0, ((currentStageIndex + 1) / PIPELINE_STAGES.length) * 100);

    return (
        <div
            className="rounded-xl transition-all duration-300 overflow-hidden"
            style={{
                background: "var(--zaytri-surface)",
                border: "1px solid var(--zaytri-border)",
            }}
        >
            {/* Main row */}
            <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Row number */}
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "var(--zaytri-surface-2)", color: "var(--zaytri-text-dim)" }}
                >
                    {entry.row_number || "–"}
                </div>

                {/* Date */}
                <div className="w-24 shrink-0">
                    <p className="text-xs font-medium">{entry.date || "—"}</p>
                </div>

                {/* Brand */}
                <div className="w-32 shrink-0">
                    <span
                        className="text-xs font-medium px-2 py-1 rounded-md"
                        style={{ background: "var(--zaytri-surface-2)" }}
                    >
                        {entry.brand || "—"}
                    </span>
                </div>

                {/* Topic */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.topic}</p>
                    {entry.content_type && (
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--zaytri-text-dim)" }}>
                            {entry.content_type}
                        </p>
                    )}
                </div>

                {/* Platforms */}
                <div className="flex gap-1 shrink-0">
                    {(entry.platforms || []).map((p) => {
                        const meta = PLATFORM_META[p] || { icon: "🌐", color: "#94a3b8", label: p };
                        return (
                            <span
                                key={p}
                                className="text-sm"
                                title={meta.label}
                                style={{ filter: "drop-shadow(0 0 4px " + meta.color + "44)" }}
                            >
                                {meta.icon}
                            </span>
                        );
                    })}
                </div>

                {/* Approval badge */}
                {entry.approval_required && (
                    <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: "rgba(234,179,8,0.15)", color: "#eab308" }}
                    >
                        🔒 Approval
                    </span>
                )}

                {/* Status */}
                <span
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase shrink-0"
                    style={{ background: style.bg, color: style.text }}
                >
                    {style.icon} {entry.status.replace(/_/g, " ")}
                </span>

                {/* Process button */}
                {entry.status === "pending" && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onProcess(); }}
                        disabled={isProcessing}
                        className="btn-primary text-[10px] shrink-0"
                        style={{ padding: "6px 12px", opacity: isProcessing ? 0.6 : 1 }}
                    >
                        {isProcessing ? "⏳" : "▶️"}
                    </button>
                )}

                <span
                    className="text-xs transition-transform duration-200 shrink-0"
                    style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                    ▾
                </span>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div
                    className="px-4 pb-4 pt-2 border-t animate-fade-in"
                    style={{ borderColor: "var(--zaytri-border)" }}
                >
                    {/* Pipeline progress */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium">Pipeline Progress</p>
                            <p className="text-[10px]" style={{ color: "var(--zaytri-text-dim)" }}>
                                Stage: {entry.pipeline_stage.replace(/_/g, " ")}
                            </p>
                        </div>
                        <div
                            className="w-full h-2 rounded-full overflow-hidden"
                            style={{ background: "var(--zaytri-surface-2)" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${progress}%`,
                                    background: entry.status === "failed"
                                        ? "#ef4444"
                                        : "linear-gradient(90deg, #06b6d4, #8b5cf6)",
                                }}
                            />
                        </div>
                        {/* Stage dots */}
                        <div className="flex justify-between mt-2">
                            {PIPELINE_STAGES.map((stage, i) => (
                                <div
                                    key={stage}
                                    className="flex flex-col items-center"
                                    title={stage.replace(/_/g, " ")}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full transition-all duration-300"
                                        style={{
                                            background: i <= currentStageIndex
                                                ? (entry.status === "failed" && i === currentStageIndex ? "#ef4444" : "#22c55e")
                                                : "var(--zaytri-surface-2)",
                                            boxShadow: i <= currentStageIndex
                                                ? "0 0 6px rgba(34,197,94,0.4)"
                                                : "none",
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <DetailItem label="Content Type" value={entry.content_type} />
                        <DetailItem label="Tone" value={entry.tone} />
                        <DetailItem
                            label="Default Hashtags"
                            value={(entry.default_hashtags || []).join(" ")}
                        />
                        <DetailItem
                            label="Generated Hashtags"
                            value={(entry.generated_hashtags || []).join(" ")}
                        />
                    </div>

                    {/* Content IDs */}
                    {entry.content_ids && entry.content_ids.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-medium mb-1">Generated Content IDs:</p>
                            <div className="flex flex-wrap gap-2">
                                {entry.content_ids.map((id) => (
                                    <span
                                        key={id}
                                        className="text-[10px] font-mono px-2 py-1 rounded-md"
                                        style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}
                                    >
                                        {id.slice(0, 8)}…
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Errors */}
                    {entry.pipeline_errors && entry.pipeline_errors.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)" }}>
                            <p className="text-xs font-medium mb-1" style={{ color: "#ef4444" }}>Pipeline Errors:</p>
                            {entry.pipeline_errors.map((err, i) => (
                                <p key={i} className="text-[10px] font-mono" style={{ color: "#ef444499" }}>
                                    {err}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── Detail Item ────────────────────────────────────────────────────────── */

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <p className="text-[10px] font-medium uppercase mb-1" style={{ color: "var(--zaytri-text-dim)" }}>
                {label}
            </p>
            <p className="text-xs">{value || "—"}</p>
        </div>
    );
}

/* ─── Loading / Empty State ──────────────────────────────────────────────── */

function LoadingState({ message }: { message: string }) {
    return (
        <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4"
                style={{ borderColor: "var(--zaytri-primary)", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>{message}</p>
        </div>
    );
}

function EmptyState({
    icon,
    title,
    description,
    action,
    actionLabel,
}: {
    icon: string;
    title: string;
    description: string;
    action?: () => void;
    actionLabel?: string;
}) {
    return (
        <div
            className="text-center py-16 rounded-xl"
            style={{ background: "var(--zaytri-surface)", border: "1px dashed var(--zaytri-border)" }}
        >
            <p className="text-5xl mb-4">{icon}</p>
            <p className="text-lg font-semibold mb-2">{title}</p>
            <p className="text-sm mb-6" style={{ color: "var(--zaytri-text-dim)" }}>{description}</p>
            {action && (
                <button onClick={action} className="btn-primary">{actionLabel}</button>
            )}
        </div>
    );
}

/* ─── Upload Modal ───────────────────────────────────────────────────────── */

function UploadModal({
    onClose,
    onSuccess,
}: {
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [uploadType, setUploadType] = useState<"csv" | "google_sheet" | "json">("csv");
    const [sheetUrl, setSheetUrl] = useState("");
    const [calendarName, setCalendarName] = useState("");
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError("");

        try {
            if (uploadType === "csv") {
                await uploadCalendarCSV(file, calendarName || file.name);
            } else {
                await uploadCalendarJSON(file, calendarName || file.name);
            }
            onSuccess();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleGoogleSheet = async () => {
        if (!sheetUrl.trim()) {
            setError("Please enter a Google Sheet URL");
            return;
        }

        setUploading(true);
        setError("");

        try {
            await uploadCalendarGoogleSheet(sheetUrl, calendarName || "Google Sheet Import");
            onSuccess();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Import failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-2xl p-6 animate-fade-in"
                style={{
                    background: "linear-gradient(180deg, #16161e 0%, #12121a 100%)",
                    border: "1px solid var(--zaytri-border)",
                    boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">📅 Upload Calendar</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "var(--zaytri-surface-2)" }}
                    >
                        ✕
                    </button>
                </div>

                {/* Calendar name */}
                <div className="mb-4">
                    <label className="text-xs font-medium mb-2 block" style={{ color: "var(--zaytri-text-dim)" }}>
                        Calendar Name (optional)
                    </label>
                    <input
                        type="text"
                        value={calendarName}
                        onChange={(e) => setCalendarName(e.target.value)}
                        className="input-field"
                        placeholder="e.g. March 2026 Content Plan"
                    />
                </div>

                {/* Source type selector */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: "csv" as const, label: "📄 CSV File", desc: "Upload .csv" },
                        { key: "google_sheet" as const, label: "📊 Google Sheet", desc: "Paste URL" },
                        { key: "json" as const, label: "📋 JSON File", desc: "Upload .json" },
                    ].map((type) => (
                        <button
                            key={type.key}
                            onClick={() => setUploadType(type.key)}
                            className="flex-1 p-4 rounded-xl text-center transition-all duration-200"
                            style={{
                                background: uploadType === type.key
                                    ? "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))"
                                    : "var(--zaytri-surface)",
                                border: uploadType === type.key
                                    ? "1px solid rgba(6,182,212,0.3)"
                                    : "1px solid var(--zaytri-border)",
                            }}
                        >
                            <p className="text-sm font-medium">{type.label}</p>
                            <p className="text-[10px] mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                                {type.desc}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Upload area */}
                {uploadType === "google_sheet" ? (
                    <div>
                        <label className="text-xs font-medium mb-2 block" style={{ color: "var(--zaytri-text-dim)" }}>
                            Google Sheet URL
                        </label>
                        <input
                            type="url"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            className="input-field mb-4"
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                        />
                        <button
                            onClick={handleGoogleSheet}
                            disabled={uploading}
                            className="btn-primary w-full"
                            style={{ opacity: uploading ? 0.6 : 1 }}
                        >
                            {uploading ? "⏳ Importing..." : "📥 Import Google Sheet"}
                        </button>
                    </div>
                ) : (
                    <div>
                        <div
                            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 hover:border-opacity-60 mb-4"
                            style={{
                                borderColor: "var(--zaytri-border)",
                                background: "var(--zaytri-surface)",
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <p className="text-4xl mb-3">{uploadType === "csv" ? "📄" : "📋"}</p>
                            <p className="text-sm font-medium mb-1">
                                Click to upload {uploadType === "csv" ? ".csv" : ".json"} file
                            </p>
                            <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                                or drag and drop
                            </p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={uploadType === "csv" ? ".csv,.tsv" : ".json,.jsonl"}
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div
                        className="mt-4 p-3 rounded-lg text-sm"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                    >
                        ❌ {error}
                    </div>
                )}

                {/* Help text */}
                <div className="mt-6 p-4 rounded-xl" style={{ background: "var(--zaytri-surface-2)" }}>
                    <p className="text-xs font-medium mb-2">📖 Expected Columns:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {["Date", "Brand", "Content_Type", "Topic", "Platforms", "Approval_Required", "Status", "Hashtags"].map((col) => (
                            <span
                                key={col}
                                className="text-[10px] font-mono px-2 py-0.5 rounded"
                                style={{ background: "var(--zaytri-surface)", border: "1px solid var(--zaytri-border)" }}
                            >
                                {col}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Calendar Analytics ─────────────────────────────────────────────────── */

function CalendarAnalytics({ stats }: { stats: CalendarStats | null }) {
    if (!stats) {
        return <LoadingState message="Loading analytics..." />;
    }

    const statusEntries = Object.entries(stats.by_status);
    const brandEntries = Object.entries(stats.by_brand);
    const platformEntries = Object.entries(stats.by_platform);

    const totalByStatus = statusEntries.reduce((sum, [, count]) => sum + count, 0) || 1;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
            {/* Status Distribution */}
            <div className="glass-card p-6">
                <h3 className="text-base font-bold mb-4">📊 Status Distribution</h3>
                {statusEntries.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>No data yet</p>
                ) : (
                    <div className="space-y-3">
                        {statusEntries.map(([status, count]) => {
                            const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
                            const pct = Math.round((count / totalByStatus) * 100);
                            return (
                                <div key={status}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-medium capitalize">
                                            {style.icon} {status.replace(/_/g, " ")}
                                        </span>
                                        <span className="text-xs" style={{ color: style.text }}>
                                            {count} ({pct}%)
                                        </span>
                                    </div>
                                    <div
                                        className="h-2 rounded-full overflow-hidden"
                                        style={{ background: "var(--zaytri-surface-2)" }}
                                    >
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%`, background: style.text }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Brand Distribution */}
            <div className="glass-card p-6">
                <h3 className="text-base font-bold mb-4">🏢 Brand Distribution</h3>
                {brandEntries.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>No data yet</p>
                ) : (
                    <div className="space-y-3">
                        {brandEntries.map(([brand, count]) => (
                            <div
                                key={brand}
                                className="flex items-center justify-between p-3 rounded-xl"
                                style={{ background: "var(--zaytri-surface)" }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                                        style={{
                                            background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))",
                                        }}
                                    >
                                        {brand[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium">{brand}</span>
                                </div>
                                <span
                                    className="text-xs font-semibold px-3 py-1 rounded-full"
                                    style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}
                                >
                                    {count} entries
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Platform Distribution */}
            <div className="glass-card p-6 lg:col-span-2">
                <h3 className="text-base font-bold mb-4">🌐 Platform Distribution</h3>
                {platformEntries.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>No data yet</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {platformEntries.map(([platform, count]) => {
                            const meta = PLATFORM_META[platform] || { icon: "🌐", color: "#94a3b8", label: platform };
                            return (
                                <div
                                    key={platform}
                                    className="p-4 rounded-xl text-center"
                                    style={{
                                        background: `${meta.color}11`,
                                        border: `1px solid ${meta.color}33`,
                                    }}
                                >
                                    <span className="text-2xl block mb-2">{meta.icon}</span>
                                    <p className="text-sm font-semibold" style={{ color: meta.color }}>
                                        {count}
                                    </p>
                                    <p className="text-[10px] mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                                        {meta.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
