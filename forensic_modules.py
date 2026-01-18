"""
Forensic Modules - Analysis Logic
Module A: Textual Redline
Module B: Quantitative Audit  
Module C: Whale Tracker
"""
import re
import difflib
from bs4 import BeautifulSoup
from typing import Optional
import xml.etree.ElementTree as ET
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def generate_scoop_leads(risk_analysis: dict, whale_analysis: dict = None, financials: dict = None) -> str:
    """
    Generate investigative scoop leads using Gemini 2.0 Flash.
    """
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Construct context
    context = f"""
    You are a veteran forensic accountant and investigative journalist (like Herb Greenberg or cohort).
    Analyze these signals from a company's recent SEC filings and identify 3 potential "scoop" angles.
    
    DATA PROVIDED:
    1. RISK FACTOR CHANGES (10-K/Q):
    - Added Count: {risk_analysis.get('added_count')}
    - Removed Count: {risk_analysis.get('removed_count')}
    - Escalations: {str(risk_analysis.get('escalations', []))}
    - Silent Deletions: {str(risk_analysis.get('silent_deletions', []))}
    
    2. FINANCIAL HEALTH (XBRL):
    - {str(financials) if financials else "No quantitative data available"}
    
    3. INSTITUTIONAL MONEY (13-F):
    - {str(whale_analysis) if whale_analysis else "No 13-F data available"}
    """
    
    prompt = f"""{context}
    
    TASK:
    Write a brief, punchy "Editor's Note" (max 200 words) highlighting the most suspicious or noteworthy signal.
    Then list 3 specific questions an investigative reporter should ask management.
    
    Style: Cynical, sharp, numbers-driven. Focus on what they are HIDING.
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"**Error generating AI analysis:** {str(e)}"


# ======================================
# MODULE A: TEXTUAL REDLINE (10-K/Q)
# ======================================

def analyze_textual_changes(current_text: str, previous_text: str) -> dict:
    """
    Compare risk factors between periods.
    Detect silent deletions and risk escalations.
    """
    # Normalize texts
    current = _normalize_text(current_text)
    previous = _normalize_text(previous_text)
    
    # Split into sentences for granular analysis
    curr_sentences = set(_split_sentences(current))
    prev_sentences = set(_split_sentences(previous))
    
    # Find changes
    added = curr_sentences - prev_sentences
    removed = prev_sentences - curr_sentences
    
    # Detect concerning patterns
    risk_keywords = ['going concern', 'substantial doubt', 'material weakness', 
                     'liquidity risk', 'default', 'bankruptcy', 'impairment',
                     'restructuring', 'layoffs', 'workforce reduction']
    
    escalations = []
    for sentence in added:
        for keyword in risk_keywords:
            if keyword in sentence.lower():
                escalations.append({"keyword": keyword, "text": sentence[:200]})
                break
    
    silent_deletions = []
    for sentence in removed:
        for keyword in risk_keywords:
            if keyword in sentence.lower():
                silent_deletions.append({"keyword": keyword, "text": sentence[:200]})
                break
    
    # Generate diff for display
    differ = difflib.unified_diff(
        previous.split('\n')[:100],
        current.split('\n')[:100],
        fromfile='Previous Period',
        tofile='Current Period',
        lineterm='',
        n=1
    )
    diff_text = '\n'.join(list(differ)[:100])
    
    return {
        "added_count": len(added),
        "removed_count": len(removed),
        "escalations": escalations[:10],
        "silent_deletions": silent_deletions[:10],
        "diff_preview": diff_text[:3000],
        "risk_score": len(escalations) * 2 + len(silent_deletions)
    }

def _normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s.,;:\'\"-]', '', text)
    return text.lower().strip()

def _split_sentences(text: str) -> list:
    """Split text into sentences."""
    return [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 20]


# ======================================
# MODULE B: QUANTITATIVE AUDIT (10-K/Q)
# ======================================

def analyze_financials(company_facts: dict, cik: str) -> dict:
    """
    Analyze XBRL facts for liquidity and cash concerns.
    """
    if not company_facts:
        return {"error": "No XBRL data available"}
    
    facts = company_facts.get("facts", {})
    us_gaap = facts.get("us-gaap", {})
    
    # Extract key metrics
    current_assets = _get_latest_fact(us_gaap, "AssetsCurrent")
    current_liabilities = _get_latest_fact(us_gaap, "LiabilitiesCurrent")
    cash = _get_latest_fact(us_gaap, "CashAndCashEquivalentsAtCarryingValue")
    total_debt = _get_latest_fact(us_gaap, "LongTermDebt")
    total_assets = _get_latest_fact(us_gaap, "Assets")
    
    # Get historical for QoQ comparison
    cash_history = _get_fact_history(us_gaap, "CashAndCashEquivalentsAtCarryingValue", 2)
    
    # Calculate ratios
    alerts = []
    
    # Liquidity Ratio
    liquidity_ratio = None
    if current_assets and current_liabilities and current_liabilities > 0:
        liquidity_ratio = round(current_assets / current_liabilities, 2)
        if liquidity_ratio < 1.0:
            alerts.append({
                "type": "LIQUIDITY_ALERT",
                "severity": "HIGH",
                "message": f"Current Ratio {liquidity_ratio} < 1.0 - May struggle to meet short-term obligations"
            })
    
    # Cash Burn
    cash_change_pct = None
    if len(cash_history) >= 2 and cash_history[1] > 0:
        cash_change_pct = round((cash_history[0] - cash_history[1]) / cash_history[1] * 100, 1)
        if cash_change_pct < -30:
            alerts.append({
                "type": "CASH_BURN_ALERT", 
                "severity": "HIGH",
                "message": f"Cash dropped {abs(cash_change_pct):.1f}% QoQ - Significant cash burn"
            })
    
    return {
        "current_assets": _format_number(current_assets),
        "current_liabilities": _format_number(current_liabilities),
        "cash": _format_number(cash),
        "total_debt": _format_number(total_debt),
        "total_assets": _format_number(total_assets),
        "liquidity_ratio": liquidity_ratio,
        "cash_change_pct": cash_change_pct,
        "alerts": alerts,
        "health_score": 10 - len(alerts) * 3
    }

def _get_latest_fact(us_gaap: dict, concept: str) -> Optional[float]:
    """Get most recent value for a concept."""
    fact = us_gaap.get(concept, {})
    units = fact.get("units", {})
    
    for unit_type in ["USD", "shares", "pure"]:
        if unit_type in units:
            values = units[unit_type]
            if values:
                # Sort by end date and get latest
                sorted_vals = sorted(values, key=lambda x: x.get("end", ""), reverse=True)
                return sorted_vals[0].get("val")
    return None

def _get_fact_history(us_gaap: dict, concept: str, count: int) -> list:
    """Get historical values for a concept."""
    fact = us_gaap.get(concept, {})
    units = fact.get("units", {})
    
    for unit_type in ["USD", "shares", "pure"]:
        if unit_type in units:
            values = units[unit_type]
            if values:
                sorted_vals = sorted(values, key=lambda x: x.get("end", ""), reverse=True)
                return [v.get("val") for v in sorted_vals[:count] if v.get("val")]
    return []

def _format_number(val) -> str:
    """Format large numbers for display."""
    if val is None:
        return "N/A"
    try:
        val = float(val)
        if abs(val) >= 1e9:
            return f"${val/1e9:.1f}B"
        elif abs(val) >= 1e6:
            return f"${val/1e6:.1f}M"
        else:
            return f"${val:,.0f}"
    except:
        return str(val)


# ======================================
# MODULE C: WHALE TRACKER (13-F)
# ======================================

def parse_13f_holdings(xml_content: str) -> list[dict]:
    """Parse 13-F infotable.xml into holdings list."""
    if not xml_content:
        return []
    
    holdings = []
    
    try:
        # Handle namespace
        xml_clean = re.sub(r'\sxmlns[^"]*"[^"]*"', '', xml_content)
        root = ET.fromstring(xml_clean)
        
        # Find all infoTable entries
        for info in root.iter():
            if 'infotable' in info.tag.lower():
                holding = {}
                for child in info:
                    tag = child.tag.split('}')[-1].lower()
                    if tag == 'nameofissuer':
                        holding['issuer'] = child.text
                    elif tag == 'titleofclass':
                        holding['class'] = child.text
                    elif tag == 'cusip':
                        holding['cusip'] = child.text
                    elif tag == 'value':
                        holding['value'] = int(child.text) * 1000 if child.text else 0
                    elif tag == 'sshprnamt':
                        holding['shares'] = int(child.text) if child.text else 0
                
                if holding.get('issuer'):
                    holdings.append(holding)
    except Exception as e:
        pass
    
    return holdings

def analyze_whale_changes(current_holdings: list, previous_holdings: list) -> dict:
    """
    Compare 13-F holdings between quarters.
    Calculate net conviction changes.
    """
    if not current_holdings:
        return {"error": "No current holdings data"}
    
    # Index by CUSIP
    current_map = {h.get('cusip', ''): h for h in current_holdings if h.get('cusip')}
    previous_map = {h.get('cusip', ''): h for h in previous_holdings if h.get('cusip')}
    
    all_cusips = set(current_map.keys()) | set(previous_map.keys())
    
    changes = []
    total_bought = 0
    total_sold = 0
    
    for cusip in all_cusips:
        curr = current_map.get(cusip, {})
        prev = previous_map.get(cusip, {})
        
        curr_shares = curr.get('shares', 0)
        prev_shares = prev.get('shares', 0)
        delta = curr_shares - prev_shares
        
        issuer = curr.get('issuer') or prev.get('issuer', 'Unknown')
        
        if delta != 0:
            changes.append({
                'issuer': issuer,
                'cusip': cusip,
                'current_shares': curr_shares,
                'previous_shares': prev_shares,
                'delta': delta,
                'delta_pct': round(delta / prev_shares * 100, 1) if prev_shares else 100.0,
                'current_value': curr.get('value', 0),
                'action': 'BUY' if delta > 0 else 'SELL'
            })
            
            if delta > 0:
                total_bought += delta
            else:
                total_sold += abs(delta)
    
    # Sort by absolute delta
    changes.sort(key=lambda x: abs(x['delta']), reverse=True)
    
    # New positions and exits
    new_positions = [c for c in changes if c['previous_shares'] == 0]
    exits = [c for c in changes if c['current_shares'] == 0]
    
    net_conviction = total_bought - total_sold
    
    return {
        "total_positions": len(current_holdings),
        "changes_count": len(changes),
        "top_buys": [c for c in changes if c['action'] == 'BUY'][:5],
        "top_sells": [c for c in changes if c['action'] == 'SELL'][:5],
        "new_positions": new_positions[:5],
        "exits": exits[:5],
        "net_conviction": net_conviction,
        "conviction_signal": "BULLISH" if net_conviction > 0 else "BEARISH" if net_conviction < 0 else "NEUTRAL"
    }
