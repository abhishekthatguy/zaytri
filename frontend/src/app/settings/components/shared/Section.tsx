import { useState } from "react";

interface SectionProps {
    title: string;
    description?: string;
    icon?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export default function Section({ title, description, icon, children, defaultOpen = true }: SectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="glass-card mb-6 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-white/5"
            >
                <div className="flex items-center gap-4">
                    {icon && (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-white/5 border border-white/10">
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        {description && <p className="text-sm text-slate-400">{description}</p>}
                    </div>
                </div>
                <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M5 7.5L10 12.5L15 7.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </button>
            {isOpen && (
                <div className="px-6 pb-6 border-t border-white/5 animate-fade-in">
                    <div className="pt-6">{children}</div>
                </div>
            )}
        </div>
    );
}
