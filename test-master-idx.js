
const fs = require('fs');
const https = require('https');

const SEC_USER_AGENT = "ForensicAnalyzer contact@example.com";

async function fetchMasterIndex() {
    const url = "https://www.sec.gov/Archives/edgar/full-index/2024/QTR4/master.idx";
    console.log(`Fetching: ${url}`);

    const options = {
        headers: { "User-Agent": SEC_USER_AGENT }
    };

    https.get(url, options, (res) => {
        if (res.statusCode !== 200) {
            console.error(`Failed: ${res.statusCode}`);
            return;
        }

        let data = '';
        let lines = 0;
        res.on('data', (chunk) => {
            if (lines < 20) {
                const chunkStr = chunk.toString();
                data += chunkStr;
                lines += chunkStr.split('\n').length;
                if (lines >= 20) {
                    console.log("--- HEADER SAMPLE ---");
                    console.log(data.split('\n').slice(0, 20).join('\n'));
                    res.destroy(); // Stop downloading
                }
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

fetchMasterIndex();
