
const https = require('https');

function checkUrl(url) {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'HEAD', headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } }, (res) => {
            console.log(`URL: ${url} => Status: ${res.statusCode}`);
            resolve(res.statusCode);
        });
        req.on('error', (e) => {
            console.log(`URL: ${url} => Error: ${e.message}`);
            resolve(500);
        });
        req.end();
    });
}

async function debug() {
    const cik = "1652044";
    const acc = "000165204425000096";

    // 1. Root URL (as implied by index.json name)
    const rootUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/information_table.xml`;

    // 2. Subdir URL (as provided by user)
    const subdirUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/xslForm13F_X02/information_table.xml`;

    await checkUrl(rootUrl);
    await checkUrl(subdirUrl);
}

debug();
