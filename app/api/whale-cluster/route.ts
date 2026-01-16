import { NextRequest, NextResponse } from 'next/server';
import { fetchCIK, fetchSubmission, generateSecUrl, fetchFilingContent, parse13F } from '@/lib/sec-client';

// Shared interface for a single holding
interface Holding {
    issuer: string;
    cusip: string;
    value: number;
    shares: number;
}

// Helper to fetch current holdings for a single ticker
async function getFundHoldings(ticker: string): Promise<{ ticker: string, holdings: Map<string, Holding>, filingDate: string } | null> {
    try {
        const cik = await fetchCIK(ticker);
        if (!cik) return null;

        const submission = await fetchSubmission(cik);
        if (!submission) return null;

        const recent = submission.filings.recent;
        let filingIdx = -1;

        // Find latest 13F-HR
        for (let i = 0; i < recent.form.length; i++) {
            if (recent.form[i] === '13F-HR') {
                filingIdx = i;
                break;
            }
        }

        if (filingIdx === -1) return null;

        const accessionNumber = recent.accessionNumber[filingIdx];
        const primaryDocument = recent.primaryDocument[filingIdx];

        const accessionNoDash = accessionNumber.replace(/-/g, '');
        let targetUrl = generateSecUrl(cik, accessionNumber, primaryDocument);
        let content = await fetchFilingContent(targetUrl);

        if (!content) return null;

        let parsed: any = await parse13F(content);

        // Robust extraction logic matching whale-tracker
        let keys = parsed ? Object.keys(parsed) : ["null"];
        const hasInfoTable = keys.includes('informationTable') || parsed?.edgarSubmission?.[0]?.formData?.[0]?.informationTable?.[0];

        if (!hasInfoTable) {
            // Fallback to fetch index if needed
            const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/index.json`;
            try {
                const indexRes = await fetch(indexUrl, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } });
                if (indexRes.ok) {
                    const indexData = await indexRes.json();
                    const items = indexData.directory?.item || [];
                    const infoTableFile = items.find((item: any) =>
                        (item.type && item.type.includes('INFORMATION TABLE')) ||
                        (item.name && item.name.includes('xml') && (item.name.toLowerCase().includes('information') || item.name.toLowerCase().includes('infotable')))
                    );
                    if (infoTableFile) {
                        targetUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/${infoTableFile.name}`;
                        content = await fetchFilingContent(targetUrl);
                        if (content) {
                            parsed = await parse13F(content);
                        }
                    }
                }
            } catch (e) { console.error("Index fetch error", e); }
        }

        const infoRoot = Array.isArray(parsed?.informationTable) ? parsed.informationTable[0] : parsed?.informationTable;
        const submissionRoot = Array.isArray(parsed?.edgarSubmission) ? parsed.edgarSubmission[0] : parsed?.edgarSubmission;
        const infoTableData = infoRoot || submissionRoot?.formData?.[0]?.informationTable?.[0];
        const rows = infoTableData?.infoTable || [];

        const holdingsMap = new Map<string, Holding>();

        for (const r of rows) {
            const issuer = r.nameOfIssuer?.[0] || "Unknown";
            const cusip = r.cusip?.[0];
            const val = parseFloat(r.value?.[0] || '0');
            const shrs = parseFloat(r.shrsOrPrnAmt?.[0]?.sshPrnamt?.[0] || '0');

            const key = cusip || issuer;
            if (!holdingsMap.has(key)) {
                holdingsMap.set(key, { issuer, cusip, value: val, shares: shrs });
            } else {
                const existing = holdingsMap.get(key)!;
                existing.value += val;
                existing.shares += shrs;
            }
        }

        // Normalization (Thousands vs Dollars)
        const parsedRows = Array.from(holdingsMap.values());
        const ratios = parsedRows.map(r => r.shares > 0 ? r.value / r.shares : 0).filter(r => r > 0);
        ratios.sort((a, b) => a - b);
        const median = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)] : 0;
        if (median > 4.0) {
            parsedRows.forEach(r => r.value = r.value / 1000);
            // Updating map after normalization
            parsedRows.forEach(r => {
                const key = r.cusip || r.issuer;
                const existing = holdingsMap.get(key);
                if (existing) existing.value = r.value;
            });
        }

        return {
            ticker,
            filingDate: recent.filingDate[filingIdx],
            holdings: holdingsMap
        };

    } catch (e) {
        console.error(`Error fetching ${ticker}`, e);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ticker1, ticker2 } = body;

        if (!ticker1 || !ticker2) {
            return NextResponse.json({ error: "Two tickers required" }, { status: 400 });
        }

        const [fundA, fundB] = await Promise.all([
            getFundHoldings(ticker1),
            getFundHoldings(ticker2)
        ]);

        if (!fundA || !fundB) {
            return NextResponse.json({ error: "Could not fetch data for one or both funds" }, { status: 404 });
        }

        // --- Overlap Logic ---
        const intersection: any[] = [];
        let overlapValueA = 0;
        let overlapValueB = 0;
        let uniqueA = 0;
        let uniqueB = 0;

        // Iterate Fund A to find matches in Fund B
        for (const [cusip, holdingA] of fundA.holdings.entries()) {
            if (fundB.holdings.has(cusip)) {
                // Match!
                const holdingB = fundB.holdings.get(cusip)!;
                intersection.push({
                    issuer: holdingA.issuer,
                    cusip: cusip,
                    valueA: holdingA.value,
                    valueB: holdingB.value,
                    sharesA: holdingA.shares,
                    sharesB: holdingB.shares,
                    combinedValue: holdingA.value + holdingB.value
                });
                overlapValueA += holdingA.value;
                overlapValueB += holdingB.value;
            } else {
                uniqueA++;
            }
        }

        // Count unique B
        for (const [cusip] of fundB.holdings.entries()) {
            if (!fundA.holdings.has(cusip)) {
                uniqueB++;
            }
        }

        // Sorting intersection by combined conviction (value)
        intersection.sort((a, b) => b.combinedValue - a.combinedValue);

        return NextResponse.json({
            fundA: {
                ticker: fundA.ticker,
                date: fundA.filingDate,
                totalHoldings: fundA.holdings.size,
                uniqueCount: uniqueA,
                overlapValue: overlapValueA
            },
            fundB: {
                ticker: fundB.ticker,
                date: fundB.filingDate,
                totalHoldings: fundB.holdings.size,
                uniqueCount: uniqueB,
                overlapValue: overlapValueB
            },
            overlap: {
                count: intersection.length,
                holdings: intersection.slice(0, 50) // Top 50 overlaps
            }
        });

    } catch (error: any) {
        console.error("[WhaleCluster] Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
