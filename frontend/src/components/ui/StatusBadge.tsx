"use client";

import { cn } from "@/lib/utils"

export interface StatusBadgeProps {
    status: string
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const normStatus = status.toLowerCase()

    const map: Record<string, string> = {
        // Standard Zaytri backend statuses
        draft: "draft",
        reviewed: "reviewed",
        approved: "approved",
        scheduled: "scheduled",
        published: "published",
        failed: "failed",
        deleted: "deleted",
        // User requested statuses
        waiting_approval: "reviewed", // map to reviewed
        waiting: "reviewed"
    }

    const mapped = map[normStatus] || "draft"

    // Reuse existing globals.css classes: badge-draft, badge-reviewed, badge-approved, badge-published, badge-failed
    // I'll add badge-scheduled mapping inline if it doesn't exist, though it's requested to be purple

    const colorStyles: Record<string, string> = {
        draft: "bg-[rgba(139,139,160,0.15)] text-[#94a3b8]", // Gray
        reviewed: "bg-[rgba(234,179,8,0.15)] text-[#eab308]", // Yellow (WAITING)
        approved: "bg-[rgba(59,130,246,0.15)] text-[#3b82f6]", // Blue
        scheduled: "bg-[rgba(168,85,247,0.15)] text-[#c084fc]", // Purple
        published: "bg-[rgba(34,197,94,0.15)] text-[#22c55e]", // Green
        failed: "bg-[rgba(244,63,94,0.15)] text-[#fb7185]", // Red
        deleted: "bg-[rgba(244,63,94,0.15)] text-[#fb7185]", // Red
    }

    // Use the requested display name if it's waiting_approval
    const displayLabel = normStatus === "reviewed" || normStatus === "waiting_approval"
        ? "WAITING"
        : normStatus.toUpperCase()

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider",
            colorStyles[mapped] || colorStyles.draft,
            className
        )}>
            {displayLabel}
        </span>
    )
}
