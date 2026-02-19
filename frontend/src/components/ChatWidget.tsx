"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useChat, CHAT_MODES, type ChatMode } from "./ChatContext";

// ─── Draggable Hook ────────────────────────────────────────────────────────

function useDraggable(ref: React.RefObject<HTMLDivElement | null>) {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-chat-drag-handle]")) return;
        e.preventDefault();
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setIsDragging(true);
    }, [ref]);

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => {
            const newX = e.clientX - dragOffset.current.x;
            const newY = e.clientY - dragOffset.current.y;
            const maxX = window.innerWidth - (ref.current?.offsetWidth || 400);
            const maxY = window.innerHeight - (ref.current?.offsetHeight || 500);
            setPos({
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
            });
        };
        const onUp = () => setIsDragging(false);
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
    }, [isDragging, ref]);

    return { pos, isDragging, onMouseDown, hasBeenDragged: pos.x !== 0 || pos.y !== 0 };
}

// ─── Quick Suggestions ────────────────────────────────────────────────────

const QUICK_ACTIONS = [
    { text: "What can you do?", icon: "💡" },
    { text: "Show system status", icon: "📊" },
    { text: "Create a post", icon: "📝" },
    { text: "List my content", icon: "📋" },
];

// ─── Chat Widget ───────────────────────────────────────────────────────────

export default function ChatWidget() {
    const pathname = usePathname();
    const {
        messages,
        input,
        loading,
        conversationId,
        conversations,
        showHistory,
        activeMode,
        isWidgetOpen,
        attachedImages,
        isDraggingOver,
        setInput,
        setShowHistory,
        setActiveMode,
        setIsWidgetOpen,
        handleSend,
        loadConversation,
        startNewChat,
        addImages,
        removeImage,
        setIsDraggingOver,
    } = useChat();

    // Hide widget only on the dedicated full-page chat page (it has its own UI)
    if (pathname.startsWith("/chat")) return null;

    const [unreadCount, setUnreadCount] = useState(0);
    const [showModeMenu, setShowModeMenu] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatRef = useRef<HTMLDivElement>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);
    const { pos, isDragging, onMouseDown, hasBeenDragged } = useDraggable(chatRef);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isWidgetOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setUnreadCount(0);
        }
    }, [isWidgetOpen]);

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSelectMode = (mode: ChatMode) => {
        setActiveMode(mode);
        setShowModeMenu(false);
        inputRef.current?.focus();
    };

    // Get current mode info
    const currentModeInfo = CHAT_MODES.find((m) => m.id === activeMode);
    const hasContent = input.trim() || attachedImages.length > 0;

    return (
        <>
            {/* ── Floating Chat Button ─────────────────────────────────── */}
            {!isWidgetOpen && (
                <button
                    id="chat-widget-btn"
                    onClick={() => setIsWidgetOpen(true)}
                    className="fixed z-50 group"
                    style={{ right: 24, bottom: 24 }}
                >
                    <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-2xl transition-all duration-300 group-hover:scale-110"
                        style={{
                            background: "linear-gradient(135deg, #06b6d4, #9333ea)",
                            boxShadow: "0 8px 32px rgba(6, 182, 212, 0.4), 0 0 60px rgba(147, 51, 234, 0.2)",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        🤖
                    </div>
                    {unreadCount > 0 && (
                        <div
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: "#06b6d4" }}
                        >
                            {unreadCount}
                        </div>
                    )}
                    <div
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{
                            background: "rgba(6, 182, 212, 0.15)",
                            animationDuration: "3s",
                        }}
                    />
                </button>
            )}

            {/* ── Chat Modal ───────────────────────────────────────────── */}
            {isWidgetOpen && (
                <div
                    ref={chatRef}
                    id="chat-widget-modal"
                    className="fixed z-50 flex flex-col"
                    style={{
                        width: 420,
                        height: 580,
                        ...(hasBeenDragged
                            ? { left: pos.x, top: pos.y }
                            : { right: 24, bottom: 24 }),
                        borderRadius: 20,
                        background: "linear-gradient(180deg, #0e0e18 0%, #0a0a12 100%)",
                        border: isDraggingOver
                            ? "2px solid rgba(139, 92, 246, 0.6)"
                            : "1px solid var(--zaytri-border)",
                        boxShadow: isDraggingOver
                            ? "0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(139, 92, 246, 0.15)"
                            : "0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(6, 182, 212, 0.08)",
                        animation: isDragging ? "none" : "chatWidgetSlideIn 0.3s ease-out",
                        overflow: "hidden",
                        userSelect: isDragging ? "none" : "auto",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onMouseDown={onMouseDown}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {/* ── Drag Overlay ──────────────────────────────────── */}
                    {isDraggingOver && (
                        <div
                            className="absolute inset-0 z-50 flex flex-col items-center justify-center"
                            style={{
                                background: "rgba(10, 10, 18, 0.92)",
                                backdropFilter: "blur(4px)",
                                borderRadius: 20,
                            }}
                        >
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4"
                                style={{
                                    background: "rgba(139, 92, 246, 0.12)",
                                    border: "2px dashed rgba(139, 92, 246, 0.4)",
                                    animation: "pulse 2s infinite",
                                }}
                            >
                                📷
                            </div>
                            <p className="text-white font-semibold text-sm">Drop images here</p>
                            <p className="text-xs mt-1" style={{ color: "var(--zaytri-text-dim)" }}>
                                PNG, JPG, GIF, WebP • Max 10MB
                            </p>
                        </div>
                    )}

                    {/* ── Header (Drag Handle) ─────────────────────────── */}
                    <div
                        data-chat-drag-handle
                        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                        style={{
                            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(147, 51, 234, 0.05))",
                            borderBottom: "1px solid var(--zaytri-border)",
                            cursor: "move",
                        }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                                style={{
                                    background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(147, 51, 234, 0.2))",
                                    border: "1px solid rgba(6, 182, 212, 0.2)",
                                }}
                            >
                                🤖
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white leading-tight">Master Agent</p>
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span className="text-[10px]" style={{ color: "var(--zaytri-text-dim)" }}>
                                        Online
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all"
                                style={{
                                    background: showHistory ? "rgba(6, 182, 212, 0.15)" : "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--zaytri-text-dim)",
                                }}
                                title="Chat history"
                            >
                                📜
                            </button>
                            <button
                                onClick={startNewChat}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all"
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--zaytri-text-dim)" }}
                                title="New chat"
                            >
                                ✨
                            </button>
                            <button
                                id="chat-widget-close"
                                onClick={() => setIsWidgetOpen(false)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--zaytri-text-dim)" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.15)"; e.currentTarget.style.color = "#22d3ee"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--zaytri-text-dim)"; }}
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* ── Conversation History Drawer ──────────────────── */}
                    {showHistory && (
                        <div
                            className="px-3 py-2 overflow-y-auto flex-shrink-0"
                            style={{
                                maxHeight: 140,
                                borderBottom: "1px solid var(--zaytri-border)",
                                background: "rgba(0,0,0,0.2)",
                            }}
                        >
                            <p className="text-[10px] font-semibold uppercase mb-1.5" style={{ color: "var(--zaytri-text-dim)" }}>
                                Recent Chats
                            </p>
                            {conversations.length === 0 ? (
                                <p className="text-xs py-2" style={{ color: "var(--zaytri-text-dim)" }}>No conversations yet</p>
                            ) : (
                                <div className="space-y-1">
                                    {conversations.slice(0, 8).map((c) => (
                                        <button
                                            key={c.conversation_id}
                                            onClick={() => loadConversation(c.conversation_id)}
                                            className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all truncate"
                                            style={{
                                                background: c.conversation_id === conversationId ? "rgba(6, 182, 212, 0.1)" : "transparent",
                                                color: c.conversation_id === conversationId ? "white" : "var(--zaytri-text-dim)",
                                                border: "none",
                                                cursor: "pointer",
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = c.conversation_id === conversationId ? "rgba(6, 182, 212, 0.1)" : "transparent";
                                            }}
                                        >
                                            {c.preview || "Chat"}
                                            {c.last_at && (
                                                <span className="ml-1 opacity-50">
                                                    · {new Date(c.last_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Messages Area ────────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" id="chat-widget-messages">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
                                    style={{
                                        background: "linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(147, 51, 234, 0.12))",
                                        border: "1px solid rgba(6, 182, 212, 0.15)",
                                    }}
                                >
                                    🤖
                                </div>
                                <p className="text-sm font-semibold text-white mb-1">Hey! I&apos;m your Master Agent</p>
                                <p className="text-xs mb-5" style={{ color: "var(--zaytri-text-dim)" }}>
                                    Ask me anything — I control the entire system.
                                </p>
                                <div className="grid grid-cols-2 gap-2 w-full">
                                    {QUICK_ACTIONS.map((s) => (
                                        <button
                                            key={s.text}
                                            onClick={() => handleSend(s.text)}
                                            className="text-left px-3 py-2 rounded-xl text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            style={{
                                                background: "var(--zaytri-surface-2)",
                                                border: "1px solid var(--zaytri-border)",
                                                color: "var(--zaytri-text-dim)",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <span className="mr-1">{s.icon}</span>
                                            {s.text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className="max-w-[85%] rounded-2xl px-3.5 py-2.5"
                                            style={{
                                                background: msg.role === "user"
                                                    ? "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(147, 51, 234, 0.15))"
                                                    : "var(--zaytri-surface-2)",
                                                border: msg.role === "user"
                                                    ? "1px solid rgba(6, 182, 212, 0.25)"
                                                    : "1px solid var(--zaytri-border)",
                                            }}
                                        >
                                            {msg.role === "assistant" && msg.intent && msg.intent !== "general_chat" && msg.intent !== "error" && (
                                                <span
                                                    className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-1.5"
                                                    style={{
                                                        background: "rgba(168, 85, 247, 0.1)",
                                                        border: "1px solid rgba(168, 85, 247, 0.2)",
                                                        color: "rgba(168, 85, 247, 0.8)",
                                                    }}
                                                >
                                                    {msg.intent.replace(/_/g, " ")}
                                                </span>
                                            )}
                                            {/* Image thumbnails in message */}
                                            {msg.image_data && msg.image_data.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mb-2">
                                                    {msg.image_data.map((src, idx) => (
                                                        <img
                                                            key={idx}
                                                            src={src}
                                                            alt={`Attachment ${idx + 1}`}
                                                            className="rounded-lg object-cover"
                                                            style={{
                                                                width: msg.image_data!.length === 1 ? "100%" : 80,
                                                                height: msg.image_data!.length === 1 ? "auto" : 80,
                                                                maxHeight: 200,
                                                                border: "1px solid rgba(255,255,255,0.1)",
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            <p
                                                className="text-xs leading-relaxed whitespace-pre-wrap"
                                                style={{ color: msg.role === "user" ? "white" : "var(--zaytri-text)" }}
                                            >
                                                {msg.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div
                                            className="rounded-2xl px-4 py-3"
                                            style={{ background: "var(--zaytri-surface-2)", border: "1px solid var(--zaytri-border)" }}
                                        >
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* ── Active Mode Indicator ────────────────────────── */}
                    {activeMode !== "chat" && currentModeInfo && (
                        <div
                            className="mx-3 mb-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                            style={{
                                background: `${currentModeInfo.color}15`,
                                border: `1px solid ${currentModeInfo.color}30`,
                                color: currentModeInfo.color,
                            }}
                        >
                            <span>{currentModeInfo.icon}</span>
                            <span className="font-medium">{currentModeInfo.label}</span>
                            <span className="opacity-60">mode active</span>
                            <button
                                onClick={() => setActiveMode("chat")}
                                className="ml-auto text-xs opacity-60 hover:opacity-100 transition-opacity"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* ── Image Preview Strip ──────────────────────────── */}
                    {attachedImages.length > 0 && (
                        <div
                            className="mx-3 mb-1 flex items-center gap-2 overflow-x-auto flex-shrink-0"
                            style={{
                                padding: "6px 0",
                            }}
                        >
                            {attachedImages.map((img) => (
                                <div
                                    key={img.id}
                                    className="relative flex-shrink-0 group"
                                    style={{ width: 52, height: 52 }}
                                >
                                    <img
                                        src={img.preview}
                                        alt="Attachment"
                                        className="w-full h-full object-cover rounded-lg"
                                        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                                    />
                                    <button
                                        onClick={() => removeImage(img.id)}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{
                                            background: "#06b6d4",
                                            border: "1px solid rgba(0,0,0,0.3)",
                                            color: "white",
                                            cursor: "pointer",
                                            lineHeight: 1,
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {attachedImages.length < 5 && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-shrink-0 flex items-center justify-center rounded-lg transition-all hover:opacity-80"
                                    style={{
                                        width: 52,
                                        height: 52,
                                        background: "var(--zaytri-surface-2)",
                                        border: "1px dashed var(--zaytri-border)",
                                        color: "var(--zaytri-text-dim)",
                                        cursor: "pointer",
                                        fontSize: 16,
                                    }}
                                >
                                    +
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Input Bar ─────────────────────────────────────── */}
                    <div
                        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
                        style={{
                            borderTop: "1px solid var(--zaytri-border)",
                            background: "rgba(0,0,0,0.2)",
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
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all"
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
                                    className="absolute left-0 bottom-full mb-2 w-56 rounded-xl overflow-hidden"
                                    style={{
                                        background: "linear-gradient(180deg, #14141f 0%, #0e0e18 100%)",
                                        border: "1px solid var(--zaytri-border)",
                                        boxShadow: "0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(6, 182, 212, 0.06)",
                                        animation: "chatModeMenuSlideIn 0.2s ease-out",
                                    }}
                                >
                                    <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--zaytri-border)" }}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--zaytri-text-dim)" }}>
                                            Choose mode
                                        </p>
                                    </div>
                                    <div className="py-1">
                                        {CHAT_MODES.map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => handleSelectMode(mode.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
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
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                                                    style={{
                                                        background: `${mode.color}18`,
                                                        border: `1px solid ${mode.color}30`,
                                                    }}
                                                >
                                                    {mode.icon}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold leading-tight">{mode.label}</p>
                                                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--zaytri-text-dim)" }}>
                                                        {mode.description}
                                                    </p>
                                                </div>
                                                {activeMode === mode.id && (
                                                    <div className="ml-auto">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ background: mode.color, boxShadow: `0 0 8px ${mode.color}60` }}
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
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all"
                            style={{
                                background: "var(--zaytri-surface-2)",
                                border: "1px solid var(--zaytri-border)",
                                cursor: "pointer",
                                color: "var(--zaytri-text-dim)",
                            }}
                            title="Attach image"
                        >
                            📷
                        </button>

                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={
                                attachedImages.length > 0
                                    ? "Add a message or send..."
                                    : activeMode !== "chat" && currentModeInfo
                                        ? `${currentModeInfo.icon} ${currentModeInfo.label}...`
                                        : "Ask anything..."
                            }
                            disabled={loading}
                            className="flex-1 text-xs text-white outline-none"
                            style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                background: "var(--zaytri-surface-2)",
                                border: "1px solid var(--zaytri-border)",
                            }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={loading || !hasContent}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all"
                            style={{
                                background: hasContent
                                    ? "linear-gradient(135deg, #06b6d4, #9333ea)"
                                    : "var(--zaytri-surface-2)",
                                border: "none",
                                cursor: hasContent ? "pointer" : "default",
                                opacity: hasContent ? 1 : 0.4,
                            }}
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
