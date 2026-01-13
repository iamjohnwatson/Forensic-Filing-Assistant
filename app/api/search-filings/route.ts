import { NextRequest, NextResponse } from 'next/server';
import { fetchCIK, fetchSubmission, generateSecUrl } from '@/lib/sec-client';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ticker, startDate, endDate, filingType } = body;

        if (!ticker) {
            return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
        }

        const cik = await fetchCIK(ticker);
        if (!cik) {
            return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
        }

        const submission = await fetchSubmission(cik);
        if (!submission) {
            return NextResponse.json({ error: "No filings found" }, { status: 404 });
        }

        const recent = submission.filings.recent;
        const results = [];

        // Convert input dates to timestamps for comparison
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Date.now();

        for (let i = 0; i < recent.accessionNumber.length; i++) {
            const fDate = new Date(recent.filingDate[i]).getTime();
            const formType = recent.form[i];

            // Filter by Date
            if (fDate < start || fDate > end) continue;

            // Filter by Type (if specified)
            // Allow partial matching e.g. "10-K" matches "10-K" and "10-K/A"
            if (filingType && filingType !== 'ALL') {
                if (filingType === '10-K' && !formType.includes('10-K')) continue;
                if (filingType === '10-Q' && !formType.includes('10-Q')) continue;
                if (filingType === '8-K' && !formType.includes('8-K')) continue;
                if (filingType === '13-F' && !formType.includes('13F')) continue;
                // Exact match fallback for others
                if (!['10-K', '10-Q', '8-K', '13-F'].includes(filingType) && formType !== filingType) continue;
            }

            results.push({
                accessionNumber: recent.accessionNumber[i],
                filingDate: recent.filingDate[i],
                form: formType,
                size: recent.size[i],
                primaryDocument: recent.primaryDocument[i],
                description: recent.primaryDocDescription[i],
                downloadUrl: generateSecUrl(cik, recent.accessionNumber[i], recent.primaryDocument[i])
            });
        }

        return NextResponse.json({ results: results.slice(0, 50) }); // Limit to 50 for UI performance

    } catch (error) {
        console.error("Search API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
