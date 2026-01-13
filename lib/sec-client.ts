import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';

const SEC_USER_AGENT = "ForensicAnalyzer contact@example.com"; // Replace with real info in prod

interface CompanyTicker {
    cik_str: number;
    ticker: string;
    title: string;
}

export interface SecSubmission {
    cik: string;
    entityType: string;
    sic: string;
    sicDescription: string;
    name: string;
    tickers: string[];
    exchanges: string[];
    ein: string;
    description: string;
    website: string;
    investorWebsite: string;
    category: string;
    fiscalYearEnd: string;
    stateOfIncorporation: string;
    stateOfIncorporationDescription: string;
    addresses: {
        mailing: {
            street1: string;
            city: string;
            stateOrCountry: string;
            zipCode: string;
            stateOfIncorporation: string;
        };
        business: {
            street1: string;
            city: string;
            stateOrCountry: string;
            zipCode: string;
            stateOfIncorporation: string;
        };
    };
    phone: string;
    flags: string;
    filings: {
        recent: {
            accessionNumber: string[];
            filingDate: string[];
            reportDate: string[];
            acceptanceDateTime: string[];
            act: string[];
            form: string[];
            fileNumber: string[];
            filmNumber: string[];
            items: string[];
            size: number[];
            isXBRL: number[];
            isInlineXBRL: number[];
            primaryDocument: string[];
            primaryDocDescription: string[];
        };
    };
}

export async function fetchCIK(query: string): Promise<string | null> {
    // 0. If I get a direct numeric CIK, I just pad it and return it immediately.
    if (/^\d{1,10}$/.test(query)) {
        return query.padStart(10, '0');
    }

    try {
        const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
            headers: { "User-Agent": SEC_USER_AGENT },
            next: { revalidate: 86400 } // I'm caching this for a day because company tickers don't change that often.
        });

        if (!response.ok) throw new Error("Failed to fetch company tickers");

        const data = await response.json();
        // The data comes back as an object where keys are indices, so I'll convert it to an array.

        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        const entries = Object.values(data) as CompanyTicker[];

        // 1. First, I check for an exact ticker match.
        let entry = entries.find((item) => item.ticker === queryUpper);

        // 2. If that fails, I try an exact title match (case-insensitive).
        if (!entry) {
            entry = entries.find((item) => item.title.toLowerCase() === queryLower);
        }

        // 3. Finally, I'll try a fuzzy match if the earlier checks failed.
        if (!entry) {
            const matches = entries.filter((item) => item.title.toLowerCase().includes(queryLower));
            if (matches.length > 0) {
                // Heuristic: I pick the shortest title assuming it's the most relevant "root" company name.
                matches.sort((a, b) => a.title.length - b.title.length);
                entry = matches[0];
            }
        }

        if (entry && (entry as any).cik_str) {
            return (entry as any).cik_str.toString().padStart(10, '0');
        }

        return null;
    } catch (error) {
        console.error("Error fetching CIK:", error);
        return null;
    }
}

export async function fetchSubmission(cik: string): Promise<SecSubmission | null> {
    try {
        const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
            headers: { "User-Agent": SEC_USER_AGENT },
            next: { revalidate: 3600 }
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching submission:", error);
        return null;
    }
}

export async function fetchFilingContent(url: string): Promise<string | null> {
    try {
        const response = await fetch(url, {
            headers: { "User-Agent": SEC_USER_AGENT },
        });
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        console.error("Error fetching filing content:", error);
        return null;
    }
}

export async function parse13F(xmlContent: string) {
    try {
        const result = await parseStringPromise(xmlContent, {
            tagNameProcessors: [(name) => name.split(':').pop() || name], // I'm stripping namespaces manually to make traversing the object easier.
            explicitArray: true
        });
        return result;
    } catch (e) {
        console.error("Error parsing 13F XML", e);
        return null;
    }
}

export function generateSecUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
    const accessionNoDash = accessionNumber.replace(/-/g, '');
    return `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/${primaryDocument}`;
}
