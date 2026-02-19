/**
 * Auth Layout — Full-screen centered, no sidebar.
 * The Sidebar component automatically hides on auth routes,
 * so we just need to override the main content area's left margin.
 */

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{
                marginLeft: 0,
                paddingLeft: 0,
                width: "100%",
                position: "fixed",
                top: 0,
                left: 0,
                overflowX: "hidden",
                background: "linear-gradient(135deg, #0a0a12 0%, #12121a 50%, #1a0a0a 100%)",
            }}
        >
            {children}
        </div>
    );
}
