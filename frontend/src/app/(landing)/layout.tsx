/**
 * Landing Layout — Full-width, no sidebar, no topbar, no chat widget.
 * Used for public marketing pages: /, /about, /privacy, /terms
 * 
 * The layout uses position:fixed to cover the entire viewport and escape
 * the root layout's sidebar structure. It has its own internal scroll.
 */

export default function LandingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* Full-screen landing container that escapes the sidebar layout */}
            <div
                id="landing-scroll-root"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    overflowY: "scroll",
                    overflowX: "hidden",
                    background: "transparent",
                    zIndex: 50,
                    margin: 0,
                    padding: 0,
                    scrollBehavior: "smooth",
                    WebkitOverflowScrolling: "touch",
                }}
            >
                {children}
            </div>
        </>
    );
}
