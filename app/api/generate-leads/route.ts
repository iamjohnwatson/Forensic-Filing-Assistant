import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { fetchCIK, fetchSubmission, fetchFilingContent, generateSecUrl } from "@/lib/sec-client";
import * as cheerio from 'cheerio';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ticker } = body;

        console.log(`[CorporateIntel] Starting comparative analysis for ${ticker}...`);

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Server missing API Key config" }, { status: 500 });
        }

        // 1. Resolve CIK & Filings
        const cik = await fetchCIK(ticker);
        if (!cik) return NextResponse.json({ error: "Ticker not found" }, { status: 404 });

        const submission = await fetchSubmission(cik);
        if (!submission) return NextResponse.json({ error: "No filings found" }, { status: 404 });

        const recent = submission.filings.recent;

        // 2. Helper to find specific filings
        const findFilingIndex = (formType: string, skip: number = 0) => {
            let count = 0;
            for (let i = 0; i < recent.form.length; i++) {
                if (recent.form[i] === formType) {
                    if (count === skip) return i;
                    count++;
                }
            }
            return -1;
        };

        const findFilingByDate = (formType: string, targetDateStr: string) => {
            // targetDateStr format YYYY-MM-DD
            // Find filing with closest date to target
            const target = new Date(targetDateStr).getTime();
            let bestIdx = -1;
            let minDiff = Infinity;

            for (let i = 0; i < recent.form.length; i++) {
                if (recent.form[i] === formType) {
                    const fDate = new Date(recent.filingDate[i]).getTime();
                    const diff = Math.abs(fDate - target);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestIdx = i;
                    }
                }
            }
            // Threshold: Must be within 30 days to be considered "Same Quarter"
            if (minDiff > 30 * 24 * 60 * 60 * 1000) return -1;
            return bestIdx;
        };

        // 3. Identify Target Indices
        const idxK_Curr = findFilingIndex("10-K", 0);
        const idxK_Prev = findFilingIndex("10-K", 1);

        const idxQ_Curr = findFilingIndex("10-Q", 0);
        const idxQ_Prev = findFilingIndex("10-Q", 1); // QoQ

        let idxQ_YoY = -1;
        if (idxQ_Curr !== -1) {
            const dateCurr = new Date(recent.filingDate[idxQ_Curr]);
            dateCurr.setFullYear(dateCurr.getFullYear() - 1); // Subtract 1 year
            idxQ_YoY = findFilingByDate("10-Q", dateCurr.toISOString().split('T')[0]);
        }

        // 4. Fetch Texts (Parallel)
        const fetchText = async (idx: number, label: string) => {
            if (idx === -1) return "";
            const url = generateSecUrl(cik, recent.accessionNumber[idx], recent.primaryDocument[idx]);
            console.log(`[CorporateIntel] Fetching ${label} (${recent.filingDate[idx]}): ${url}`);
            const html = await fetchFilingContent(url);
            if (!html) return "";
            const $ = cheerio.load(html);
            // Limit text size to avoid token limits. For comparative, we need summaries.
            // Aggressive cleaning to keep it dense.
            return $('body').text().replace(/\s+/g, ' ').substring(0, 15000);
        };

        const [kCurr, kPrev, qCurr, qPrev, qYoY] = await Promise.all([
            fetchText(idxK_Curr, "10-K Current"),
            fetchText(idxK_Prev, "10-K Previous"),
            fetchText(idxQ_Curr, "10-Q Current"),
            fetchText(idxQ_Prev, "10-Q Previous"),
            fetchText(idxQ_YoY, "10-Q YoY")
        ]);

        if (!kCurr && !qCurr) {
            return NextResponse.json({ error: "Could not retrieve sufficient filing text" }, { status: 404 });
        }

        const model = genai.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" } });

        const prompt = `
        You are a top-tier Business Intelligence & Supply Chain Analyst. 
        Perform a deep commercial analysis of ${ticker} based on the comparative filing inputs below.
        
        INPUTS:
        - 10-K (Current): ${kCurr ? "Provided" : "Missing"}
        - 10-K (Previous): ${kPrev ? "Provided" : "Missing"}
        - 10-Q (Current): ${qCurr ? "Provided" : "Missing"}
        - 10-Q (Prev Quarter): ${qPrev ? "Provided" : "Missing"}
        - 10-Q (Year Ago): ${qYoY ? "Provided" : "Missing"}

        TEXT DATA (Truncated):
        === 10-K CURRENT ===
        ${kCurr}
        === 10-K PREVIOUS ===
        ${kPrev}
        === 10-Q CURRENT ===
        ${qCurr}
        === 10-Q PREVIOUS (QoQ) ===
        ${qPrev}
        === 10-Q YEAR AGO (YoY) ===
        ${qYoY}
        
        TASK:
        Generate a structured JSON analysis. Use **HTML TAGS** (<h3>, <p>, <ul>, <li>, <strong>) for formatting inside the strings. DO NOT use Markdown.

        REQUIREMENTS:

        1. "annual_strategy": Compare Current vs Previous 10-K.
           - **Scope**:
             - 🚢 **Supply Chain Deep Dive**: Identify specific Customer/Supplier names, % of revenue, and dependency risks.
             - 🌍 **Strategic Shifts**: Compare the "Business" section description. What changed? New markets? Terminated product lines?
             - 🚩 **Critical Risks**: New "Risk Factors" that threaten the core business model (not generic boilerplate).
           - **Style**: Professional, readable, use bullet points for lists.

        2. "quarterly_momentum":
           - "qoq": Compare Current vs Previous 10-Q.
             - **Scope**: Sequential changes in revenue mix, inventory build-ups (operational flag), and immediate headwinds.
           - "yoy": Compare Current vs Year-Ago 10-Q.
             - **Scope**: Structural growth trends, effectiveness of new product launches, and year-over-year margin evolution.
        
        OUTPUT JSON FORMAT:
        {
          "annual_strategy": "HTML string (e.g., <h3>Supply Chain</h3><p>...</p>)",
          "quarterly_momentum": {
            "qoq": "HTML string...",
            "yoy": "HTML string..."
          }
        }
        
        Do not acknowledge. Return strictly syntactically valid JSON.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json(JSON.parse(text));

    } catch (error: any) {
        console.error("Gemini Comparative Error:", error);
        return NextResponse.json({ error: error.message || "AI Analysis Failed" }, { status: 500 });
    }
}
