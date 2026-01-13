"use client";

import { useState } from 'react';
import { Search, Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

interface Holding {
    issuer: string;
    cusip: string;
    sharesCurr: number;
    sharesPrev: number;
    change: number;
    percentChange: number;
    value: number;
}

interface WhaleData {
    ticker: string;
    filingDateCurr: string;
    filingDatePrev: string;
    topHoldings: Holding[];
    topBuys: Holding[];
    topSells: Holding[];
    allChanges: Holding[];
}

export function WhaleTracker({ theme }: { theme: 'light' | 'dark' }) {
    const [ticker, setTicker] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<WhaleData | null>(null);
    const [error, setError] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: 'change' | 'percentChange', direction: 'asc' | 'desc' } | null>(null);

    const handleAnalyze = async () => {
        if (!ticker) return;
        setLoading(true);
        setError("");
        setData(null);

        try {
            const res = await fetch('/api/whale-tracker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Analysis failed");
            setData(result);
        } catch (e: any) {
            setError(e.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
    };

    const handleSort = (key: 'change' | 'percentChange') => {
        setSortConfig(current => {
            if (current?.key === key) {
                // If I click the same column, just flip the direction.
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            // Defaulting to descending for numbers because I usually care about the biggest values first.
            return { key, direction: 'desc' };
        });
    };

    const sortedChanges = data ? [...data.allChanges].sort((a, b) => {
        if (!sortConfig) return 0;
        const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
        return (a[sortConfig.key] - b[sortConfig.key]) * multiplier;
    }) : [];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* My minimalist search input block */}
            <div className={`p-8 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800 shadow-xl' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="max-w-2xl mx-auto text-center mb-8">
                    <h2 className={`text-2xl font-bold tracking-tight mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Institutional 13-F Analysis
                    </h2>
                    <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}`}>
                        Track major holdings, recent moves, and portfolio shifts.
                    </p>
                </div>

                <div className="max-w-xl mx-auto flex gap-3">
                    <div className="relative flex-1">
                        <Search className={`absolute left-4 top-3.5 h-5 w-5 ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder="Enter Ticker, Fund Name, or CIK"
                            className={`w-full pl-12 pr-4 py-3 rounded-lg border outline-none transition-all font-mono text-sm ${theme === 'dark' ? 'bg-black/20 border-zinc-800 focus:border-white text-white placeholder-zinc-600' : 'bg-gray-50 border-gray-200 focus:border-black text-gray-900 placeholder-gray-400'}`}
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className={`px-6 font-medium rounded-lg text-sm transition-all ${theme === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-black'}`}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
                    </button>
                </div>
                {error && (
                    <div className="mt-4 text-center text-sm font-medium text-red-500 bg-red-500/5 p-2 rounded">
                        {error}
                    </div>
                )}
            </div>

            {/* Showing the analysis results here if we have data */}
            {data && (
                <div className="space-y-8">
                    {/* Header info about the filing period */}
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className={`h-5 w-5 ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-400'}`} />
                            <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{data.ticker}</span>
                        </div>
                        <div className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}`}>
                            {data.filingDatePrev} <span className="mx-1">→</span> {data.filingDateCurr}
                        </div>
                    </div>

                    {/* The 3 main stats cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* 1. Top Holdings */}
                        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}`}>Top Holdings</h3>
                            <div className="space-y-3">
                                {data.topHoldings.map((h, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className={`font-mono text-xs opacity-40 ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'}`}>0{i + 1}</span>
                                            <span className={`font-medium truncate w-32 ${theme === 'dark' ? 'text-zinc-200' : 'text-gray-900'}`}>{h.issuer}</span>
                                        </div>
                                        <span className={`font-mono ${theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}`}>${formatNumber(h.value * 1000)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Top Buys */}
                        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}`}>Top Buys</h3>
                            <div className="space-y-3">
                                {data.topBuys.map((h, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className={`font-medium truncate w-32 ${theme === 'dark' ? 'text-zinc-200' : 'text-gray-900'}`}>{h.issuer}</span>
                                        <span className="font-mono text-emerald-500">+{formatNumber(h.change)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Top Sells */}
                        <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}>
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}`}>Top Sells</h3>
                            <div className="space-y-3">
                                {data.topSells.map((h, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className={`font-medium truncate w-32 ${theme === 'dark' ? 'text-zinc-200' : 'text-gray-900'}`}>{h.issuer}</span>
                                        <span className="font-mono text-red-500">{formatNumber(h.change)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Detailed Data Table */}
                    <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-zinc-800 bg-zinc-900/30' : 'border-gray-200 bg-white'}`}>
                        <div className={`px-6 py-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'}`}>
                            <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Detailed Portfolio Changes</h3>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead className={`text-xs uppercase font-medium ${theme === 'dark' ? 'bg-zinc-900 text-zinc-500' : 'bg-gray-50 text-gray-500'}`}>
                                <tr>
                                    <th className="px-6 py-3 font-medium">Issuer</th>
                                    <th className="px-6 py-3 text-right font-medium">Prev</th>
                                    <th className="px-6 py-3 text-right font-medium">Curr</th>
                                    <th
                                        className="px-6 py-3 text-right font-medium cursor-pointer hover:underline decoration-emerald-500 underline-offset-4"
                                        onClick={() => handleSort('change')}
                                    >
                                        Change {sortConfig?.key === 'change' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        className="px-6 py-3 text-right font-medium cursor-pointer hover:underline decoration-emerald-500 underline-offset-4"
                                        onClick={() => handleSort('percentChange')}
                                    >
                                        % Change {sortConfig?.key === 'percentChange' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-zinc-800 text-zinc-300' : 'divide-gray-100 text-gray-700'}`}>
                                {sortedChanges.slice(0, 50).map((h, i) => (
                                    <tr key={i} className={`transition-colors ${theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-50'}`}>
                                        <td className={`px-6 py-3 font-medium ${theme === 'dark' ? 'text-zinc-200' : 'text-gray-900'}`}>{h.issuer}</td>
                                        <td className="px-6 py-3 text-right font-mono text-xs opacity-60">{formatNumber(h.sharesPrev)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-xs opacity-60">{formatNumber(h.sharesCurr)}</td>
                                        <td className={`px-6 py-3 text-right font-mono text-xs ${h.change > 0 ? 'text-emerald-500' : h.change < 0 ? 'text-red-500' : 'opacity-40'}`}>
                                            {h.change > 0 ? '+' : ''}{formatNumber(h.change)}
                                        </td>
                                        <td className={`px-6 py-3 text-right font-mono text-xs ${h.percentChange > 0 ? 'text-emerald-500' : h.percentChange < 0 ? 'text-red-500' : 'opacity-40'}`}>
                                            {h.percentChange.toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
