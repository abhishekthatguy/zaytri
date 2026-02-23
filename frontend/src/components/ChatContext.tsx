"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
    sendChatMessage,
    getChatHistory,
    listConversations,
    deleteConversation,
    renameConversation,
    type ChatMessage,
    type ChatResponse,
    type ConversationPreview,
} from "@/lib/api";

export type ChatMode =
    | "chat"          // Default general chat
    | "create_image"  // Image generation
    | "canvas"        // Canvas / document editing
    | "fast_research" // Quick research
    | "deep_research"; // Deep research

export interface ChatModeInfo {
    id: ChatMode;
    label: string;
    icon: string;
    description: string;
    color: string;
}

export const CHAT_MODES: ChatModeInfo[] = [
    { id: "chat", label: "Chat", icon: "💬", description: "General conversation", color: "#3b82f6" },
    { id: "create_image", label: "Create Image", icon: "🎨", description: "Generate images with AI", color: "#8b5cf6" },
    { id: "canvas", label: "Canvas", icon: "📄", description: "Collaborative document editing", color: "#f59e0b" },
    { id: "fast_research", label: "Fast Research", icon: "⚡", description: "Quick research summary", color: "#22c55e" },
    { id: "deep_research", label: "Deep Research", icon: "🔬", description: "In-depth research & analysis", color: "#ef4444" },
];

// ─── Image Attachment ──────────────────────────────────────────────────────

export interface ImageAttachment {
    id: string;
    file: File;
    preview: string;    // object URL for local preview
    base64: string;     // base64 data to send with message
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

// ─── Context Type ──────────────────────────────────────────────────────────

interface ChatContextType {
    // State
    messages: ChatMessage[];
    input: string;
    loading: boolean;
    conversationId: string | null;
    conversations: ConversationPreview[];
    showHistory: boolean;
    activeMode: ChatMode;
    attachedImages: ImageAttachment[];
    isDraggingOver: boolean;

    // Widget-specific
    isWidgetOpen: boolean;

    // Actions
    setInput: (val: string) => void;
    setShowHistory: (val: boolean) => void;
    setActiveMode: (mode: ChatMode) => void;
    setIsWidgetOpen: (open: boolean) => void;
    handleSend: (text?: string, options?: {
        model?: string,
        temperature?: number,
        max_tokens?: number,
        exec_mode?: string,
        context_controls?: {
            brand_memory: boolean;
            calendar_context: boolean;
            past_posts: boolean;
            engagement_data: boolean;
        }
    }) => Promise<void>;
    loadConversation: (convId: string) => Promise<void>;
    startNewChat: () => void;
    refreshConversations: () => void;

    // Manage chats
    removeChat: (convId: string) => Promise<void>;
    renameChat: (convId: string, newName: string) => Promise<void>;

    // Image actions
    addImages: (files: File[]) => Promise<void>;
    removeImage: (id: string) => void;
    clearImages: () => void;
    setIsDraggingOver: (val: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useChat(): ChatContextType {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error("useChat must be used within ChatProvider");
    return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<ConversationPreview[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [activeMode, setActiveMode] = useState<ChatMode>("chat");
    const [isWidgetOpen, setIsWidgetOpen] = useState(false);
    const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // Track if we've done the initial conversation load
    const initialLoadDone = useRef(false);

    // Load conversations on mount (only if authenticated)
    useEffect(() => {
        if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            // Only load conversations if user has a token (authenticated)
            const token = typeof window !== "undefined" ? localStorage.getItem("zaytri_token") : null;
            if (token) {
                listConversations().then(setConversations).catch(() => { });
            }
        }
    }, []);

    // Cleanup previews on unmount
    useEffect(() => {
        return () => {
            attachedImages.forEach((img) => URL.revokeObjectURL(img.preview));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshConversations = useCallback(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("zaytri_token") : null;
        if (token) {
            listConversations().then(setConversations).catch(() => { });
        }
    }, []);

    // ── Image management ───────────────────────────────────────────────

    const addImages = useCallback(async (files: File[]) => {
        const validFiles = files.filter((f) => {
            if (!ALLOWED_TYPES.includes(f.type)) return false;
            if (f.size > MAX_SIZE_MB * 1024 * 1024) return false;
            return true;
        });

        if (validFiles.length === 0) return;

        // Limit total
        const remaining = MAX_IMAGES - attachedImages.length;
        const toAdd = validFiles.slice(0, remaining);

        const newImages: ImageAttachment[] = await Promise.all(
            toAdd.map(async (file) => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                preview: URL.createObjectURL(file),
                base64: await fileToBase64(file),
            }))
        );

        setAttachedImages((prev) => [...prev, ...newImages]);
    }, [attachedImages.length]);

    const removeImage = useCallback((id: string) => {
        setAttachedImages((prev) => {
            const img = prev.find((i) => i.id === id);
            if (img) URL.revokeObjectURL(img.preview);
            return prev.filter((i) => i.id !== id);
        });
    }, []);

    const clearImages = useCallback(() => {
        setAttachedImages((prev) => {
            prev.forEach((img) => URL.revokeObjectURL(img.preview));
            return [];
        });
    }, []);

    // ── Send message ───────────────────────────────────────────────────

    const handleSend = useCallback(async (text?: string, options?: {
        model?: string,
        temperature?: number,
        max_tokens?: number,
        exec_mode?: string,
        context_controls?: {
            brand_memory: boolean;
            calendar_context: boolean;
            past_posts: boolean;
            engagement_data: boolean;
        }
    }) => {
        const msg = (text || input).trim();
        const hasImages = attachedImages.length > 0;
        if ((!msg && !hasImages) || loading) return;

        // If a mode is selected, prefix the message to indicate the mode
        let finalMsg = msg || (hasImages ? "What do you see in this image?" : "");
        if (activeMode !== "chat") {
            const modeInfo = CHAT_MODES.find((m) => m.id === activeMode);
            if (modeInfo) {
                finalMsg = `[${modeInfo.label}] ${finalMsg}`;
            }
        }

        // Build user message with image previews
        const imageDataForMessage = hasImages ? attachedImages.map((i) => i.base64) : undefined;
        const imageDataForApi = hasImages ? attachedImages.map((i) => i.base64) : undefined;

        setMessages((prev) => [
            ...prev,
            { role: "user", content: msg || "📷 Image", image_data: imageDataForMessage, model_used: options?.model },
        ]);
        setInput("");
        clearImages();
        setLoading(true);

        try {
            const res: ChatResponse = await sendChatMessage(
                finalMsg,
                conversationId || undefined,
                imageDataForApi,
                options
            );
            setConversationId(res.conversation_id);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: res.response, intent: res.intent, model_used: res.model_used, token_cost: res.token_cost },
            ]);
            refreshConversations();
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I encountered an error. Please try again.", intent: "error" },
            ]);
        } finally {
            setLoading(false);
        }
    }, [input, loading, conversationId, activeMode, attachedImages, refreshConversations, clearImages]);

    const loadConversation = useCallback(async (convId: string) => {
        try {
            const history = await getChatHistory(convId);
            setMessages(history);
            setConversationId(convId);
            setShowHistory(false);
        } catch {
            // ignore
        }
    }, []);

    const startNewChat = useCallback(() => {
        setMessages([]);
        setConversationId(null);
        setInput("");
        setShowHistory(false);
        setActiveMode("chat");
        clearImages();
    }, [clearImages]);

    // ── Manage Chats ───────────────────────────────────────────────────

    const removeChat = useCallback(async (convId: string) => {
        try {
            await deleteConversation(convId);
            setConversations((prev) => prev.filter((c) => c.conversation_id !== convId));
            if (conversationId === convId) {
                startNewChat();
            }
        } catch (e) {
            console.error("Failed to delete chat", e);
        }
    }, [conversationId, startNewChat]);

    const renameChat = useCallback(async (convId: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            await renameConversation(convId, newName);
            refreshConversations();
        } catch (e) {
            console.error("Failed to rename chat", e);
        }
    }, [refreshConversations]);

    return (
        <ChatContext.Provider
            value={{
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
                refreshConversations,
                removeChat,
                renameChat,
                addImages,
                removeImage,
                clearImages,
                setIsDraggingOver,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}
