"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat, CHAT_MODES, type ChatMode } from "@/components/ChatContext";

// ─── Quick Suggestion Chips ────────────────────────────────────────────────

const SUGGESTIONS = [
    { text: "What can you do?", icon: "💡" },
    { text: "Create a post about AI trends for Instagram", icon: "📝" },
    { text: "Show me system status", icon: "📊" },
    { text: "List my recent content", icon: "📋" },
    { text: "Show configured AI providers", icon: "🤖" },
    { text: "Change analytics schedule to Friday 10 AM", icon: "⏰" },
];

const INTENT_ICONS: Record<string, string> = {
    assign_llm_key: "🔑",
    delete_llm_key: "🗑️",
    test_provider: "🔌",
    assign_agent_model: "🎯",
    reset_agent_model: "↩️",
    switch_all_agents: "🔄",
    run_workflow: "🚀",
    update_cron: "⏰",
    get_system_status: "📊",
    list_content: "📋",
    approve_content: "✅",
    delete_content: "🗑️",
    list_providers: "🤖",
    list_agents: "🎯",
    get_settings: "⚙️",
    help: "💡",
    general_chat: "💬",
};

// ─── Voice Input Hook ──────────────────────────────────────────────────────

function useVoiceInput() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [isSupported, setIsSupported] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
        if (SpeechRecognitionCtor) {
            setIsSupported(true);
            const recognition = new SpeechRecognitionCtor();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = ""; // Auto-detect language

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recognition.onresult = (event: any) => {
                const last = event.results[event.results.length - 1];
                setTranscript(last[0].transcript);
            };

            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);

            recognitionRef.current = recognition;
        }
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            setTranscript("");
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    return { isListening, transcript, isSupported, startListening, stopListening };
}

// ─── Main Chat Page ────────────────────────────────────────────────────────

export default function ChatPage() {
    const {
        messages,
        input,
        loading,
        conversationId,
        conversations,
        showHistory,
        activeMode,
        attachedImages,
        isDraggingOver,
        setInput,
        setShowHistory,
        setActiveMode,
        handleSend,
        loadConversation,
        startNewChat,
        addImages,
        removeImage,
        setIsDraggingOver,
    } = useChat();

    const [showModeMenu, setShowModeMenu] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    const { isListening, transcript, isSupported, startListening, stopListening } = useVoiceInput();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Voice transcript → input
    useEffect(() => {
        if (transcript) setInput(transcript);
    }, [transcript, setInput]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleVoiceToggle = () => {
        if (isListening) {
            stopListening();
            setTimeout(() => {
                if (input.trim()) handleSend();
            }, 300);
        } else {
            startListening();
        }
    };

    const handleSelectMode = (mode: ChatMode) => {
        setActiveMode(mode);
        setShowModeMenu(false);
        inputRef.current?.focus();
    };

    // Close mode menu on outside click
    useEffect(() => {
        if (!showModeMenu) return;
        const handler = (e: MouseEvent) => {
            if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
                setShowModeMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showModeMenu]);

    // ── Drag & Drop handlers ──────────────────────────────────────────

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer?.types.includes("Files")) {
            setIsDraggingOver(true);
        }
    }, [setIsDraggingOver]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDraggingOver(false);
        }
    }, [setIsDraggingOver]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDraggingOver(false);

        const files = Array.from(e.dataTransfer?.files || []);
        const imageFiles = files.filter((f) => f.type.startsWith("image/"));
        if (imageFiles.length > 0) {
            addImages(imageFiles);
        }
    }, [addImages, setIsDraggingOver]);

    // ── Paste handler ─────────────────────────────────────────────────

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile();
                if (file) imageFiles.push(file);
            }
        }
        if (imageFiles.length > 0) {
            e.preventDefault();
            addImages(imageFiles);
        }
    }, [addImages]);

    // ── File picker ───────────────────────────────────────────────────

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) addImages(files);
        e.target.value = "";
    }, [addImages]);

    // Get current mode info
    const currentModeInfo = CHAT_MODES.find((m) => m.id === activeMode);
    const hasContent = input.trim() || attachedImages.length > 0;

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div
            className="animate-fade-in flex flex-col relative"
            style={{ height: "calc(100vh - 4rem)" }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* ── Full-page Drag Overlay ───────────────────────────────── */}
            {isDraggingOver && (
                <div
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center"
                    style={{
                        background: "rgba(10, 10, 18, 0.92)",
                        backdropFilter: "blur(8px)",
                        borderRadius: 16,
                        border: "2px dashed rgba(139, 92, 246, 0.5)",
                    }}
                >
                    <div
                        className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-5"
                        style={{
                            background: "rgba(139, 92, 246, 0.12)",
                            border: "2px dashed rgba(139, 92, 246, 0.4)",
                            animation: "pulse 2s infinite",
                        }}
                    >
                        📷
                    </div>
                    <p className="text-white font-bold text-lg mb-1">Drop images here</p>
                    <p className="text-sm" style={{ color: "var(--zaytri-text-dim)" }}>
                        PNG, JPG, GIF, WebP • Max 10MB each • Up to 5 images
                    </p>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                        style={{
                            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.2))",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            boxShadow: "0 0 20px rgba(6, 182, 212, 0.15)",
                        }}
                    >
                        🤖
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">
                            <span className="gradient-text">Master Agent</span>
                        </h1>
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            Chat in any language • Text, Voice & Images • Full system control
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                        style={{
                            background: "var(--zaytri-surface-2)",
                            border: "1px solid var(--zaytri-border)",
                            color: "var(--zaytri-text-dim)",
                        }}
                    >
                        📜 History
                    </button>
                    <button
                        onClick={startNewChat}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                        style={{
                            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(168, 85, 247, 0.15))",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            color: "white",
                        }}
                    >
                        ✨ New Chat
                    </button>
                </div>
            </div>

            {/* Conversation History Drawer */}
            {showHistory && (
                <div
                    className="mb-4 p-4 rounded-2xl overflow-y-auto"
                    style={{
                        background: "var(--zaytri-surface)",
                        border: "1px solid var(--zaytri-border)",
                        maxHeight: 200,
                    }}
                >
                    <h3 className="text-sm font-semibold text-white mb-3">Recent Conversations</h3>
                    {conversations.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--zaytri-text-dim)" }}>
                            No previous conversations
                        </p>
                    ) : (
                        <div className="grid gap-2">
                            {conversations.map((c) => (
                                <button
                                    key={c.conversation_id}
                                    onClick={() => loadConversation(c.conversation_id)}
                                    className="text-left px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                                    style={{
                                        background: c.conversation_id === conversationId
                                            ? "rgba(6, 182, 212, 0.1)"
                                            : "var(--zaytri-surface-2)",
                                        border: c.conversation_id === conversationId
                                            ? "1px solid rgba(6, 182, 212, 0.3)"
                                            : "1px solid var(--zaytri-border)",
                                        color: "var(--zaytri-text-dim)",
                                    }}
                                >
                                    <span className="text-white font-medium">{c.preview || "Chat"}</span>
                                    {c.last_at && (
                                        <span className="text-xs ml-2" style={{ color: "var(--zaytri-text-dim)" }}>
                                            {new Date(c.last_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Area */}
            <div
                className="flex-1 overflow-y-auto rounded-2xl p-6 mb-4"
                style={{
                    background: "var(--zaytri-surface)",
                    border: "1px solid var(--zaytri-border)",
                }}
            >
                {messages.length === 0 ? (
                    /* Welcome Screen */
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div
                            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6"
                            style={{
                                background: "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(168, 85, 247, 0.15))",
                                border: "1px solid rgba(6, 182, 212, 0.2)",
                                boxShadow: "0 0 40px rgba(6, 182, 212, 0.1)",
                            }}
                        >
                            🤖
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Hi! I&apos;m your Master Agent
                        </h2>
                        <p className="text-sm mb-8" style={{ color: "var(--zaytri-text-dim)", maxWidth: 450 }}>
                            I control the entire Zaytri system. Ask me anything — create content, configure AI models,
                            change settings, or just chat. Drop images here to analyze them! 🌍
                        </p>

                        {/* Mode Cards */}
                        <div className="flex flex-wrap justify-center gap-3 mb-8" style={{ maxWidth: 560 }}>
                            {CHAT_MODES.filter(m => m.id !== "chat").map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setActiveMode(mode.id)}
                                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
                                    style={{
                                        background: activeMode === mode.id
                                            ? `${mode.color}20`
                                            : "var(--zaytri-surface-2)",
                                        border: activeMode === mode.id
                                            ? `1px solid ${mode.color}50`
                                            : "1px solid var(--zaytri-border)",
                                        color: activeMode === mode.id ? mode.color : "var(--zaytri-text-dim)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                                        style={{
                                            background: `${mode.color}18`,
                                            border: `1px solid ${mode.color}30`,
                                        }}
                                    >
                                        {mode.icon}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-xs">{mode.label}</p>
                                        <p className="text-[10px] opacity-60">{mode.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ maxWidth: 500 }}>
                            {SUGGESTIONS.map((s) => (
                                <button
                                    key={s.text}
                                    onClick={() => handleSend(s.text)}
                                    className="text-left px-4 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    style={{
                                        background: "var(--zaytri-surface-2)",
                                        border: "1px solid var(--zaytri-border)",
                                        color: "var(--zaytri-text-dim)",
                                    }}
                                >
                                    <span className="mr-2">{s.icon}</span>
                                    {s.text}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Message Thread */
                    <div className="grid gap-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className="max-w-[80%] rounded-2xl px-5 py-3"
                                    style={{
                                        background:
                                            msg.role === "user"
                                                ? "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.15))"
                                                : "var(--zaytri-surface-2)",
                                        border:
                                            msg.role === "user"
                                                ? "1px solid rgba(6, 182, 212, 0.3)"
                                                : "1px solid var(--zaytri-border)",
                                    }}
                                >
                                    {/* Intent badge for assistant */}
                                    {msg.role === "assistant" && msg.intent && msg.intent !== "general_chat" && (
                                        <div
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mb-2"
                                            style={{
                                                background: "rgba(168, 85, 247, 0.1)",
                                                border: "1px solid rgba(168, 85, 247, 0.2)",
                                                color: "rgba(168, 85, 247, 0.8)",
                                            }}
                                        >
                                            {INTENT_ICONS[msg.intent] || "⚡"} {msg.intent.replace(/_/g, " ")}
                                        </div>
                                    )}
                                    {/* Image thumbnails in message */}
                                    {msg.image_data && msg.image_data.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {msg.image_data.map((src, idx) => (
                                                <img
                                                    key={idx}
                                                    src={src}
                                                    alt={`Attachment ${idx + 1}`}
                                                    className="rounded-xl object-cover"
                                                    style={{
                                                        width: msg.image_data!.length === 1 ? "100%" : 120,
                                                        height: msg.image_data!.length === 1 ? "auto" : 120,
                                                        maxHeight: 300,
                                                        border: "1px solid rgba(255,255,255,0.1)",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <div
                                        className="text-sm leading-relaxed whitespace-pre-wrap"
                                        style={{ color: msg.role === "user" ? "white" : "var(--zaytri-text)" }}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex justify-start">
                                <div
                                    className="rounded-2xl px-5 py-3"
                                    style={{
                                        background: "var(--zaytri-surface-2)",
                                        border: "1px solid var(--zaytri-border)",
                                    }}
                                >
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Active Mode Indicator */}
            {activeMode !== "chat" && currentModeInfo && (
                <div
                    className="mb-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                    style={{
                        background: `${currentModeInfo.color}15`,
                        border: `1px solid ${currentModeInfo.color}30`,
                        color: currentModeInfo.color,
                    }}
                >
                    <span className="text-base">{currentModeInfo.icon}</span>
                    <span className="font-semibold">{currentModeInfo.label}</span>
                    <span className="opacity-60 text-xs">mode active — your messages will be processed accordingly</span>
                    <button
                        onClick={() => setActiveMode("chat")}
                        className="ml-auto text-sm opacity-60 hover:opacity-100 transition-opacity px-2 py-0.5 rounded-lg"
                        style={{
                            background: `${currentModeInfo.color}20`,
                            border: "none",
                            cursor: "pointer",
                            color: "inherit",
                        }}
                    >
                        ✕ Clear
                    </button>
                </div>
            )}

            {/* Image Preview Strip */}
            {attachedImages.length > 0 && (
                <div
                    className="mb-2 flex items-center gap-3 overflow-x-auto px-1"
                    style={{ padding: "8px 4px" }}
                >
                    {attachedImages.map((img) => (
                        <div
                            key={img.id}
                            className="relative flex-shrink-0 group"
                            style={{ width: 72, height: 72 }}
                        >
                            <img
                                src={img.preview}
                                alt="Attachment"
                                className="w-full h-full object-cover rounded-xl"
                                style={{
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                }}
                            />
                            <button
                                onClick={() => removeImage(img.id)}
                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{
                                    background: "#06b6d4",
                                    border: "2px solid rgba(10, 10, 18, 0.8)",
                                    color: "white",
                                    cursor: "pointer",
                                    lineHeight: 1,
                                }}
                            >
                                ✕
                            </button>
                            <div
                                className="absolute bottom-1 left-1 right-1 text-center text-[8px] font-medium truncate px-1 py-0.5 rounded"
                                style={{
                                    background: "rgba(0,0,0,0.7)",
                                    color: "rgba(255,255,255,0.7)",
                                }}
                            >
                                {img.file.name}
                            </div>
                        </div>
                    ))}
                    {attachedImages.length < 5 && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl transition-all hover:opacity-80"
                            style={{
                                width: 72,
                                height: 72,
                                background: "var(--zaytri-surface-2)",
                                border: "1px dashed var(--zaytri-border)",
                                color: "var(--zaytri-text-dim)",
                                cursor: "pointer",
                            }}
                        >
                            <span className="text-xl mb-0.5">+</span>
                            <span className="text-[9px]">Add more</span>
                        </button>
                    )}
                </div>
            )}

            {/* Input Bar */}
            <div
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{
                    background: "var(--zaytri-surface)",
                    border: "1px solid var(--zaytri-border)",
                    boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.2)",
                }}
            >
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {/* Plus / Mode Selector Button */}
                <div className="relative" ref={modeMenuRef}>
                    <button
                        onClick={() => setShowModeMenu(!showModeMenu)}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all flex-shrink-0"
                        style={{
                            background: showModeMenu ? "rgba(6, 182, 212, 0.15)" : "var(--zaytri-surface-2)",
                            border: "1px solid var(--zaytri-border)",
                            cursor: "pointer",
                            color: "var(--zaytri-text-dim)",
                            transform: showModeMenu ? "rotate(45deg)" : "none",
                        }}
                        title="Choose mode"
                    >
                        ＋
                    </button>

                    {/* Mode Selector Popup */}
                    {showModeMenu && (
                        <div
                            className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl overflow-hidden"
                            style={{
                                background: "linear-gradient(180deg, #14141f 0%, #0e0e18 100%)",
                                border: "1px solid var(--zaytri-border)",
                                boxShadow: "0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.06)",
                                animation: "chatModeMenuSlideIn 0.2s ease-out",
                            }}
                        >
                            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--zaytri-border)" }}>
                                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Choose a mode
                                </p>
                            </div>
                            <div className="py-1">
                                {CHAT_MODES.map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => handleSelectMode(mode.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                                        style={{
                                            background: activeMode === mode.id ? `${mode.color}15` : "transparent",
                                            border: "none",
                                            cursor: "pointer",
                                            color: activeMode === mode.id ? mode.color : "var(--zaytri-text)",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (activeMode !== mode.id) {
                                                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = activeMode === mode.id ? `${mode.color}15` : "transparent";
                                        }}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                            style={{
                                                background: `${mode.color}18`,
                                                border: `1px solid ${mode.color}30`,
                                            }}
                                        >
                                            {mode.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold leading-tight">{mode.label}</p>
                                            <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: "var(--zaytri-text-dim)" }}>
                                                {mode.description}
                                            </p>
                                        </div>
                                        {activeMode === mode.id && (
                                            <div className="flex-shrink-0">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full"
                                                    style={{ background: mode.color, boxShadow: `0 0 10px ${mode.color}60` }}
                                                />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Image Upload Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all flex-shrink-0"
                    style={{
                        background: attachedImages.length > 0
                            ? "rgba(139, 92, 246, 0.15)"
                            : "var(--zaytri-surface-2)",
                        border: attachedImages.length > 0
                            ? "1px solid rgba(139, 92, 246, 0.3)"
                            : "1px solid var(--zaytri-border)",
                        cursor: "pointer",
                        color: attachedImages.length > 0
                            ? "#a78bfa"
                            : "var(--zaytri-text-dim)",
                    }}
                    title={`Attach image${attachedImages.length > 0 ? ` (${attachedImages.length})` : ""}`}
                >
                    📷
                    {attachedImages.length > 0 && (
                        <span
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ background: "#8b5cf6" }}
                        >
                            {attachedImages.length}
                        </span>
                    )}
                </button>

                {/* Voice Button */}
                {isSupported && (
                    <button
                        onClick={handleVoiceToggle}
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all flex-shrink-0"
                        style={{
                            background: isListening
                                ? "linear-gradient(135deg, #06b6d4, #155e75)"
                                : "var(--zaytri-surface-2)",
                            border: isListening
                                ? "1px solid #06b6d4"
                                : "1px solid var(--zaytri-border)",
                            boxShadow: isListening ? "0 0 20px rgba(6, 182, 212, 0.4)" : "none",
                            animation: isListening ? "pulse 1.5s infinite" : "none",
                        }}
                        title={isListening ? "Stop listening" : "Start voice input"}
                    >
                        {isListening ? "⏹️" : "🎙️"}
                    </button>
                )}

                {/* Text Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                        attachedImages.length > 0
                            ? "Add a message about these images..."
                            : isListening
                                ? "🎤 Listening..."
                                : activeMode !== "chat" && currentModeInfo
                                    ? `${currentModeInfo.icon} ${currentModeInfo.label}...`
                                    : "Type a message, drag images, or use voice..."
                    }
                    disabled={loading}
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-500"
                    style={{
                        padding: "10px 16px",
                        borderRadius: 12,
                        background: "var(--zaytri-surface-2)",
                        border: "1px solid var(--zaytri-border)",
                    }}
                    autoFocus
                />

                {/* Send Button */}
                <button
                    onClick={() => handleSend()}
                    disabled={loading || !hasContent}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all flex-shrink-0"
                    style={{
                        background: hasContent
                            ? "linear-gradient(135deg, #06b6d4, #155e75)"
                            : "var(--zaytri-surface-2)",
                        border: hasContent
                            ? "1px solid #06b6d4"
                            : "1px solid var(--zaytri-border)",
                        opacity: hasContent ? 1 : 0.5,
                        cursor: hasContent ? "pointer" : "default",
                    }}
                >
                    ➤
                </button>
            </div>
        </div>
    );
}
