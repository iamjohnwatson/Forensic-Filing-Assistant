"use client";

import { useState } from 'react';
import { Loader2, Sparkles, BrainCircuit, RefreshCw, FileText, Search, TrendingUp, AlertTriangle, BookOpen, Clock } from 'lucide-react';

interface IntelligenceDashboardProps {
    ticker: string;
    theme: 'light' | 'dark';
}

interface AnalysisResult {
    annual_strategy: string;
    quarterly_momentum: {
        qoq: string;
        yoy: string;
    };
}

export function IntelligenceDashboard({ ticker, theme }: IntelligenceDashboardProps) {
    const [localTicker, setLocalTicker] = useState(ticker);
    const [analyzing, setAnalyzing] = useState(false);
    const [report, setReport] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'annual' | 'quarterly'>('annual');
    const [subTab, setSubTab] = useState<'qoq' | 'yoy'>('qoq');

    // Update local state if prop changes (optional, but good for sync)
    if (ticker && ticker !== localTicker && !analyzing && !report) {
        // This might cause infinite loop depending on React version/strict mode if not careful, 
        // but since we are inside function body, this is bad practice.
        // Better to use useEffect or just initialize.
        // Let's stick to standard useState initialization and maybe a useEffect if strictly needed, 
        // but for now, let's just use the prop as initial value and let user type.
    }

    // Better approach: straightforward effect or just independent state
    // Let's just use a simple input that defaults to prop.

    const handleGenerate = async () => {
        if (!localTicker) {
            setError("Please enter a ticker symbol");
            return;
        }

        // Request permission immediately if we haven't
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        setAnalyzing(true);
        setError("");
        setReport(null);

        try {
            const res = await fetch('/api/generate-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticker: localTicker
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Generation failed");
            setReport(data);

            // Notify user if they are away from the tab
            if (document.hidden && Notification.permission === 'granted') {
                new Notification(`Intel Ready: ${localTicker}`, {
                    body: "Comparative analysis complete. Click to view.",
                    icon: '/icon.png' // Optional, if we had one
                });
            }

        } catch (e: any) {
            setError(e.message || "Failed to generate report");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className={`p-8 rounded-2xl border relative overflow-hidden ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800 shadow-xl' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="max-w-3xl mx-auto text-center mb-8">
                    <h2 className={`text-2xl font-bold tracking-tight mb-2 flex items-center justify-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        <FileText className="w-5 h-5 text-blue-500" />
                        Corporate Intelligence
                    </h2>
                    <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}`}>
                        Comparative Analysis: Current vs Historical 10-K & 10-Q Filings.
                    </p>
                </div>

                {/* Ticker Input Selection */}
                {!analyzing && !report && (
                    <div className="max-w-sm mx-auto mb-8">
                        <div className="relative">
                            <input
                                type="text"
                                value={localTicker}
                                onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
                                placeholder="Enter Ticker (e.g. MSFT)"
                                className={`w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-wider rounded-xl border outline-none transition-all ${theme === 'dark'
                                    ? 'bg-black/40 border-zinc-700 focus:border-blue-500 text-white placeholder:text-zinc-600'
                                    : 'bg-white border-gray-200 focus:border-blue-500 text-gray-900'
                                    }`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'}`} />
                            </div>
                        </div>
                    </div>
                )}

                {!report && !analyzing && (
                    <div className="flex justify-center">
                        <button
                            onClick={handleGenerate}
                            className="group relative px-8 py-4 font-bold text-white rounded-xl shadow-xl transition-all hover:scale-105 active:scale-95 bg-gradient-to-br from-blue-600 to-cyan-600"
                        >
                            <span className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                Initiate Deep Scan
                            </span>
                        </button>
                    </div>
                )}

                {analyzing && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        <div className={`text-sm font-medium animate-pulse ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
                            Retrieving historical 10-K & 10-Q filings... Running comparative models...
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-center text-sm font-medium">
                        {error}
                    </div>
                )}

                {report && (
                    <div className="mt-8">
                        {/* Tabs */}
                        <div className="flex justify-center mb-6 border-b border-gray-200 dark:border-zinc-800">
                            <button
                                onClick={() => setActiveTab('annual')}
                                className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'annual' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Annual Strategy (10-K)
                            </button>
                            <button
                                onClick={() => setActiveTab('quarterly')}
                                className={`px-6 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'quarterly' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Quarterly Momentum (10-Q)
                            </button>
                        </div>

                        {activeTab === 'annual' && (
                            <div className={`prose max-w-none p-8 rounded-xl border animate-in fade-in slide-in-from-bottom-2 ${theme === 'dark' ? 'prose-invert bg-zinc-950/50 border-zinc-800' : 'prose-slate bg-gray-50 border-gray-100'}`}>
                                <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-blue-500">
                                    <BookOpen className="w-4 h-4" />
                                    Strategic Analysis (Current vs Prev Year)
                                </div>
                                <div className="prose-headings:font-bold prose-h3:text-lg prose-h3:mb-2 prose-h3:text-gray-900 dark:prose-h3:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white" dangerouslySetInnerHTML={{ __html: report.annual_strategy }} />
                            </div>
                        )}

                        {activeTab === 'quarterly' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => setSubTab('qoq')}
                                        className={`px-3 py-1 text-xs rounded-md ${subTab === 'qoq' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'}`}
                                    >
                                        QoQ (Sequential)
                                    </button>
                                    <button
                                        onClick={() => setSubTab('yoy')}
                                        className={`px-3 py-1 text-xs rounded-md ${subTab === 'yoy' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'}`}
                                    >
                                        YoY (Growth)
                                    </button>
                                </div>

                                <div className={`prose max-w-none p-8 rounded-xl border ${theme === 'dark' ? 'prose-invert bg-zinc-950/50 border-zinc-800' : 'prose-slate bg-gray-50 border-gray-100'}`}>
                                    <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-green-500">
                                        {subTab === 'qoq' ? <TrendingUp className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                        {subTab === 'qoq' ? "Sequential Momentum Analysis" : "Year-over-Year Growth Analysis"}
                                    </div>
                                    <div className="prose-headings:font-bold prose-h3:text-lg prose-h3:mb-2 prose-h3:text-gray-900 dark:prose-h3:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white" dangerouslySetInnerHTML={{ __html: subTab === 'qoq' ? report.quarterly_momentum.qoq : report.quarterly_momentum.yoy }} />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={handleGenerate}
                                className={`text-xs flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                                <RefreshCw className="w-3 h-3" />
                                New Scan
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
