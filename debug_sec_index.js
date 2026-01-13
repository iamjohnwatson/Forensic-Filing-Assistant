
const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { "User-Agent": "ForensicAnalyzer contact@example.com" } }, (res) => {
            let data = '';
            res.on('data', check => data += check);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function debug() {
    const cik = "1652044";
    const acc = "000165204425000096"; // Dashing: 0001652044-25-000096
    const accDash = "0001652044-25-000096";
    // Wait, the API usually takes the NON-dashed accession for the directory URL, 
    // BUT the JSON API uses .../data/cik/accDash/index.json ??
    // Let's verify the URL convention.
    // Standard EDGAR web archive: https://www.sec.gov/Archives/edgar/data/1652044/000165204425000096/index.json -- NO DASHES in directory usually?
    // Actually, usually it IS bare accession. 
    // Let's try both if one fails.

    // User provided: https://www.sec.gov/Archives/edgar/data/1652044/000165204425000096/xslForm13F_X02/information_table.xml
    // This confirms NO DASHES in the directory path for this specific filing.

    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc}/index.json`;

    console.log("Fetching index from:", url);
    try {
        const raw = await fetchUrl(url);
        // console.log("Row:", raw.substring(0, 100));
        const data = JSON.parse(raw);
        console.log("Directory Items:");
        if (data.directory && data.directory.item) {
            data.directory.item.forEach((item) => {
                if (item.name.includes('xml')) {
                    console.log(`- Type: ${item.type}, Name: ${item.name}, Size: ${item.size}`);
                }
            });
        } else {
            console.log("No directory items found or wrong format.");
            console.log(JSON.stringify(data, null, 2).substring(0, 500));
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

debug();
