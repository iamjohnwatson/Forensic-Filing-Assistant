
import { fetchFilingContent } from './lib/sec-client';

async function debug() {
    const cik = "1652044";
    const acc = "000165204425000096";
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/index.json`;

    console.log("Fetching index from:", url);
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "ForensicAnalyzer contact@example.com" }
        });
        if (!res.ok) {
            console.log("Failed:", res.status, res.statusText);
            return;
        }
        const data = await res.json();
        console.log("Directory Items:");
        data.directory.item.forEach((item: any) => {
            console.log(`- Type: ${item.type}, Name: ${item.name}, Size: ${item.size}`);
        });

    } catch (e) {
        console.error(e);
    }
}

debug();
