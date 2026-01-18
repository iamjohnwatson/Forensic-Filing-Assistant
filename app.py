"""
Forensic Newsroom Auditor
Minimal yet Sophisticated SEC Filing Analysis
"""
import streamlit as st

# Page config - must be first
st.set_page_config(
    page_title="Forensic Newsroom",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for sophisticated dark theme
st.markdown("""
<style>
    /* Dark sophistication */
    .stApp {
        background: linear-gradient(180deg, #0a0a0f 0%, #12121a 100%);
    }
    
    /* Clean headers */
    h1, h2, h3 {
        font-weight: 300 !important;
        letter-spacing: 0.5px;
    }
    
    /* Cards */
    .module-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 1.5rem;
        margin: 0.5rem 0;
    }
    
    /* Alert badges */
    .alert-high {
        background: rgba(239,68,68,0.15);
        border-left: 3px solid #ef4444;
        padding: 0.75rem 1rem;
        border-radius: 0 8px 8px 0;
        margin: 0.5rem 0;
    }
    
    .alert-info {
        background: rgba(59,130,246,0.15);
        border-left: 3px solid #3b82f6;
        padding: 0.75rem 1rem;
        border-radius: 0 8px 8px 0;
        margin: 0.5rem 0;
    }
    
    /* Metrics */
    [data-testid="stMetricValue"] {
        font-size: 1.8rem !important;
        font-weight: 300 !important;
    }
    
    /* Sidebar polish */
    [data-testid="stSidebar"] {
        background: rgba(0,0,0,0.3);
        border-right: 1px solid rgba(255,255,255,0.05);
    }
    
    /* Button styling */
    .stButton > button {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        border: none;
        padding: 0.75rem 2rem;
        font-weight: 500;
        letter-spacing: 0.5px;
    }
    
    /* Code blocks */
    code {
        background: rgba(255,255,255,0.05) !important;
    }
</style>
""", unsafe_allow_html=True)

# Import modules
import sec_client
import forensic_modules


def main():
    # Header
    st.markdown("# 🔍 Forensic Newsroom")
    st.markdown("*Investigative SEC Filing Analysis*")
    st.divider()
    
    # Sidebar
    with st.sidebar:
        st.markdown("### ⚙️ Configuration")
        st.markdown("---")
        
        st.info("AI Analysis is powered by Google Gemini (Free Tier)")
        
        ticker = st.text_input(
            "Ticker Symbol",
            value="AAPL",
            max_chars=10
        ).upper().strip()
        
        form_type = st.selectbox(
            "Filing Type",
            ["10-K", "10-Q", "13-F"],
            help="10-K/Q for text analysis, 13-F for holdings"
        )
        
        st.markdown("---")
        
        run_audit = st.button("🚀 Run Forensic Audit", use_container_width=True, type="primary")
        
        st.markdown("---")
        st.caption("Powered by SEC EDGAR & Gemini 2.0 Flash")
    
    # Main content
    if run_audit:
        # Initialize clients (Token is optional)
        sec = sec_client.SECClient()
        
        # Step 1: Resolve CIK
        st.write("🔍 **Step 1: Resolving company...**")
        cik = sec.get_cik(ticker)
        if not cik:
            st.error(f"Could not find CIK for {ticker}")
            st.stop()
        st.success(f"**{ticker}** → CIK: `{cik}`")
        
        # Get filings
        st.write("📄 **Step 2: Finding filings...**")
        filings = sec.get_filings(cik, form_type, count=2, ticker=ticker)
        if not filings:
            st.error(f"No {form_type} filings found")
            st.stop()
        
        st.success(f"Found **{len(filings)}** recent {form_type} filings")
        for f in filings:
            st.write(f"   📄 {f['date']}: {f['primary_doc']}")
        
        st.divider()
        
        risk_analysis = None
        financials = None
        whale_analysis = None
        
        # ========== 10-K/Q ANALYSIS ==========
        if form_type in ["10-K", "10-Q"]:
            
            # Create tabs for each module
            tab1, tab2, tab3 = st.tabs(["📝 Textual Redline", "📊 Financials", "🎯 Intelligence"])
            
            # TAB 1: Module A - Textual Redline
            with tab1:
                try:
                    # Try to get pre-computed risks
                    all_risks = sec.get_risk_factors(cik, ticker=ticker)
                    
                    # Current Filing
                    st.caption(f"Processing {filings[0]['primary_doc']}...")
                    current_risks = all_risks.get(filings[0]['accession'])
                    
                    if not current_risks:
                        # Fallback: Download and extract
                        current_html = sec.download_filing(filings[0]['url'])
                        if current_html:
                            st.caption(f"Extracting risks locally ({len(current_html):,} bytes)...")
                            current_risks = sec_client.extract_item_1a(current_html)
                    
                    # Previous Filing
                    previous_risks = None
                    if len(filings) > 1:
                        st.caption(f"Processing {filings[1]['primary_doc']}...")
                        previous_risks = all_risks.get(filings[1]['accession'])
                        
                        if not previous_risks:
                            # Fallback
                            previous_html = sec.download_filing(filings[1]['url'])
                            if previous_html:
                                previous_risks = sec_client.extract_item_1a(previous_html)
                    
                    if current_risks:
                        st.success(f"✅ Extracted {len(current_risks):,} characters")
                        
                        if previous_risks:
                            st.success(f"✅ Previous filing: {len(previous_risks):,} characters")
                            risk_analysis = forensic_modules.analyze_textual_changes(current_risks, previous_risks)
                            
                            st.write(f"**Added:** {risk_analysis['added_count']} | **Removed:** {risk_analysis['removed_count']}")
                            
                            if risk_analysis['escalations']:
                                st.markdown("#### 🚨 Risk Escalations")
                                for e in risk_analysis['escalations'][:5]:
                                    st.error(f"**{e['keyword'].upper()}**: {e['text'][:200]}...")
                            else:
                                st.info("No high-risk escalations")
                            
                            if risk_analysis['silent_deletions']:
                                st.markdown("#### 🔇 Silent Deletions")
                                for d in risk_analysis['silent_deletions'][:5]:
                                    st.warning(f"**{d['keyword'].upper()}**: {d['text'][:200]}...")
                            
                            with st.expander("View Diff"):
                                st.code(risk_analysis.get('diff_preview', 'No diff')[:3000], language="diff")
                        else:
                            st.info("Single filing - showing risk excerpt")
                            st.text(current_risks[:1000] + "...")
                    else:
                        st.error("Failed to extract risk factors from filing")
                except Exception as e:
                    st.error(f"Error: {e}")
            
            # TAB 2: Module B - Quantitative Audit
            with tab2:
                try:
                    st.caption("Fetching company facts...")
                    facts = sec.get_company_facts(cik, ticker=ticker)
                    
                    if facts:
                        financials = forensic_modules.analyze_financials(facts, cik)
                        
                        if financials:
                            st.write(f"📊 **Current Assets:** {financials.get('current_assets', 'N/A')}")
                            st.write(f"📊 **Current Liabilities:** {financials.get('current_liabilities', 'N/A')}")
                            st.write(f"💵 **Cash:** {financials.get('cash', 'N/A')}")
                            st.write(f"📈 **Liquidity Ratio:** {financials.get('liquidity_ratio', 'N/A')}")
                            
                            if financials.get('alerts'):
                                st.markdown("#### 🚨 Alerts")
                                for alert in financials['alerts']:
                                    st.error(f"**{alert['type']}**: {alert['message']}")
                            else:
                                st.success("✅ No liquidity concerns")
                        else:
                            st.warning("Could not analyze financials")
                    else:
                        st.warning("XBRL data not available (CORS blocked)")
                except Exception as e:
                    st.error(f"Error: {e}")
            
            # TAB 3: Investigative Intelligence
            with tab3:
                # Try to get pre-generated intelligence
                intelligence = sec.get_intelligence(ticker)
                
                if intelligence and intelligence.get('scoop_leads'):
                    timestamp = time.strftime('%Y-%m-%d %H:%M', time.localtime(intelligence.get('generated_at', 0)))
                    st.caption(f"🤖 Analysis generated by {intelligence.get('model', 'AI')} at {timestamp}")
                    st.markdown(intelligence['scoop_leads'])
                else:
                    # Fallback / Live generation (if token provided)
                    # Fallback / Live generation
                    with st.spinner("Generating scoop leads (Gemini 2.0 Flash)..."):
                        scoop = forensic_modules.generate_scoop_leads(
                            risk_analysis or {},
                            whale_analysis,
                            financials
                        )
                        st.markdown(scoop)
    
    else:
        # Welcome state
        st.markdown("""
        <div style="text-align: center; padding: 4rem 2rem; opacity: 0.7;">
            <h2 style="font-weight: 200;">Welcome to the Forensic Newsroom</h2>
            <p>Enter a ticker and select a filing type to begin your investigation.</p>
            <p style="font-size: 0.9rem;">
                📝 <strong>10-K/Q</strong>: Risk factor changes & financial health<br>
                🐋 <strong>13-F</strong>: Institutional holdings analysis
            </p>
        </div>
        """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()
