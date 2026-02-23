"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useChat, CHAT_MODES } from "@/components/ChatContext";
import {
    MessageSquare, Plus, Settings as SettingsIcon, Search, MoreVertical, Hash, Brain,
    Calendar, Clock, Filter, Trash2, Edit2, Play, CircleDot, ChevronRight, RefreshCw, Send,
    Mic, ImageIcon, Activity, Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";
import { TooltipProvider } from "@/components/ui/Tooltip";
import ReactMarkdown from "react-markdown";

// Custom specialized toggle switch since the previous one from workflows was localized
const SettingSwitch = ({ checked, onChange, disabled = false }: { checked: boolean, onChange?: (c: boolean) => void, disabled?: boolean }) => (
    <div
        className={cn(
            "w-8 h-4.5 rounded-full relative transition-colors duration-200",
            checked ? "bg-[#06b6d4]" : "bg-[#1e293b]",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        )}
        onClick={() => !disabled && onChange?.(!checked)}
    >
        <div className={cn(
            "absolute top-[2px] left-[2px] bg-white w-3.5 h-3.5 rounded-full transition-transform duration-200 shadow-sm",
            checked ? "transform translate-x-[14px]" : ""
        )} />
    </div>
);

export default function ChatPage() {
    const {
        messages,
        input,
        loading,
        conversationId,
        conversations,
        setInput,
        handleSend,
        loadConversation,
        startNewChat,
        removeChat,
        renameChat,
    } = useChat();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [searchHistory, setSearchHistory] = useState("");

    // Modal state
    const [showWorkflowModal, setShowWorkflowModal] = useState(false);

    // Dynamic Models State
    const [modelOptions, setModelOptions] = useState<{ value: string, label: string }[]>([]);

    // Right panel settings state
    const [model, setModel] = useState("GPT-4o");
    const [fallbackModel, setFallbackModel] = useState("Auto (OpenRouter)");
    const [temp, setTemp] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(1500);
    const [jsonMode, setJsonMode] = useState(false);

    const [execMode, setExecMode] = useState("chat_only");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedModel = localStorage.getItem("zaytri_chat_model");
            if (savedModel) setModel(savedModel);
            const savedTemp = localStorage.getItem("zaytri_chat_temp");
            if (savedTemp) setTemp(parseFloat(savedTemp));
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("zaytri_chat_model", model);
            localStorage.setItem("zaytri_chat_temp", temp.toString());
        }
    }, [model, temp]);

    const [contextToggles, setContextToggles] = useState({

        brandMemory: true,
        calendarContext: true,
        pastPosts: true,
        engagementData: false
    });

    useEffect(() => {
        // Mock fetch or actual API fetch for models
        const fetchModels = async () => {
            try {
                // We mock what would come from /settings/llm/providers here due to brevity
                const options = [
                    { value: "GPT-4o", label: "GPT-4o (OpenAI)" },
                    { value: "Claude 3.5 Sonnet", label: "Claude 3.5 Sonnet (Anthropic)" },
                    { value: "DeepSeek Coder", label: "DeepSeek Coder" },
                    { value: "Ollama (Llama 3 Local)", label: "Ollama (Llama 3 Local)" },
                    { value: "Mistral", label: "Mistral (Ollama Local)" },
                    { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (OpenRouter)" },
                    { value: "meta-llama/llama-3-70b-instruct", label: "Llama 3 70B (OpenRouter)" },
                ];
                setModelOptions(options);
            } catch (e) { }
        };
        fetchModels();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Grouping chats by date
    const groupedChats = useMemo(() => {
        const query = searchHistory.toLowerCase();
        const filtered = conversations.filter(c => (c.preview || "Chat").toLowerCase().includes(query));

        // Simple mock grouping
        return {
            "Today": filtered.slice(0, 3),
            "Previous 7 Days": filtered.slice(3, 8),
            "Older": filtered.slice(8)
        };
    }, [conversations, searchHistory]);

    const getContextControls = () => ({
        brand_memory: contextToggles.brandMemory,
        calendar_context: contextToggles.calendarContext,
        past_posts: contextToggles.pastPosts,
        engagement_data: contextToggles.engagementData,
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend(undefined, { model, temperature: temp, max_tokens: maxTokens, exec_mode: execMode, context_controls: getContextControls() });
        }
    };

    // Explicit click handler
    const onSendClick = () => {
        handleSend(undefined, { model, temperature: temp, max_tokens: maxTokens, exec_mode: execMode, context_controls: getContextControls() });
    };

    return (
        <div className="flex bg-[#0f111a] animate-in fade-in zoom-in-95 duration-500 h-[calc(100vh-2rem)] overflow-hidden text-sm">

            {/* Left Panel - History */}
            <div className="w-72 flex flex-col bg-[#0a0c10] border-r border-[#1e293b] flex-shrink-0 relative z-10">
                <div className="p-4 flex flex-col gap-4 border-b border-[#1e293b]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]">Z</span>
                        Master Agent
                    </h2>

                    <button
                        onClick={startNewChat}
                        className="w-full flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white px-4 py-2.5 rounded-xl font-semibold transition-all">
                        <Plus size={16} /> New Chat
                    </button>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchHistory}
                            onChange={(e) => setSearchHistory(e.target.value)}
                            className="w-full bg-[#0f111a] border border-[#1e293b] text-white pl-9 pr-3 py-2 rounded-lg outline-none focus:border-[#06b6d4] transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
                    {Object.entries(groupedChats).map(([group, chats]) => chats.length > 0 && (
                        <div key={group} className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-[#64748b] px-2 py-1 tracking-wider sticky top-0 bg-[#0a0c10]/95 backdrop-blur-sm z-10">
                                {group}
                            </div>
                            {chats.map(chat => (
                                <div
                                    key={chat.conversation_id}
                                    className={cn(
                                        "group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                                        chat.conversation_id === conversationId ? "bg-[rgba(6,182,212,0.1)] border border-[rgba(6,182,212,0.2)]" : "border border-transparent hover:bg-[#1e293b]"
                                    )}
                                >
                                    <div className="flex-1 min-w-0 pr-2" onClick={() => loadConversation(chat.conversation_id)}>
                                        <div className={cn("truncate font-medium", chat.conversation_id === conversationId ? "text-[#22d3ee]" : "text-[#cbd5e1]")}>
                                            {chat.preview || "New Conversation"}
                                        </div>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentName = chat.preview || "New Conversation";
                                                const newName = window.prompt("Rename chat:", currentName);
                                                if (newName && newName !== currentName) {
                                                    renameChat(chat.conversation_id, newName);
                                                }
                                            }}
                                            className="text-[#64748b] hover:text-white p-1 rounded hover:bg-[#334155]"><Edit2 size={12} /></button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm("Are you sure you want to delete this chat?")) {
                                                    removeChat(chat.conversation_id);
                                                }
                                            }}
                                            className="text-[#64748b] hover:text-[#f43f5e] p-1 rounded hover:bg-[#334155]"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Center Panel - Conversation Workspace */}
            <div className="flex-1 flex flex-col bg-[#0f111a] border-r border-[#1e293b]">
                {/* Header Profile */}
                <div className="flex items-center justify-between p-4 border-b border-[#1e293b] bg-[#0a0c10]/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        {conversationId && (
                            <>
                                <MessageSquare size={16} className="text-[#64748b]" />
                                <span className="font-semibold text-white">
                                    {conversations.find(c => c.conversation_id === conversationId)?.preview || "Active Session"}
                                </span>
                                <span className="text-xs text-[#64748b] bg-[#1e293b] px-2 py-0.5 rounded-md">CorpEdge</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <IconButton icon={RefreshCw} tooltip="Reset context" className="text-[#64748b] hover:text-white" />
                        <IconButton icon={CircleDot} tooltip="Live Connection" className="text-[#4ade80]" />
                    </div>
                </div>

                {/* Message Timeline View */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto opacity-70">
                            <div className="w-16 h-16 rounded-2xl bg-[#1e293b] flex items-center justify-center text-[#06b6d4] mb-4 shadow-xl">
                                <Activity size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Master Agent Command Line</h2>
                            <p className="text-[#94a3b8] mb-6">Start typing to interact with any module in the system or orchestrate complex RAG workflows instantly.</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {["Review pending content", "Generate standard metrics", "Show active prompts"].map(q => (
                                    <button key={q} onClick={() => handleSend(q)} className="text-xs bg-[#161a29] border border-[#1e293b] text-[#cbd5e1] hover:text-white hover:border-[#06b6d4]/50 px-3 py-1.5 rounded-full transition-colors">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 pb-4">
                            {messages.map((msg, i) => (
                                <div key={i} className="flex gap-4">
                                    {/* Avatar Column */}
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        {msg.role === "user" ? (
                                            <div className="w-8 h-8 border border-[#334155] rounded-full overflow-hidden bg-[#1e293b] flex items-center justify-center">
                                                <span className="text-[10px] font-bold text-white">USR</span>
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center text-white border border-[#06b6d4]/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                                                Z
                                            </div>
                                        )}
                                        {/* Timeline Line */}
                                        {i !== messages.length - 1 && (
                                            <div className="w-px h-full bg-[#1e293b] my-2" />
                                        )}
                                    </div>

                                    {/* Content Column */}
                                    <div className={cn("flex-1", msg.role === "user" ? "pt-1" : "")}>
                                        {msg.role === "user" ? (
                                            <div className="text-[#f1f5f9] leading-relaxed bg-[#1e293b]/40 border border-[#1e293b] rounded-2xl rounded-tl-none p-4 inline-block">
                                                {msg.content}
                                            </div>
                                        ) : (
                                            <div className="w-full">
                                                {/* Assistant Execution Wrapper */}
                                                <div className="bg-[#161a29] border border-[#1e293b] rounded-2xl overflow-hidden shadow-sm">

                                                    {/* Header Metadata */}
                                                    <div className="flex justify-between items-center p-3 border-b border-[#1e293b] bg-[#1a1f30]">
                                                        <div className="flex items-center gap-2">
                                                            {msg.intent && msg.intent !== "general_chat" ? (
                                                                <span className="flex items-center gap-1.5 text-xs font-bold text-[#eab308] bg-[#eab308]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                    <Activity size={12} /> {msg.intent.replace(/_/g, " ")}
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-xs font-bold text-[#4ade80] px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                    <CheckCircle size={12} /> Analysis Complete
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-[#64748b]">
                                                            <span className="flex items-center gap-1 bg-[#1e293b] px-2 py-0.5 rounded-md text-[#94a3b8] font-mono"><Brain size={12} /> {msg.model_used || "Auto"}</span>
                                                            <span>Token Cost: {msg.token_cost || (Math.floor(msg.content.length / 4))}</span>
                                                        </div>
                                                    </div>

                                                    {/* Markdown Content */}
                                                    <div className="p-4 text-[#cbd5e1] leading-relaxed prose prose-invert max-w-none text-sm">
                                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                    </div>

                                                    {/* Simulated sub-tasks if intent was e.g. run_workflow */}
                                                    {msg.intent === "run_workflow" && (
                                                        <div className="px-4 pb-4 space-y-2">
                                                            <div className="flex items-center justify-between bg-[#11131c] border border-[#1e293b] p-2.5 rounded-lg text-xs">
                                                                <span className="flex items-center gap-2 text-white"><span className="w-4 h-4 rounded-full bg-[#06b6d4]/20 border border-[#06b6d4] flex items-center justify-center text-[#06b6d4]">1</span> Generating Content</span>
                                                                <span className="font-mono text-[#64748b]">2.4s</span>
                                                            </div>
                                                            <div className="flex items-center justify-between bg-[#11131c] border border-[#1e293b] p-2.5 rounded-lg text-xs">
                                                                <span className="flex items-center gap-2 text-white"><span className="w-4 h-4 rounded-full bg-[#06b6d4]/20 border border-[#06b6d4] flex items-center justify-center text-[#06b6d4]">2</span> Review Agent Pass</span>
                                                                <span className="text-[#eab308] bg-[#eab308]/10 px-1.5 rounded">Running...</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Bar per msg */}
                                                <div className="flex items-center gap-2 mt-2 ml-1">
                                                    <button className="text-[10px] font-bold text-[#64748b] hover:text-white uppercase tracking-wider px-2 py-1 flex items-center gap-1"><RefreshCw size={10} /> Retry</button>
                                                    <button className="text-[10px] font-bold text-[#64748b] hover:text-white uppercase tracking-wider px-2 py-1 flex items-center gap-1"><Code size={10} /> View JSON</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#06b6d4] to-[#8b5cf6] flex items-center justify-center text-white border border-[#06b6d4]/30 animate-pulse transition-all">
                                        Z
                                    </div>
                                    <div className="bg-[#161a29] border border-[#1e293b] rounded-2xl px-5 py-4 w-32 shadow-sm">
                                        <div className="flex gap-1.5 mt-1">
                                            <div className="w-2 h-2 rounded-full bg-[#06b6d4] animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <div className="w-2 h-2 rounded-full bg-[#06b6d4] animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <div className="w-2 h-2 rounded-full bg-[#06b6d4] animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#0a0c10]/80 backdrop-blur-xl border-t border-[#1e293b]">
                    <div className="bg-[#161a29] border border-[#1e293b] rounded-xl flex items-end p-2 focus-within:border-[#06b6d4]/50 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all">
                        <IconButton icon={ImageIcon} className="text-[#64748b] hover:text-[#06b6d4] hover:bg-[#06b6d4]/10 mb-1" />
                        <IconButton icon={Mic} className="text-[#64748b] hover:text-[#06b6d4] hover:bg-[#06b6d4]/10 mb-1" />
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSendClick(); }
                            }}
                            placeholder="Type a command, query, or / to select modules..."
                            className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none max-h-32 min-h-[44px] py-3 px-2 leading-relaxed custom-scrollbar placeholder-[#475569]"
                            rows={1}
                        />
                        <button
                            onClick={onSendClick}
                            disabled={!input.trim() || loading}
                            className="bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] text-white p-2.5 rounded-lg disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:hover:shadow-none mb-1 mr-1"
                        >
                            <Send size={16} className={loading ? "animate-pulse" : ""} />
                        </button>
                    </div>
                    <div className="text-[10px] text-center mt-2 text-[#475569]">
                        Shift + Enter for new line • Model: {model}
                    </div>
                </div>
            </div>

            {/* Right Panel - Control Context */}
            <div className="w-80 flex flex-col bg-[#0a0c10] border-l border-[#1e293b] flex-shrink-0 z-10 overflow-y-auto custom-scrollbar">

                {/* Current Settings Section */}
                <div className="p-5 border-b border-[#1e293b]">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                        <span>Current Settings</span>
                        <SettingsIcon size={14} className="text-[#64748b]" />
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mb-1.5 block">Model</label>
                            <div className="relative">
                                <select
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    className="w-full bg-[#161a29] border border-[#1e293b] text-sm text-white rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors appearance-none cursor-pointer"
                                >
                                    {modelOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] rotate-90" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider mb-1.5 block">Fallback Model</label>
                            <div className="relative">
                                <select
                                    value={fallbackModel}
                                    onChange={e => setFallbackModel(e.target.value)}
                                    className="w-full bg-[#161a29] border border-[#1e293b] text-sm text-white rounded-lg px-3 py-2 outline-none focus:border-[#06b6d4] transition-colors appearance-none cursor-pointer"
                                >
                                    <option>Auto (OpenRouter)</option>
                                    <option>GPT-4 Core</option>
                                </select>
                                <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] rotate-90" />
                            </div>
                        </div>

                        <div className="border border-[#1e293b] rounded-lg bg-[#0f111a] p-3 space-y-4">
                            <div className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-wider flex items-center gap-1"><Filter size={10} /> Advanced Options</div>

                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-[#cbd5e1]">Temperature</span>
                                    <span className="font-mono text-[#64748b]">{temp.toFixed(1)}</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.1" value={temp} onChange={e => setTemp(parseFloat(e.target.value))} className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#06b6d4]" />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-[#cbd5e1]">Max Tokens</span>
                                    <span className="font-mono text-[#64748b]">{maxTokens}</span>
                                </div>
                                <input type="range" min="100" max="8000" step="100" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))} className="w-full h-1 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#06b6d4]" />
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
                                <span className="text-xs text-[#cbd5e1] flex items-center gap-1.5"><Code size={12} /> JSON Mode</span>
                                <SettingSwitch checked={jsonMode} onChange={setJsonMode} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Execution Mode */}
                <div className="p-5 border-b border-[#1e293b]">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                        <span>Execution Mode</span>
                        <Activity size={14} className="text-[#64748b]" />
                    </h3>

                    <div className="space-y-1 rounded-lg bg-[#161a29] border border-[#1e293b] p-1.5 overflow-hidden">
                        {[
                            { id: "chat_only", label: "Chat Only", icon: MessageSquare },
                            { id: "content_creation", label: "Content Creation", icon: CircleDot },
                            { id: "full_automation", label: "Full Automation", icon: Zap },
                            { id: "approval", label: "Approval Required", icon: CheckCircle },
                            { id: "silent", label: "Silent Background", icon: Clock }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={(e) => {
                                    e.preventDefault();
                                    setExecMode(mode.id);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between p-2 rounded-md transition-all cursor-pointer",
                                    execMode === mode.id ? "bg-[#1e293b] text-white" : "text-[#94a3b8] hover:bg-[#1e293b]/50 hover:text-white"
                                )}
                            >
                                <span className={cn(
                                    "flex items-center gap-2 text-xs transition-colors",
                                    execMode === mode.id ? "font-bold" : "font-medium"
                                )}>
                                    <mode.icon size={14} className={execMode === mode.id ? "text-[#06b6d4]" : ""} />
                                    {mode.label}
                                </span>
                                {execMode === mode.id && <div className="w-2 h-2 rounded-full bg-[#06b6d4] shadow-[0_0_8px_rgba(6,182,212,0.8)]" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Context Controls */}
                <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                        <span>Context Controls</span>
                        <Brain size={14} className="text-[#64748b]" />
                    </h3>

                    <div className="space-y-3 flex-1 mb-4">
                        {Object.entries(contextToggles).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between bg-[#161a29] border border-[#1e293b] px-3 py-2.5 rounded-lg">
                                <span className="text-xs font-semibold text-[#cbd5e1] flex items-center gap-2">
                                    {key === 'brandMemory' ? <div className="w-1.5 h-1.5 bg-[#4ade80] rounded-full" /> :
                                        key === 'calendarContext' ? <div className="w-1.5 h-1.5 bg-[#06b6d4] rounded-full" /> :
                                            key === 'pastPosts' ? <div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full" /> :
                                                <div className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full" />}
                                    {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                                </span>
                                <SettingSwitch checked={val} onChange={(c) => setContextToggles({ ...contextToggles, [key]: c })} />
                            </div>
                        ))}
                    </div>

                    <button onClick={() => setShowWorkflowModal(true)} className="w-full bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-white px-4 py-3 rounded-xl font-bold transition-all text-xs flex justify-center items-center gap-2 mb-2">
                        <Play size={14} className="text-[#8b5cf6]" /> Convert Chat to Workflow
                    </button>
                </div>
            </div>

            {/* Workflow Creation Modal */}
            {showWorkflowModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-md bg-[#0f111a] border border-[#1e293b] rounded-2xl p-6 shadow-2xl relative">
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Play className="text-[#8b5cf6]" /> Convert to Workflow
                        </h2>
                        <p className="text-[#94a3b8] text-sm mb-6">
                            This will create a new automated pipeline based on the context, parameters, and intents parsed from this active chat.
                        </p>

                        <div className="bg-[#161a29] border border-[#1e293b] p-4 rounded-xl mb-6 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[#64748b]">Source Elements</span>
                                <span className="text-white font-bold">{messages.length} Messages</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[#64748b]">Model Profile</span>
                                <span className="text-[#06b6d4]">{model}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[#64748b]">Execution Bound</span>
                                <span className="text-[#f43f5e]">{execMode.replace('_', ' ')}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                                onClick={() => setShowWorkflowModal(false)}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-[#94a3b8] hover:text-white hover:bg-[#1e293b] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowWorkflowModal(false);
                                    // Normally navigates to /workflows or triggers API sync
                                }}
                                className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] hover:opacity-90 transition-opacity"
                            >
                                Create Workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

// Icon Helpers missing natively in this scope
function Zap(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>; }
function CheckCircle(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>; }
