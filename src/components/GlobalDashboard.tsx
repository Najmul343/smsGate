import React from 'react';
import { SmsRecord } from '../types/sms';
import { getGlobalStats, getDeliveryStats } from '../utils/dbStore';
import { Smartphone, Clock, Send, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Trophy, Bot } from 'lucide-react';

interface GlobalDashboardProps {
  records: SmsRecord[];
  dailyLimit: number;
  autoMode: boolean;
}

export const GlobalDashboard: React.FC<GlobalDashboardProps> = ({ records, dailyLimit, autoMode }) => {
  const stats = getGlobalStats(records);
  const delivery = getDeliveryStats(records);

  // Calculate API leaderboard
  const apiLeaderboardMap = new Map<string, number>();
  records.forEach((r) => {
    if (r.status === 'SUCCESS' && r.api_used) {
      apiLeaderboardMap.set(r.api_used, (apiLeaderboardMap.get(r.api_used) || 0) + 1);
    }
  });

  const leaderboard = Array.from(apiLeaderboardMap.entries()).map(([api_used, success_count]) => ({
    api_used,
    success_count,
  }));

  return (
    <div className="space-y-6">
      {/* App Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-slate-900 dark:text-white" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              📱 SMS Multi-Router Command Center
            </h1>
          </div>
          {autoMode && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-0.5">
              <Bot className="w-3.5 h-3.5" /> Auto Mode is ON — failures retry with spacing, get rerouted across accounts, and offline devices auto-pause.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <span>Vercel Deploy Ready</span>
        </div>
      </div>

      {/* Main Metric Cards Grid (5 columns on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            📊 Total in DB
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{stats.TOTAL}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{stats.PENDING}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> Sent Gateway
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.SUCCESS}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Rejected
          </p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{stats.FAILED}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
            🧭 Limit Set
          </p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{dailyLimit} / API</p>
        </div>
      </div>

      {/* Real Phone Delivery Confirmation Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Confirmed Delivered
            </p>
            <p className="text-xl font-black text-emerald-900 dark:text-emerald-200 font-mono">{delivery.delivered}</p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400">Recipient's phone confirmed receipt</p>
          </div>
        </div>

        <div className="bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-800/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase tracking-wider">
              Failed on Phone
            </p>
            <p className="text-xl font-black text-red-900 dark:text-red-200 font-mono">{delivery.failed}</p>
            <p className="text-[10px] text-red-700 dark:text-red-400">No signal / balance / invalid num</p>
          </div>
        </div>

        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Awaiting Confirmation
            </p>
            <p className="text-xl font-black text-blue-900 dark:text-blue-200 font-mono">{delivery.awaiting}</p>
            <p className="text-[10px] text-blue-700 dark:text-blue-400">Checked auto-polling every ~45s</p>
          </div>
        </div>
      </div>

      {/* API Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
              🏆 Overall API Leaderboard
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2 rounded-l-lg">API Account / User</th>
                  <th className="px-4 py-2 rounded-r-lg text-right">Successful Messages Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {leaderboard.map((item) => (
                  <tr key={item.api_used} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{item.api_used}</td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {item.success_count}
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
};
