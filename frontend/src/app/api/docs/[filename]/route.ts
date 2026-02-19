import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Allowed doc files (security: prevent directory traversal)
const ALLOWED_FILES = [
    "HOW_TO_GET_API_KEYS.md",
    "MASTER_AGENT.md",
    "AUTH.md",
    "AUTH_PLAN.md",
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    if (!ALLOWED_FILES.includes(filename)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        // Docs are in /docs at the project root (two levels up from frontend)
        const docsDir = path.resolve(process.cwd(), "..", "docs");
        const filePath = path.join(docsDir, filename);
        const content = await readFile(filePath, "utf-8");

        return new NextResponse(content, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
}
