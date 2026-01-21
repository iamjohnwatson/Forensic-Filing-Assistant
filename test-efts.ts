
const SEC_USER_AGENT = "ForensicAnalyzer contact@example.com";

async function testEFTS() {
    const query = '"APPLE INC"'; // Exact phrase match
    console.log(`Searching for: ${query}`);

    try {
        const response = await fetch("https://efts.sec.gov/LATEST/search-index", {
            method: "POST",
            headers: {
                "User-Agent": SEC_USER_AGENT,
                "Content-Type": "application/json",
                "Origin": "https://www.sec.gov",
                "Referer": "https://www.sec.gov/"
            },
            body: JSON.stringify({
                q: query,
                forms: ["13F-HR"]
            })
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        const hits = data.hits?.hits || [];
        console.log(`Found ${hits.length} hits`);

        if (hits.length > 0) {
            console.log("Sample Hit:", JSON.stringify(hits[0], null, 2));

            // Print top 5 filers
            console.log("\nTop 5 Filers:");
            hits.slice(0, 5).forEach((h: any) => {
                const source = h._source;
                console.log(`- ${source.entity} (CIK: ${h._id}) - Date: ${source.file_date}`);
            });
        }

    } catch (error) {
        console.error("Fetch failed:", error);
    }
}

testEFTS();
