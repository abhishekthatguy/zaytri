type StatusType = "Connected" | "Active" | "Failed" | "Pending" | "Neutral" | "Disconnected";

interface StatusBadgeProps {
    status: StatusType;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    const getStyles = () => {
        switch (status) {
            case "Connected":
            case "Active":
                return "bg-green-500/15 text-green-500 border-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.2)]";
            case "Failed":
                return "bg-red-500/15 text-red-500 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]";
            case "Pending":
                return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30 shadow-[0_0_12px_rgba(234,179,8,0.2)]";
            case "Disconnected":
                return "bg-slate-500/15 text-slate-400 border-slate-500/30";
            default:
                return "bg-slate-500/15 text-slate-400 border-slate-500/30";
        }
    };

    return (
        <span className={`badge border ${getStyles()} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === "Disconnected" ? "bg-slate-500" : "bg-current"} ${status === "Active" || status === "Connected" ? "animate-pulse" : ""}`} />
            {status}
        </span>
    );
}
