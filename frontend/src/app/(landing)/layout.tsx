/**
 * Landing Layout — Full-width, no sidebar, no topbar, no chat widget.
 * Used for public marketing pages: /, /about, /privacy, /terms
 */

export default function LandingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                marginLeft: 0,
                paddingLeft: 0,
                width: "100%",
                position: "fixed",
                top: 0,
                left: 0,
                overflowY: "auto",
                overflowX: "hidden",
                height: "100vh",
                background: "#0a0a12",
            }}
        >
            {children}
        </div>
    );
}
