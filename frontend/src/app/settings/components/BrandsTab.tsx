"use client";

import { useState, useEffect, useCallback } from "react";
import {
    getGoogleDriveConfig,
    listBrands,
    updateBrand,
    createBrand,
    deleteBrand,
    disconnectGoogleDrive,
    type GoogleDriveConfig,
    type BrandSettings,
    type KnowledgeSource,
    listKnowledgeSources,
    createKnowledgeSource,
    updateKnowledgeSource,
    deleteKnowledgeSource
} from "@/lib/api";
import Section from "./shared/Section";
import StatusBadge from "./shared/StatusBadge";
import Tooltip from "./shared/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { Trash2, Settings2, ExternalLink, FileText, Globe, Folder, Database, LayoutGrid, List } from "lucide-react";

interface BrandsTabProps {
    onToast: (msg: string, t: "success" | "error") => void;
}

const SUB_TABS = [
    { id: "profiles", label: "Profiles", icon: "👤" },
    { id: "knowledge", label: "Knowledge Sources", icon: "🧠" },
    { id: "calendar", label: "Calendar Sources", icon: "📅" },
];

export default function BrandsTab({ onToast }: BrandsTabProps) {
    const [activeSubTab, setActiveSubTab] = useState("profiles");
    const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [brands, setBrands] = useState<BrandSettings[]>([]);
    const [editingBrand, setEditingBrand] = useState<Partial<BrandSettings> | null>(null);
    const [saving, setSaving] = useState(false);

    // Knowledge Sources State
    const [selectedBrandId, setSelectedBrandId] = useState<string>("all");
    const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
    const [isAddingSource, setIsAddingSource] = useState(false);
    const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
    const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
    const [isSubmittingSource, setIsSubmittingSource] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Initial source form state
    const [sourceForm, setSourceForm] = useState({
        name: "",
        source_type: "website",
        url: "",
        content_summary: "",
        brand_id: ""
    });

    const fetchBrands = useCallback(async () => {
        try {
            const bList = await listBrands();
            setBrands(bList);
        } catch (err) {
            console.error("Failed to load brands", err);
            onToast("Failed to load brand data", "error");
        }
    }, [onToast]);

    const fetchGoogleDrive = useCallback(async () => {
        try {
            const drive = await getGoogleDriveConfig();
            setDriveConfig(drive);
        } catch (err) {
            console.error("Failed to load Google Drive config", err);
            onToast("Failed to load Google Drive config", "error");
        }
    }, [onToast]);

    const fetchKnowledgeSources = useCallback(async () => {
        try {
            const sources = await listKnowledgeSources(selectedBrandId === "all" ? undefined : selectedBrandId);
            setKnowledgeSources(sources);
        } catch (err) {
            onToast("Failed to fetch knowledge sources", "error");
        }
    }, [selectedBrandId, onToast]);


    // Initial load for Brands and Drive
    useEffect(() => {
        setLoading(true);
        Promise.all([fetchBrands(), fetchGoogleDrive()])
            .finally(() => setLoading(false));
    }, [fetchBrands, fetchGoogleDrive]);

    // Independent fetch for knowledge sources
    useEffect(() => {
        if (activeSubTab === "knowledge") {
            fetchKnowledgeSources();
        }
    }, [activeSubTab, fetchKnowledgeSources, selectedBrandId]);

    const handleEdit = (e: React.MouseEvent, brand: BrandSettings) => {
        e.stopPropagation();
        setEditingBrand({ ...brand });
    };

    const handleCreateNew = () => {
        setEditingBrand({
            brand_name: "",
            target_audience: "",
            brand_tone: "professional",
            brand_guidelines: "",
            core_values: "",
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBrand || !editingBrand.brand_name) return;
        setSaving(true);
        try {
            if (editingBrand.id) {
                const updated = await updateBrand(editingBrand.id, editingBrand);
                setBrands(brands.map(b => b.id === updated.id ? updated : b));
                onToast("Brand profile updated", "success");
            } else {
                const created = await createBrand(editingBrand);
                setBrands([...brands, created]);
                onToast("New brand created", "success");
            }
            setEditingBrand(null);
        } catch (err) {
            onToast(err instanceof Error ? err.message : "Save failed", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDialog({
            isOpen: true,
            title: "Delete Brand Profile",
            message: "Are you sure you want to delete this brand profile? This will not delete its associated knowledge sources.",
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await deleteBrand(id);
                    setBrands(prev => prev.filter(b => b.id !== id));
                    onToast("Brand deleted", "success");
                } catch {
                    onToast("Delete failed", "error");
                }
            }
        });
    };

    const handleAddSource = async () => {
        if (!sourceForm.name) {
            onToast("Source Name is required", "error");
            return;
        }
        setIsSubmittingSource(true);
        try {
            // Normalize brand_id: empty string -> null
            const payload = {
                ...sourceForm,
                brand_id: sourceForm.brand_id === "" ? null : sourceForm.brand_id
            };

            if (editingSource) {
                const updatedSource = await updateKnowledgeSource(editingSource.id, payload);
                setKnowledgeSources(prev => prev.map(s => s.id === updatedSource.id ? updatedSource : s));
                onToast("Knowledge source updated", "success");
            } else {
                const newSource = await createKnowledgeSource(payload);
                setKnowledgeSources(prev => [...prev, newSource]);
                onToast("Knowledge source created", "success");
            }
            setIsAddingSource(false);
            setEditingSource(null);
            setSourceForm({ name: "", source_type: "website", url: "", content_summary: "", brand_id: "" });
        } catch (err) {
            onToast(err instanceof Error ? err.message : "Failed to save knowledge source", "error");
        } finally {
            setIsSubmittingSource(false);
        }
    };

    const handleDisconnectDrive = async () => {
        setConfirmDialog({
            isOpen: true,
            title: "Disconnect Google Drive",
            message: "Are you sure you want to disconnect Google Drive? This will stop all automated syncing.",
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await disconnectGoogleDrive();
                    setDriveConfig(null);
                    onToast("Google Drive disconnected", "success");
                } catch (err) {
                    onToast(err instanceof Error ? err.message : "Disconnect failed", "error");
                }
            }
        });
    };

    const handleDeleteSource = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDialog({
            isOpen: true,
            title: "Delete Knowledge Source",
            message: "Are you sure you want to delete this knowledge source? This will permanently remove its vectors.",
            onConfirm: async () => {
                setConfirmDialog(null);
                setDeletingIds(prev => new Set(prev).add(id));
                try {
                    await deleteKnowledgeSource(id);
                    setKnowledgeSources(prev => prev.filter(s => s.id !== id));
                    onToast("Knowledge source deleted", "success");
                } catch (err) {
                    onToast(err instanceof Error ? err.message : "Failed to delete knowledge source", "error");
                } finally {
                    setDeletingIds(prev => {
                        const updated = new Set(prev);
                        updated.delete(id);
                        return updated;
                    });
                }
            }
        });
    };

    if (loading && brands.length === 0) {
        return <div className="animate-pulse text-slate-400">Loading Brands...</div>;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
            {/* Vertical Sub-navigation */}
            <div className="w-full lg:w-64 flex flex-col gap-2">
                {SUB_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSubTab === tab.id
                            ? 'bg-white/10 text-white border border-white/10 shadow-lg'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <span>{tab.icon}</span>
                        <span className="text-sm font-semibold">{tab.label}</span>
                    </button>
                ))}

                <div className="mt-8 p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/10">
                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                        <span className="text-lg">📁</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Google Drive</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3">Integrate Drive as a brand knowledge source.</p>
                    <button className="w-full py-1 text-[10px] font-bold bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                        Manage Connection
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
                {activeSubTab === "profiles" && (
                    <Section title="Brand Profiles" icon="👤" description="Define brand identity and tone of voice">
                        {editingBrand ? (
                            <form onSubmit={handleSave} className="space-y-6 animate-fade-in p-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Brand Name</label>
                                        <input
                                            className="input-field"
                                            value={editingBrand.brand_name || ""}
                                            onChange={e => setEditingBrand({ ...editingBrand, brand_name: e.target.value })}
                                            placeholder="e.g. CorpEdge"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Brand Tone</label>
                                        <input
                                            className="input-field"
                                            value={editingBrand.brand_tone || ""}
                                            onChange={e => setEditingBrand({ ...editingBrand, brand_tone: e.target.value })}
                                            placeholder="e.g. professional, energetic"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Target Audience</label>
                                        <textarea
                                            className="input-field min-h-[80px]"
                                            value={editingBrand.target_audience || ""}
                                            onChange={e => setEditingBrand({ ...editingBrand, target_audience: e.target.value })}
                                            placeholder="Who are you speaking to?"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Brand Guidelines</label>
                                        <textarea
                                            className="input-field min-h-[100px]"
                                            value={editingBrand.brand_guidelines || ""}
                                            onChange={e => setEditingBrand({ ...editingBrand, brand_guidelines: e.target.value })}
                                            placeholder="Rules, 'do not say' list, style requirements..."
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Core Values</label>
                                        <textarea
                                            className="input-field min-h-[80px]"
                                            value={editingBrand.core_values || ""}
                                            onChange={e => setEditingBrand({ ...editingBrand, core_values: e.target.value })}
                                            placeholder="Mission, vision, and values..."
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditingBrand(null)}
                                        className="btn-secondary px-6"
                                    > Cancel </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="btn-primary px-10"
                                    > {saving ? "Saving..." : "Save Profile"} </button>
                                </div>
                            </form>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {brands.map(brand => (
                                    <div key={brand.id} className="p-5 rounded-2xl border border-white/5 bg-white/5 flex flex-col group hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-white text-lg">{brand.brand_name}</h4>
                                            <div className="flex gap-2">
                                                <IconButton
                                                    icon={Trash2}
                                                    variant="danger"
                                                    tooltip="Delete Brand"
                                                    aria-label="Delete Brand"
                                                    onClick={(e) => handleDelete(e, brand.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                />
                                                <button onClick={(e) => handleEdit(e, brand)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all text-[10px] font-bold border border-white/10">Edit Profile</button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4">{brand.brand_tone || "Default Tone"}</p>
                                        {brand.target_audience && (
                                            <p className="text-[10px] text-slate-500 line-clamp-2 italic">"{brand.target_audience}"</p>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={handleCreateNew}
                                    className="p-5 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:border-cyan-500/30 hover:text-white transition-all group min-h-[140px]"
                                >
                                    <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">➕</span>
                                    <span className="text-xs font-bold uppercase tracking-wider">Add New Brand</span>
                                </button>
                            </div>
                        )}
                    </Section>
                )}

                {activeSubTab === "knowledge" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                            <div className="flex flex-wrap items-center gap-4">
                                <h2 className="text-2xl font-bold text-white">Knowledge Sources</h2>
                                <select
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50 transition-colors cursor-pointer hover:bg-white/10"
                                    value={selectedBrandId}
                                    onChange={(e) => setSelectedBrandId(e.target.value)}
                                >
                                    <option value="all" className="bg-[#0f111a]">All Brands</option>
                                    {brands.map(b => (
                                        <option key={b.id} value={b.id} className="bg-[#0f111a]">{b.brand_name}</option>
                                    ))}
                                </select>
                                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 ml-2">
                                    <button
                                        onClick={() => setViewMode("grid")}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white/10 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
                                        title="Grid View"
                                    >
                                        <LayoutGrid size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white/10 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
                                        title="List View"
                                    >
                                        <List size={16} />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingSource(null);
                                    setSourceForm({ name: "", source_type: "website", url: "", content_summary: "", brand_id: selectedBrandId === "all" ? "" : selectedBrandId });
                                    setIsAddingSource(true);
                                }}
                                className="btn-primary py-2 px-6 text-xs font-bold w-full sm:w-auto flex items-center justify-center gap-2"
                            >
                                <span className="text-lg">+</span> Add Source
                            </button>
                        </div>

                        {isAddingSource && (
                            <div className="glass-card p-6 border-cyan-500/20 mb-8 animate-in zoom-in-95 duration-200">
                                <h3 className="text-lg font-bold text-white mb-4">{editingSource ? 'Edit Knowledge Source' : 'Add New Knowledge Source'}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source Name *</label>
                                        <input
                                            type="text"
                                            value={sourceForm.name}
                                            onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                                            placeholder="e.g. Corporate Website"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source Type</label>
                                        <select
                                            value={sourceForm.source_type}
                                            onChange={(e) => setSourceForm({ ...sourceForm, source_type: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                                        >
                                            <option value="website" className="bg-slate-900">Website</option>
                                            <option value="pdf" className="bg-slate-900">PDF Document</option>
                                            <option value="drive" className="bg-slate-900">Google Drive</option>
                                            <option value="doc" className="bg-slate-900">Text/Doc</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">URL / Link (Optional)</label>
                                        <input
                                            type="text"
                                            value={sourceForm.url || ""}
                                            onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Summary / Details</label>
                                        <textarea
                                            value={sourceForm.content_summary || ""}
                                            onChange={(e) => setSourceForm({ ...sourceForm, content_summary: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50 min-h-[80px]"
                                            placeholder="Describe what's in this source..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assign to Brand</label>
                                        <select
                                            value={sourceForm.brand_id || ""}
                                            onChange={(e) => setSourceForm({ ...sourceForm, brand_id: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50"
                                        >
                                            <option value="" className="bg-slate-900">No Specific Brand</option>
                                            {brands.map(b => (
                                                <option key={b.id} value={b.id} className="bg-slate-900">{b.brand_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => { setIsAddingSource(false); setEditingSource(null); }}
                                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddSource}
                                        disabled={isSubmittingSource}
                                        className="btn-primary py-2 px-6 text-xs font-bold"
                                    >
                                        {isSubmittingSource ? 'Saving...' : editingSource ? 'Update Source' : 'Create Source'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                            {/* Special Google Drive Config Card (Legacy) */}
                            {driveConfig && (!selectedBrandId || selectedBrandId === "all") && (
                                viewMode === "grid" ? (
                                    <div className={`glass-card p-6 border-white/5 hover:border-cyan-500/30 transition-all ${driveConfig.is_connected ? '!bg-cyan-500/5' : ''}`}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-3xl">📁</span>
                                                <div>
                                                    <h4 className="font-bold text-white">Google Drive</h4>
                                                    <p className="text-[10px] text-slate-500">Connected Folder</p>
                                                </div>
                                            </div>
                                            <div className="relative group/status">
                                                <div className={`w-3 h-3 rounded-full ${driveConfig.is_connected ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"}`} />
                                                <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-slate-800 text-[10px] text-white rounded opacity-0 group-hover/status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-white/10">
                                                    {driveConfig.is_connected ? "Connected" : "Disconnected"}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mb-4 line-clamp-1">
                                            {driveConfig.folder_url || "No folder connected"}
                                        </p>
                                        <div className="flex gap-2">
                                            <button className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/10">Configure</button>
                                            <IconButton
                                                icon={Settings2}
                                                tooltip="Edit Drive Connection"
                                                onClick={() => { /* TODO: Drive edit modal */ }}
                                            />
                                            <IconButton
                                                icon={Trash2}
                                                variant="danger"
                                                tooltip="Disconnect Drive"
                                                onClick={handleDisconnectDrive}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`glass-card p-3 px-5 border-white/5 hover:border-cyan-500/30 transition-all flex items-center justify-between gap-4 ${driveConfig.is_connected ? '!bg-cyan-500/5' : ''}`}>
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <span className="text-xl">📁</span>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white text-sm truncate">Google Drive</h4>
                                                <p className="text-[10px] text-slate-500 truncate">{driveConfig.folder_url || "No folder connected"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="relative group/status">
                                                <div className={`w-2 h-2 rounded-full ${driveConfig.is_connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`} />
                                            </div>
                                            <div className="flex gap-1">
                                                <IconButton
                                                    icon={Settings2}
                                                    tooltip="Edit Drive Connection"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => { /* TODO: Drive edit modal */ }}
                                                />
                                                <IconButton
                                                    icon={Trash2}
                                                    variant="danger"
                                                    tooltip="Disconnect Drive"
                                                    size="sm"
                                                    onClick={handleDisconnectDrive}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Dynamic Knowledge Sources */}
                            {knowledgeSources.map((source) => (
                                viewMode === "grid" ? (
                                    <div
                                        key={source.id}
                                        className={`glass-card p-6 border-white/5 hover:border-cyan-500/30 transition-all flex flex-col group ${expandedSourceId === source.id ? 'ring-1 ring-cyan-500/30' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-3xl">
                                                    {source.source_type === 'website' ? '🌐' :
                                                        source.source_type === 'pdf' ? '📄' :
                                                            source.source_type === 'drive' ? '📁' : '📝'}
                                                </span>
                                                <div>
                                                    <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight line-clamp-1" title={source.name}>{source.name}</h4>
                                                    <p className="text-[10px] text-slate-500">
                                                        {source.source_type.toUpperCase()} SOURCE
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="relative group/status">
                                                <div className={`w-3 h-3 rounded-full ${source.is_active ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" : "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"}`} />
                                                <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-slate-800 text-[10px] text-white rounded opacity-0 group-hover/status:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-white/10">
                                                    {source.is_active ? "Connected" : "Disconnected"}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 mb-4">
                                            {source.url && (
                                                <a
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-cyan-500 hover:underline flex items-center gap-1"
                                                >
                                                    🔗 Review Source
                                                </a>
                                            )}
                                            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-medium">
                                                <span>Vectors: <span className="text-slate-300">{source.vector_count || 0}</span></span>
                                                <span>Synced: <span className="text-slate-300">{source.last_indexed_at ? new Date(source.last_indexed_at).toLocaleDateString() : 'Never'}</span></span>
                                            </div>
                                        </div>

                                        {expandedSourceId === source.id && (
                                            <div className="mb-4 p-3 bg-black/20 rounded-lg border border-white/5 animate-in slide-in-from-top-2 duration-200">
                                                <h5 className="text-[9px] font-bold text-slate-400 uppercase mb-1">Content Summary</h5>
                                                <p className="text-[10px] text-slate-300 leading-relaxed">
                                                    {source.content_summary || "No summary available for this source."}
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-auto flex gap-2 pt-4 border-t border-white/5">
                                            <button
                                                onClick={() => setExpandedSourceId(expandedSourceId === source.id ? null : source.id)}
                                                className={`flex-1 py-2 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${expandedSourceId === source.id ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400'}`}
                                            >
                                                {expandedSourceId === source.id ? 'Hide Info' : 'Show Details'}
                                            </button>
                                            <IconButton
                                                icon={Settings2}
                                                tooltip="Configure Source"
                                                onClick={() => {
                                                    setEditingSource(source);
                                                    setSourceForm({
                                                        name: source.name,
                                                        source_type: source.source_type,
                                                        url: source.url || "",
                                                        content_summary: source.content_summary || "",
                                                        brand_id: source.brand_id || ""
                                                    });
                                                    setIsAddingSource(true);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                            />
                                            <IconButton
                                                icon={Trash2}
                                                variant="danger"
                                                tooltip="Delete Source"
                                                disabled={deletingIds.has(source.id)}
                                                onClick={(e) => handleDeleteSource(e, source.id)}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        key={source.id}
                                        className="glass-card p-3 px-5 border-white/5 hover:border-cyan-500/30 transition-all flex items-center justify-between gap-4 group"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <span className="text-xl">
                                                {source.source_type === 'website' ? '🌐' :
                                                    source.source_type === 'pdf' ? '📄' :
                                                        source.source_type === 'drive' ? '📁' : '📝'}
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white text-sm truncate group-hover:text-cyan-400 transition-colors" title={source.name}>{source.name}</h4>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-[10px] text-slate-500 uppercase">{source.source_type}</span>
                                                    <span className="text-[10px] text-slate-600">|</span>
                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <Database size={10} /> {source.vector_count || 0} vectors
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            {source.url && (
                                                <a
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hidden md:block text-[10px] text-cyan-500 hover:underline"
                                                >
                                                    View Source ↗
                                                </a>
                                            )}
                                            <div className="relative group/status">
                                                <div className={`w-2 h-2 rounded-full ${source.is_active ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"}`} />
                                            </div>
                                            <div className="flex gap-1">
                                                <IconButton
                                                    icon={Settings2}
                                                    tooltip="Configure Source"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingSource(source);
                                                        setSourceForm({
                                                            name: source.name,
                                                            source_type: source.source_type,
                                                            url: source.url || "",
                                                            content_summary: source.content_summary || "",
                                                            brand_id: source.brand_id || ""
                                                        });
                                                        setIsAddingSource(true);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                />
                                                <IconButton
                                                    icon={Trash2}
                                                    variant="danger"
                                                    tooltip="Delete Source"
                                                    size="sm"
                                                    disabled={deletingIds.has(source.id)}
                                                    onClick={(e) => handleDeleteSource(e, source.id)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            ))}

                            {/* Add New Source Placeholder Card */}
                            <button
                                onClick={() => {
                                    setEditingSource(null);
                                    setSourceForm({ name: "", source_type: "website", url: "", content_summary: "", brand_id: selectedBrandId === "all" ? "" : selectedBrandId });
                                    setIsAddingSource(true);
                                }}
                                className={viewMode === "grid"
                                    ? "border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 text-slate-500 hover:border-cyan-500/40 hover:text-white transition-all group bg-white/[0.02] min-h-[220px]"
                                    : "border-2 border-dashed border-white/10 rounded-xl flex items-center gap-4 p-4 text-slate-500 hover:border-cyan-500/40 hover:text-white transition-all group bg-white/[0.02]"
                                }
                            >
                                <div className={viewMode === "grid"
                                    ? "w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-cyan-500/20 group-hover:text-cyan-400"
                                    : "w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:text-cyan-400"
                                }>
                                    <span className={viewMode === "grid" ? "text-2xl" : "text-lg"}>+</span>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-widest">Add Knowledge Source</span>
                            </button>
                        </div>

                        {knowledgeSources.length === 0 && !isAddingSource && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <span className="text-5xl mb-4 opacity-20">📚</span>
                                <p className="text-sm">No knowledge sources found for this brand.</p>
                                <p className="text-xs opacity-50 mt-1">Add a website, PDF, or document to build context.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeSubTab === "calendar" && (
                    <Section title="Calendar Sources" icon="📅" description="Sync content calendars from external sources">
                        <div className="p-8 border-2 border-dashed border-white/5 rounded-2xl text-center text-slate-500">
                            <p className="mb-4">No content calendars linked yet.</p>
                            <button className="btn-secondary text-xs px-6 py-2">Link Google Calendar</button>
                        </div>
                    </Section>
                )}
            </div>

            {/* Custom Confirm Dialog Modal */}
            {confirmDialog?.isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => { e.stopPropagation(); setConfirmDialog(null); }}
                >
                    <div
                        className="bg-[#0f111a] border border-[#1e293b] shadow-2xl rounded-2xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold mb-2 text-white">{confirmDialog.title}</h3>
                        <p className="text-sm text-slate-400 mb-6">{confirmDialog.message}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setConfirmDialog(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#161a29] text-[#94a3b8] border border-[#1e293b] hover:bg-[#1e293b] hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[rgba(244,63,94,0.1)] hover:bg-[rgba(244,63,94,0.2)] text-[#fb7185] border border-[rgba(244,63,94,0.2)]"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
