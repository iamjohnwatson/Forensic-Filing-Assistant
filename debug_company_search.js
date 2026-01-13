
const https = require('https');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function debug() {
    console.log("Fetching company_tickers.json...");
    try {
        const data = await fetchJson("https://www.sec.gov/files/company_tickers.json");
        const entries = Object.values(data);
        console.log(`Total entries: ${entries.length}`);

        const queries = ["Public Investment Fund", "Saudi", "PIF", "BlackRock"];

        queries.forEach(q => {
            const qLower = q.toLowerCase();
            // Exact Title
            let match = entries.find(e => e.title.toLowerCase() === qLower);
            if (match) {
                console.log(`[${q}] Exact Match: ${match.title} (CIK: ${match.cik_str})`);
            } else {
                // Fuzzy
                const matches = entries.filter(e => e.title.toLowerCase().includes(qLower));
                if (matches.length > 0) {
                    console.log(`[${q}] Fuzzy Matches (${matches.length}):`);
                    matches.slice(0, 5).forEach(m => console.log(`  - ${m.title} (CIK: ${m.cik_str})`));
                } else {
                    console.log(`[${q}] No match found.`);
                }
            }
        });

    } catch (e) {
        console.error(e);
    }
}

debug();
