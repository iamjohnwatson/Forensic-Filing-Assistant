
import { parse13F, fetchFilingContent } from './lib/sec-client';

async function debug() {
    // The URL that we think is correct (ROOT, not xsl subdir)
    const url = "https://www.sec.gov/Archives/edgar/data/1652044/000165204425000096/information_table.xml";

    console.log("Fetching:", url);
    const content = await fetchFilingContent(url);
    if (!content) {
        console.log("Failed to fetch.");
        return;
    }

    console.log("Parsing...");
    console.log("Content Head:", content.substring(0, 500));
    const parsed = await parse13F(content);

    console.log("Parsed Keys:", Object.keys(parsed || {}));

    if (parsed && parsed.informationTable) {
        console.log("Is Array?", Array.isArray(parsed.informationTable));
        console.log("Structure:", JSON.stringify(parsed.informationTable, null, 2).substring(0, 5000));
    } else {
        console.log("No informationTable found.");
        console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
    }
}

debug();
