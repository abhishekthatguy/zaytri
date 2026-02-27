"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number; // ms, default 4000
    icon?: string;
}

interface ToastContextType {
    addToast: (toast: Omit<ToastItem, "id">) => void;
    removeToast: (id: string) => void;
    // Shortcuts
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// ─── Toast Config ───────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: string; gradient: string; border: string; glow: string }> = {
    success: {
        icon: "✓",
        gradient: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.08))",
        border: "rgba(34, 197, 94, 0.4)",
        glow: "0 0 20px rgba(34, 197, 94, 0.15)",
    },
    error: {
        icon: "✕",
        gradient: "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(185, 28, 28, 0.08))",
        border: "rgba(6, 182, 212, 0.4)",
        glow: "0 0 20px rgba(6, 182, 212, 0.15)",
    },
    warning: {
        icon: "⚠",
        gradient: "linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(202, 138, 4, 0.08))",
        border: "rgba(234, 179, 8, 0.4)",
        glow: "0 0 20px rgba(234, 179, 8, 0.15)",
    },
    info: {
        icon: "ℹ",
        gradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))",
        border: "rgba(59, 130, 246, 0.4)",
        glow: "0 0 20px rgba(59, 130, 246, 0.15)",
    },
};

const ICON_BG: Record<ToastType, string> = {
    success: "linear-gradient(135deg, #22c55e, #16a34a)",
    error: "linear-gradient(135deg, #06b6d4, #0891b2)",
    warning: "linear-gradient(135deg, #eab308, #ca8a04)",
    info: "linear-gradient(135deg, #3b82f6, #2563eb)",
};

// ─── Single Toast ───────────────────────────────────────────────────────────

function ToastNotification({
    toast,
    onRemove,
}: {
    toast: ToastItem;
    onRemove: (id: string) => void;
}) {
    const [exiting, setExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const duration = toast.duration || 4000;
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startRef = useRef(0);

    const config = TOAST_CONFIG[toast.type];
    const displayIcon = toast.icon || config.icon;

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
    }, [onRemove, toast.id]);

    useEffect(() => {
        startRef.current = Date.now();
        timerRef.current = setTimeout(dismiss, duration);

        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startRef.current;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
            if (remaining <= 0) clearInterval(progressInterval);
        }, 50);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearInterval(progressInterval);
        };
    }, [dismiss, duration]);

    return (
        <div
            role="alert"
            onClick={dismiss}
            style={{
                background: config.gradient,
                border: `1px solid ${config.border}`,
                boxShadow: config.glow,
                backdropFilter: "blur(16px)",
                transform: exiting ? "translateX(120%)" : "translateX(0)",
                opacity: exiting ? 0 : 1,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                overflow: "hidden",
            }}
            className="rounded-xl relative mb-3 max-w-sm w-full"
        >
            <div className="flex items-start gap-3 p-4">
                {/* Icon Badge */}
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: ICON_BG[toast.type] }}
                >
                    {displayIcon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--zaytri-text)" }}>
                        {toast.title}
                    </p>
                    {toast.message && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--zaytri-text-dim)" }}>
                            {toast.message}
                        </p>
                    )}
                </div>

                {/* Close */}
                <button
                    onClick={(e) => { e.stopPropagation(); dismiss(); }}
                    className="text-xs flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition-colors"
                    style={{ color: "var(--zaytri-text-dim)", background: "rgba(255,255,255,0.05)" }}
                >
                    ×
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-[2px] w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                    className="h-full transition-all ease-linear"
                    style={{
                        width: `${progress}%`,
                        background: ICON_BG[toast.type],
                        transitionDuration: "50ms",
                    }}
                />
            </div>
        </div>
    );
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [...prev.slice(-4), { ...toast, id }]); // max 5 toasts
    }, []);

    const success = useCallback(
        (title: string, message?: string) => addToast({ type: "success", title, message }),
        [addToast]
    );
    const error = useCallback(
        (title: string, message?: string) => addToast({ type: "error", title, message }),
        [addToast]
    );
    const warning = useCallback(
        (title: string, message?: string) => addToast({ type: "warning", title, message }),
        [addToast]
    );
    const info = useCallback(
        (title: string, message?: string) => addToast({ type: "info", title, message }),
        [addToast]
    );

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
            {children}

            {/* Toast Container — fixed top-right */}
            <div
                style={{
                    position: "fixed",
                    top: "1.5rem",
                    right: "1.5rem",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    pointerEvents: "none",
                }}
            >
                {toasts.map((toast) => (
                    <div key={toast.id} style={{ pointerEvents: "auto" }}>
                        <ToastNotification toast={toast} onRemove={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
