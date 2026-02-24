"use client";

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/Tooltip"

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ElementType | string
    tooltip?: string
    variant?: "default" | "danger" | "success" | "primary" | "ghost"
    size?: "sm" | "md" | "lg"
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ className, icon: Icon, tooltip, variant = "default", size = "md", ...props }, ref) => {

        // Convert string emojis to standard standard icons, or support both
        const variantStyles = {
            default: "bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155] hover:text-white border border-transparent",
            ghost: "bg-transparent text-[#94a3b8] hover:bg-[#1e293b] hover:text-white border border-transparent",
            danger: "bg-[rgba(244,63,94,0.1)] text-[#fb7185] border border-[rgba(244,63,94,0.2)] hover:bg-[rgba(244,63,94,0.2)]",
            success: "bg-[rgba(34,197,94,0.1)] text-[#4ade80] border border-[rgba(34,197,94,0.2)] hover:bg-[rgba(34,197,94,0.2)]",
            primary: "bg-[rgba(6,182,212,0.15)] text-[#22d3ee] border border-[rgba(6,182,212,0.3)] hover:bg-[rgba(6,182,212,0.25)] hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]"
        }

        const button = (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-lg text-sm transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                    variantStyles[variant],
                    size === "sm" ? "p-1.5" : size === "lg" ? "p-3" : "p-2",
                    className
                )}
                {...props}
            >
                {typeof Icon === 'string' ? <span>{Icon}</span> : <Icon size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />}
            </button>
        )

        if (tooltip) {
            return (
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent>
                            <p>{tooltip}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )
        }

        return button
    }
)
IconButton.displayName = "IconButton"

export { IconButton }
