import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const url = searchParams.get('url');
    const filename = searchParams.get('filename') || 'filing.htm';

    if (!url) {
        return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "ForensicAnalyzer contact@example.com"
            }
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch from SEC" }, { status: 502 });
        }

        const blob = await response.blob();
        const headers = new Headers();
        headers.set("Content-Disposition", `attachment; filename="${filename}"`);
        headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");

        return new NextResponse(blob, { headers });

    } catch (error) {
        console.error("Download Proxy Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
