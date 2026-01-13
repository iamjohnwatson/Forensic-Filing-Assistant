
const https = require('https');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } }, (res) => {
            if (res.statusCode !== 200) {
                console.log("Status:", res.statusCode);
                resolve([]);
                return;
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function debug() {
    console.log("Checking Mutual Funds list...");
    const data = await fetchJson("https://www.sec.gov/files/company_tickers_mf.json");
    if (data && data.data) {
        console.log(`MF entries: ${data.data.length}`);
        // data.data is array of arrays [cik, seriesId, classId, symbol]
        const pif = data.data.find(d => d[3].toLowerCase() === 'pif' || d[3].toLowerCase() === 'public investment');
        if (pif) console.log("Found in MF:", pif);
        else console.log("Not found in MF list.");
    } else {
        console.log("No data/different format.");
    }
}

debug();
