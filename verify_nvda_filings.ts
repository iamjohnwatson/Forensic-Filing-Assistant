
import { fetchCIK, fetchSubmission, generateSecUrl, fetchFilingContent, parse13F } from './lib/sec-client';

async function verify() {
    const ticker = "NVDA";
    console.log(`[Verify] Analyzing ${ticker}...`);

    const cik = await fetchCIK(ticker);
    if (!cik) { console.log("No CIK"); return; }
    console.log("CIK:", cik);

    const submission = await fetchSubmission(cik);
    if (!submission) { console.log("No Submission"); return; }

    const recent = submission.filings.recent;
    const filingIndices: number[] = [];
    for (let i = 0; i < recent.form.length; i++) {
        if (recent.form[i] === '13F-HR') { // STRICTLY 13F-HR
            filingIndices.push(i);
            if (filingIndices.length === 2) break;
        }
    }

    if (filingIndices.length < 2) { console.log("Not enough filings"); return; }

    const currIdx = filingIndices[0];
    const prevIdx = filingIndices[1];

    console.log(`Comparing: ${recent.filingDate[currIdx]} vs ${recent.filingDate[prevIdx]}`);

    const getHoldings = async (idx: number, label: string) => {
        const acc = recent.accessionNumber[idx];
        const primDoc = recent.primaryDocument[idx];
        const accDash = acc.replace(/-/g, '');

        let targetUrl = generateSecUrl(cik, acc, primDoc);

        // Simulating the route logic (assuming the fix is applied)
        // We know we need to check index for modern filings usually
        // But let's try primDoc first then fallback
        let content = await fetchFilingContent(targetUrl);
        let parsed = await parse13F(content!);

        let keys = parsed ? Object.keys(parsed) : ["null"];
        const hasInfoTable = keys.includes('informationTable') || parsed?.edgarSubmission?.[0]?.formData?.[0]?.informationTable?.[0]; // rough check

        if (!hasInfoTable) {
            console.log(`[Verify] ${label} fetching from index...`);
            const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accDash}/index.json`;
            const res = await fetch(indexUrl, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } });
            const data = await res.json();
            const item = data.directory.item.find((i: any) =>
                (i.type && i.type.includes('INFORMATION TABLE')) ||
                (i.name && i.name.includes('xml') && (i.name.includes('information') || i.name.includes('infotable')))
            );
            if (item) {
                targetUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accDash}/${item.name}`;
                content = await fetchFilingContent(targetUrl);
                parsed = await parse13F(content!);
            }
        }

        const infoRoot = Array.isArray(parsed?.informationTable) ? parsed.informationTable[0] : parsed?.informationTable;
        const rows = infoRoot?.infoTable || [];
        return rows.map((r: any) => ({
            issuer: r.nameOfIssuer?.[0],
            shares: parseFloat(r.shrsOrPrnAmt?.[0]?.sshPrnamt?.[0] || '0')
        }));
    };

    const curr = await getHoldings(currIdx, "Current");
    const prev = await getHoldings(prevIdx, "Previous");

    console.log(`Current Holdings: ${curr.length}`);
    console.log(`Previous Holdings: ${prev.length}`);

    // Compare specific holdings
    curr.forEach((c: any) => {
        const p = prev.find((x: any) => x.issuer === c.issuer);
        if (p) {
            console.log(`[${c.issuer}] Curr: ${c.shares}, Prev: ${p.shares}, Diff: ${c.shares - p.shares}`);
        } else {
            console.log(`[${c.issuer}] NEW POSITION: ${c.shares}`);
        }
    });
}

verify();
