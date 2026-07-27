import React, { useState, useEffect } from 'react';
import { Server, Activity, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { ApiHealthResponse } from '../types';

export const ApiStatusCard: React.FC = () => {
  const [data, setData] = useState<ApiHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [latency, setLatency] = useState<number | null>(null);

  const checkEndpoint = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const end = performance.now();
      setLatency(Math.round(end - start));
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkEndpoint();
  }, []);

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-slate-800 dark:text-slate-200" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Vercel Serverless Health (<code className="text-xs font-mono font-normal">/api/health</code>)
          </h3>
        </div>

        <button
          id="refresh-health-btn"
          onClick={checkEndpoint}
          disabled={loading}
          className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Endpoint Status</div>
          <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span>
            {data ? '200 OK' : 'Pending'}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Runtime Target</div>
          <p className="font-mono font-bold text-slate-900 dark:text-white uppercase text-sm">
            {data?.environment || 'Node.js'}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Response Latency</div>
          <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
            {latency ? `${latency} ms` : '--'}
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Gemini Secret Key</div>
          <p
            className={`font-bold flex items-center gap-1.5 text-sm ${
              data?.hasGeminiKey
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {data?.hasGeminiKey ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Configured
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" /> Add in Vercel
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
