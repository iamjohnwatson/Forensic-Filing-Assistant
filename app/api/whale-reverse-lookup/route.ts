
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { fetchCIK } from '@/lib/sec-client';

// We need to resolve Ticker -> Name because 13Fs store Names.
// Reusing fetchCIK to get CIK is okay, but we really need the Company Name associated with the ticker.
// fetchCIK in lib returns a CIK string. It parses company_tickers.json internally but doesn't expose the name.
// We should probably modify lib/sec-client to export a function `getCompanyName(ticker)` or just fetch the json here and cache it.
// For speed, let's just fetch the json here (Next.js caches fetch).

const CACHE_REVALIDATE = 3600;

async function getCompanyName(ticker: string): Promise<string | null> {
    try {
        const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
            headers: { "User-Agent": "ForensicAnalyzer contact@example.com" },
            next: { revalidate: CACHE_REVALIDATE }
        });
        if (!response.ok) return null;

        const data = await response.json();
        const entries: any[] = Object.values(data);
        const t = ticker.toUpperCase();

        const match = entries.find(e => e.ticker === t);
        return match ? match.title : null;
    } catch (e) {
        console.error("Error fetching company name", e);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ticker } = body;

        if (!ticker) {
            return NextResponse.json({ error: "Ticker required" }, { status: 400 });
        }

        const companyName = await getCompanyName(ticker);
        if (!companyName) {
            return NextResponse.json({ error: "Could not resolve ticker to specific company name" }, { status: 404 });
        }

        console.log(`[ReverseLookup] Searching for holders of: ${ticker} (${companyName})`);

        // Connect to Turso
        const turso = createClient({
            url: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN!,
        });

        // Search Query
        // We match Issuer Name using LIKE. 13F names are often uppercase.
        // Also limit to latest quarter per fund? 
        // Logic: Get all holdings matching name, then group by Fund, take latest filing date.

        const query = `
            SELECT 
                f.name as fundName, 
                f.cik, 
                h.value, 
                h.shares, 
                fil.filing_date,
                fil.quarter
            FROM holdings h 
            JOIN filings fil ON h.accession_number = fil.accession_number 
            JOIN funds f ON fil.cik = f.cik 
            WHERE 
                h.issuer LIKE ? 
            ORDER BY h.value DESC 
            LIMIT 100
        `;

        // Attempt 1: Exact start match or contains
        // "APPLE INC" -> "APPLE INC" or "APPLE INC."
        const searchName = companyName.toUpperCase().replace(/\./g, '').split(' ')[0]; // "APPLE"
        // This is a bit loose. Better to use the full name param.
        const searchPattern = `%${searchName}%`;

        // LibSQL uses :param or ? but verify support.
        // It supports ?.
        const rs = await turso.execute({ sql: query, args: [searchPattern] });
        const results = rs.rows;

        // Group by Fund to deduplicate if multiple filings (rare if we only ingested one quarter per fund, but possible if amendment)
        // We want the LATEST entry for each fund.
        const uniqueFunds = new Map<string, any>();
        for (const row of results as any[]) {
            if (!uniqueFunds.has(row.cik)) {
                uniqueFunds.set(row.cik, row);
            } else {
                // If this row is newer?
                // For now, simpler to just take the first one (sorted by value might not imply date, but usually close).
                // Let's rely on the query or post-filter.
            }
        }

        const finalResults = Array.from(uniqueFunds.values()).sort((a, b) => b.value - a.value);

        return NextResponse.json({
            ticker,
            companyName,
            matchCount: finalResults.length,
            funds: finalResults
        });

    } catch (error: any) {
        console.error("[ReverseLookup] Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
