"use client";

import { ToastProvider } from "@/components/Toast";
import { SessionProvider } from "@/components/SessionProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            <SessionProvider>
                {children}
            </SessionProvider>
        </ToastProvider>
    );
}
