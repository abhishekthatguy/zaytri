interface TooltipProps {
    text: string;
    children: React.ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
    return (
        <div className="group relative inline-block">
            {children}
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg bg-black/90 px-3 py-1.5 text-xs text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 z-50 border border-white/10 shadow-xl">
                {text}
                <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
            </div>
        </div>
    );
}
