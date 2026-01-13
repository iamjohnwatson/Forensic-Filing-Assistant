
import { fetchCIK, fetchSubmission, generateSecUrl, fetchFilingContent, parse13F } from './lib/sec-client';

async function simulate() {
    const ticker = "GOOGL";
    console.log(`[Sim] Analyzing ${ticker}...`);

    const cik = await fetchCIK(ticker);
    if (!cik) { console.log("No CIK"); return; }
    console.log("CIK:", cik);

    const submission = await fetchSubmission(cik);
    if (!submission) { console.log("No Submission"); return; }

    const recent = submission.filings.recent;
    const filingIndices: number[] = [];
    for (let i = 0; i < recent.form.length; i++) {
        if (recent.form[i] === '13F-HR') {
            filingIndices.push(i);
            if (filingIndices.length === 2) break;
        }
    }

    if (filingIndices.length === 0) { console.log("No filings"); return; }
    const currIdx = filingIndices[0];

    // Simulate getHoldings for Current
    const accessionNumber = recent.accessionNumber[currIdx];
    const primaryDocument = recent.primaryDocument[currIdx];
    const label = "Current";

    const accessionNoDash = accessionNumber.replace(/-/g, '');
    let targetUrl = generateSecUrl(cik, accessionNumber, primaryDocument);
    console.log(`[Sim] Initial URL: ${targetUrl}`);

    let content = await fetchFilingContent(targetUrl);
    if (!content) { console.log("Initial fetch failed"); return; }

    let parsed = await parse13F(content);
    let keys = parsed ? Object.keys(parsed) : ["null"];
    console.log(`[Sim] Primary Keys:`, keys);

    const hasInfoTable = keys.includes('informationTable');

    // REMOVED '&& keys.includes('edgarSubmission')' to force fallback if primary parsing fails
    if (!hasInfoTable) {
        console.log(`[Sim] Cover Page detected (or parse failed). Checking index...`);
        const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/index.json`;
        console.log(`[Sim] Index URL: ${indexUrl}`);

        const res = await fetch(indexUrl, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } });
        const indexData = await res.json();
        const items = indexData.directory?.item || [];

        const infoTableFile = items.find((item: any) =>
            (item.type && item.type.includes('INFORMATION TABLE')) ||
            (item.name && item.name.includes('xml') && (item.name.toLowerCase().includes('information') || item.name.toLowerCase().includes('infotable')))
        );

        if (infoTableFile) {
            console.log(`[Sim] Found file: ${infoTableFile.name}`);
            targetUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionNoDash}/${infoTableFile.name}`;
            console.log(`[Sim] New Target: ${targetUrl}`);

            content = await fetchFilingContent(targetUrl);
            parsed = await parse13F(content!);
            const newKeys = parsed ? Object.keys(parsed) : ["null"];
            console.log(`[Sim] New Parsed Keys:`, newKeys);

            // Check structure
            // Debugging showed parsed.informationTable is an OBJECT (the root), not an array
            const infoRoot = Array.isArray(parsed?.informationTable) ? parsed.informationTable[0] : parsed?.informationTable;
            const submissionRoot = Array.isArray(parsed?.edgarSubmission) ? parsed.edgarSubmission[0] : parsed?.edgarSubmission;

            const infoTableData = infoRoot || submissionRoot?.formData?.[0]?.informationTable?.[0];
            const rows = infoTableData?.infoTable || [];
            console.log(`[Sim] Rows found: ${rows.length}`);
            if (rows.length > 0) {
                console.log("Sample Row:", JSON.stringify(rows[0]));
            }
        } else {
            console.log("[Sim] Could not find info table file in index.");
        }
    }
}

simulate();
