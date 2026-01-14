
// Heuristic mapping for major companies often found in 13F filings.
// In a real production app, this would query a market data API (e.g., Polygon, FMP).

const SECTOR_MAP: Record<string, string> = {
    "APPLE INC": "Technology",
    "MICROSOFT CORP": "Technology",
    "AMAZON COM INC": "Consumer Cyclical",
    "NVIDIA CORP": "Technology",
    "ALPHABET INC": "Technology",
    "META PLATFORMS INC": "Technology",
    "TESLA INC": "Consumer Cyclical",
    "BERKSHIRE HATHAWAY INC": "Financial Services",
    "JPMORGAN CHASE & CO": "Financial Services",
    "VISA INC": "Financial Services",
    "JOHNSON & JOHNSON": "Healthcare",
    "WALMART INC": "Consumer Defensive",
    "PROCTER & GAMBLE CO": "Consumer Defensive",
    "MASTERCARD INC": "Financial Services",
    "EXXON MOBIL CORP": "Energy",
    "CHEVRON CORP": "Energy",
    "HOME DEPOT INC": "Consumer Cyclical",
    "ABBVIE INC": "Healthcare",
    "MERCK & CO INC": "Healthcare",
    "COSTCO WHOLESALE CORP": "Consumer Defensive",
    "ADOBE INC": "Technology",
    "SALESFORCE INC": "Technology",
    "DISNEY WALT CO": "Communication Services",
    "CISCO SYSTEMS INC": "Technology",
    "NETFLIX INC": "Communication Services",
    "AMD": "Technology",
    "INTEL CORP": "Technology",
    "COCA COLA CO": "Consumer Defensive",
    "PEPSICO INC": "Consumer Defensive",
    "BANK OF AMERICA CORP": "Financial Services",
    "WELLS FARGO & CO": "Financial Services",
    "MCDONALDS CORP": "Consumer Cyclical",
    "NIKE INC": "Consumer Cyclical",
    "ELI LILLY & CO": "Healthcare",
    "BROADCOM INC": "Technology",
    "ORACLE CORP": "Technology",
    "UNITEDHEALTH GROUP INC": "Healthcare",
    "PFIZER INC": "Healthcare",
    "ABBOTT LABORATORIES": "Healthcare",
    "THERMO FISHER SCIENTIFIC": "Healthcare",
    "COMCAST CORP": "Communication Services",
    "VERIZON COMMUNICATIONS": "Communication Services",
    "AT&T INC": "Communication Services",
    "NEXTERA ENERGY INC": "Utilities",
    "UNION PACIFIC CORP": "Industrials",
    "UPS": "Industrials",
    "BOEING CO": "Industrials",
    "CAT": "Industrials",
    "GENERAL ELECTRIC": "Industrials",
    "GM": "Consumer Cyclical",
    "FORD": "Consumer Cyclical",
    "UBER": "Technology",
    "AIRBNB": "Consumer Cyclical",
    "PLANTIR": "Technology",
    "SNOWFLAKE": "Technology",
    "BLOCK INC": "Financial Services",
    "PAYPAL": "Financial Services",
    "SPDR S&P 500 ETF TRUST": "ETF",
    "INVESCO QQQ TRUST": "ETF",
    "VANGUARD": "ETF",
    "ISHARES": "ETF"
};

export function getSector(issuer: string): string {
    const cleanName = issuer.toUpperCase().replace(/[.,]/g, '').trim();

    // 1. Direct Match
    if (SECTOR_MAP[cleanName]) return SECTOR_MAP[cleanName];

    // 2. Partial Match keys
    for (const key of Object.keys(SECTOR_MAP)) {
        if (cleanName.includes(key) || key.includes(cleanName)) {
            return SECTOR_MAP[key];
        }
    }

    // 3. Heuristics
    if (cleanName.includes("ETF") || cleanName.includes("ISHARES") || cleanName.includes("VANGUARD") || cleanName.includes("SPDR") || cleanName.includes("TRUST")) return "ETF";
    if (cleanName.includes("PHARMA") || cleanName.includes("THERAPEUTICS") || cleanName.includes("MEDICAL") || cleanName.includes("HEALTH")) return "Healthcare";
    if (cleanName.includes("TECHNOLOGIES") || cleanName.includes("SYSTEMS") || cleanName.includes("SOFTWARE") || cleanName.includes("SEMICONDUCTOR")) return "Technology";
    if (cleanName.includes("ENERGY") || cleanName.includes("OIL") || cleanName.includes("GAS") || cleanName.includes("PETROLEUM")) return "Energy";
    if (cleanName.includes("BANK") || cleanName.includes("FINANCIAL") || cleanName.includes("CAPITAL") || cleanName.includes("INVESTMENT")) return "Financial Services";
    if (cleanName.includes("AIRLINES") || cleanName.includes("MOTORS") || cleanName.includes("AUTOMOTIVE")) return "Consumer Cyclical";

    return "Other";
}
