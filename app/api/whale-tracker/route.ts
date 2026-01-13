import { NextRequest, NextResponse } from 'next/server';
// Force rebuild - Debugging XML Structure
import { fetchCIK, fetchSubmission, generateSecUrl, fetchFilingContent, parse13F } from '@/lib/sec-client';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ticker } = body;

        console.log(`[WhaleTracker] Analyzing ${ticker}...`);

        if (!ticker) return NextResponse.json({ error: "Ticker is required" }, { status: 400 });

        const cik = await fetchCIK(ticker);
        if (!cik) return NextResponse.json({ error: "Ticker not found" }, { status: 404 });

        const submission = await fetchSubmission(cik);
        if (!submission) return NextResponse.json({ error: "No filings found" }, { status: 404 });

        // I'm filtering the history for just '13F-HR' forms.
        const recent = submission.filings.recent;
        const filingIndices: number[] = [];
        for (let i = 0; i < recent.form.length; i++) {
            if (recent.form[i] === '13F-HR') {
                filingIndices.push(i);
                if (filingIndices.length === 2) break; // I only need the last two to make a comparison.
            }
        }

        if (filingIndices.length < 2) return NextResponse.json({ error: "Need at least 2 13F-HR filings." }, { status: 404 });

        const currIdx = filingIndices[0];
        const prevIdx = filingIndices[1];

        // Just logging these details so I can debug if the dates or accession numbers look wrong.
        console.log(`[WhaleTracker] Found Filings: 
            Curr: ${recent.filingDate[currIdx]} (Acc: ${recent.accessionNumber[currIdx]}, Doc: ${recent.primaryDocument[currIdx]})
            Prev: ${recent.filingDate[prevIdx]} (Acc: ${recent.accessionNumber[prevIdx]}, Doc: ${recent.primaryDocument[prevIdx]})`);

        // This helper function handles the messy part of fetching the actual XML content.
        // It has a fallback mechanism because sometimes the primary document isn't the actual data table.
        const getHoldings = async (cik: string, accessionNumber: string, primaryDocument: string, label: string) => {
            const accessionNoDash = accessionNumber.replace(/-/g, '');
            let targetUrl = generateSecUrl(cik, accessionNumber, primaryDocument);

            console.log(`[WhaleTracker] Initial URL for ${label}: ${targetUrl}`);

            // 1. I start by trying to fetch the Primary Document directly.
            let content = await fetchFilingContent(targetUrl);

            if (!content) {
                console.error(`[WhaleTracker] Failed to fetch content for ${label}`);
                return [];
            }

            // Attempting to parse the XML...
            let parsed = await parse13F(content);
            let keys = parsed ? Object.keys(parsed) : ["null"];
            console.log(`[WhaleTracker] Parsed XML Keys via Primary Doc for ${label}:`, keys);

            // 2. CHECK IF THIS IS JUST THE COVER PAGE (edgarSubmission)
            // If the parsed XML doesn't have an 'informationTable' key, I know I'm probably looking at a cover page
            // and need to dig deeper into the index to find the actual data file.
            const hasInfoTable = keys.includes('informationTable') || parsed?.edgarSubmission?.[0]?.formData?.[0]?.informationTable?.[0];

            if (!hasInfoTable) {
                console.log(`[WhaleTracker] ${label} missing content (or failed parse). Looking for Information Table in index.json...`);

                // So I'll fetch the index.json for this submission to find the real XML file.
                // URL format: https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/index.json
                const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/index.json`;

                try {
                    const indexRes = await fetch(indexUrl, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } });
                    if (indexRes.ok) {
                        const indexData = await indexRes.json();
                        // I'm looking for a document explicitly labeled 'INFORMATION TABLE' or an xml file with 'info' in the name.
                        const items = indexData.directory?.item || [];
                        const infoTableFile = items.find((item: any) =>
                            (item.type && item.type.includes('INFORMATION TABLE')) ||
                            (item.name && item.name.includes('xml') && (item.name.toLowerCase().includes('information') || item.name.toLowerCase().includes('infotable')))
                        );

                        if (infoTableFile) {
                            console.log(`[WhaleTracker] Found Information Table file for ${label}: ${infoTableFile.name}`);
                            targetUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/${infoTableFile.name}`;

                            // Refetching the content now that I have the correct URL.
                            content = await fetchFilingContent(targetUrl);
                            if (content) {
                                parsed = await parse13F(content);
                                console.log(`[WhaleTracker] Parsed Structure for ${label}:`, JSON.stringify(parsed, null, 2).substring(0, 500));
                            }
                        } else {
                            console.warn(`[WhaleTracker] Could not find Information Table file in index for ${label}`);
                        }
                    } else {
                        console.warn(`[WhaleTracker] Failed to fetch index.json (status ${indexRes.status})`);
                    }
                } catch (err) {
                    console.error(`[WhaleTracker] Failed to fetch/parse index.json for ${label}`, err);
                }
            }

            // Normalizing the extraction path because the SEC XML structure varies wildly.
            const infoRoot = Array.isArray(parsed?.informationTable) ? parsed.informationTable[0] : parsed?.informationTable;
            const submissionRoot = Array.isArray(parsed?.edgarSubmission) ? parsed.edgarSubmission[0] : parsed?.edgarSubmission;

            const infoTableData = infoRoot || submissionRoot?.formData?.[0]?.informationTable?.[0];
            const rows = infoTableData?.infoTable || [];

            console.log(`[WhaleTracker] Extracted ${rows.length} rows for ${label}`);

            return rows.map((r: any) => ({
                issuer: r.nameOfIssuer?.[0] || "Unknown",
                cusip: r.cusip?.[0],
                value: parseFloat(r.value?.[0] || '0'),
                shares: parseFloat(r.shrsOrPrnAmt?.[0]?.sshPrnamt?.[0] || '0'),
                sshPrnamtType: r.shrsOrPrnAmt?.[0]?.sshPrnamtType?.[0] || 'SH'
            }));
        };

        const [currHoldings, prevHoldings] = await Promise.all([
            getHoldings(cik, recent.accessionNumber[currIdx], recent.primaryDocument[currIdx], "Current"),
            getHoldings(cik, recent.accessionNumber[prevIdx], recent.primaryDocument[prevIdx], "Previous")
        ]);

        // --- Comparison Logic ---
        // I'm building a map of the previous holdings to make the comparison logic cleaner and faster (O(n)).
        const comparison = [];
        const prevMap = new Map();
        prevHoldings.forEach((h: any) => prevMap.set(h.cusip, h));

        for (const curr of currHoldings) {
            const prev = prevMap.get(curr.cusip);
            const prevShares = prev ? prev.shares : 0;
            const change = curr.shares - prevShares;
            // Calculating percent change, handling the divide by zero edge case.
            const percentChange = prevShares > 0 ? ((change / prevShares) * 100) : (change > 0 ? 100 : 0);

            comparison.push({
                ticker: curr.ticker || "N/A",
                issuer: curr.issuer,
                cusip: curr.cusip,
                sharesCurr: curr.shares,
                sharesPrev: prevShares,
                change: change,
                percentChange: percentChange,
                value: curr.value
            });
            // I remove it from the map so I know which ones in 'prev' were completely sold off.
            if (prev) prevMap.delete(curr.cusip);
        }

        // Everything left in prevMap was sold entirely (shares went to 0).
        for (const [cusip, prev] of prevMap.entries()) {
            comparison.push({
                issuer: prev.issuer,
                cusip: cusip,
                sharesCurr: 0,
                sharesPrev: prev.shares,
                change: -prev.shares,
                percentChange: -100, // 100% drop
                value: 0
            });
        }

        // Sorting by value to show the most significant holdings first.
        comparison.sort((a, b) => b.value - a.value);

        const topHoldings = comparison.slice(0, 5);
        const topBuys = comparison.filter(x => x.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
        const topSells = comparison.filter(x => x.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);

        return NextResponse.json({
            ticker,
            filingDateCurr: recent.filingDate[currIdx],
            filingDatePrev: recent.filingDate[prevIdx],
            topHoldings,
            topBuys,
            topSells,
            allChanges: comparison
        });

    } catch (error: any) {
        console.error("[WhaleTracker] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
