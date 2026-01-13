
const https = require('https');

const url = "https://www.sec.gov/Archives/edgar/data/1652044/000165204425000096/xslForm13F_X02/information_table.xml";

console.log("Fetching:", url);
https.get(url, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } }, (res) => {
    console.log("Status:", res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Content Length:", data.length);
        console.log("First 500 chars:");
        console.log("---------------------------------------------------");
        console.log(data.substring(0, 500));
        console.log("---------------------------------------------------");
    });
}).on('error', (e) => {
    console.error("Error:", e);
});
