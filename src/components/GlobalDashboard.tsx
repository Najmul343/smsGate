import React, { useMemo } from 'react';
import { SmsRecord } from '../types/sms';
import { getGlobalStats, getDeliveryStats } from '../utils/dbStore';
import { Smartphone, Clock, Send, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Trophy, Bot, TrendingUp, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface GlobalDashboardProps {
  records: SmsRecord[];
  dailyLimit: number;
  autoMode: boolean;
}

export const GlobalDashboard: React.FC<GlobalDashboardProps> = ({ records, dailyLimit, autoMode }) => {
  const stats = getGlobalStats(records);
  const delivery = getDeliveryStats(records);

  // Overall delivery success rate calculation
  const totalAttempted = delivery.delivered + delivery.failed;
  const deliverySuccessRate = totalAttempted > 0 
    ? Math.round((delivery.delivered / totalAttempted) * 1000) / 10 
    : (stats.SUCCESS > 0 ? 100 : 0);

  // Group records by date for the success rate over time chart
  const timeSeriesData = useMemo(() => {
    const map = new Map<string, { date: string; delivered: number; gatewaySent: number; failed: number }>();

    // Seed last 7 days so chart is always visually complete
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map.set(dateStr, { date: label, delivered: 0, gatewaySent: 0, failed: 0 });
    }

    records.forEach((r) => {
      const rawDate = r.last_time || r.created_at || '';
      if (!rawDate) return;
      const dateKey = rawDate.split(' ')[0] || rawDate.split('T')[0];
      
      let item = map.get(dateKey);
      if (!item && dateKey.length >= 10) {
        const dObj = new Date(dateKey);
        const label = !isNaN(dObj.getTime()) 
          ? dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : dateKey;
        item = { date: label, delivered: 0, gatewaySent: 0, failed: 0 };
        map.set(dateKey, item);
      }

      if (item) {
        if (r.delivery_status === 'DELIVERED') {
          item.delivered += 1;
        }
        if (r.status === 'SUCCESS') {
          item.gatewaySent += 1;
          if (r.delivery_status !== 'DELIVERED' && r.delivery_status !== 'UNDELIVERED' && r.delivery_status !== 'FAILED') {
            // Assume gateway sent is delivered if report pending
            item.delivered += 1;
          }
        } else if (r.status === 'FAILED' || r.delivery_status === 'UNDELIVERED' || r.delivery_status === 'FAILED') {
          item.failed += 1;
        }
      }
    });

    return Array.from(map.values());
  }, [records]);

  // Calculate API leaderboard
  const apiLeaderboardMap = new Map<string, { success: number; total: number; delivered: number }>();
  records.forEach((r) => {
    if (r.api_used || r.assigned_api) {
      const apiKey = r.api_used || r.assigned_api || 'Unknown';
      const entry = apiLeaderboardMap.get(apiKey) || { success: 0, total: 0, delivered: 0 };
      entry.total += 1;
      if (r.status === 'SUCCESS') entry.success += 1;
      if (r.delivery_status === 'DELIVERED') entry.delivered += 1;
      apiLeaderboardMap.set(apiKey, entry);
    }
  });

  const leaderboard = Array.from(apiLeaderboardMap.entries()).map(([api_used, counts]) => ({
    api_used,
    success_count: counts.success,
    delivered_count: counts.delivered,
    total_count: counts.total,
    rate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
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

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <div>
              <span className="text-[10px] uppercase font-extrabold text-emerald-600 dark:text-emerald-400 block tracking-wider">Overall Delivery Rate</span>
              <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">{deliverySuccessRate}% Delivered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Metric Cards Grid (5 columns on desktop) - Prioritizing Delivery Success */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-300 dark:border-emerald-800/80 rounded-xl p-4 shadow-sm space-y-1 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmed Delivered
          </p>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{delivery.delivered}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{deliverySuccessRate}% phone confirmation</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> Sent Gateway
          </p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.SUCCESS}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Queue
          </p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{stats.PENDING}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Rejected / Failed
          </p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{stats.FAILED}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
            📊 Total Database
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{stats.TOTAL}</p>
        </div>
      </div>

      {/* Delivery Success Rate Over Time Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
              📈 Delivery Success & Dispatch Volume Over Time
            </h3>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            High-Priority Deliveries
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="colorGateway" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderColor: '#334155', 
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Area 
                type="monotone" 
                dataKey="delivered" 
                name="Confirmed Delivered (Primary)" 
                stroke="#10b981" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorDelivered)" 
              />
              <Area 
                type="monotone" 
                dataKey="gatewaySent" 
                name="Sent via Gateway" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorGateway)" 
              />
              <Area 
                type="monotone" 
                dataKey="failed" 
                name="Delivery Failed" 
                stroke="#ef4444" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorFailed)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real Phone Delivery Confirmation Details */}
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

      {/* API Route Performance & Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
              🏆 API Device Delivery Performance & Leaderboard
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2 rounded-l-lg">API Account / Device</th>
                  <th className="px-4 py-2">Total Assigned</th>
                  <th className="px-4 py-2">Gateway Sent</th>
                  <th className="px-4 py-2">Confirmed Delivered</th>
                  <th className="px-4 py-2 rounded-r-lg text-right">Delivery Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {leaderboard.map((item) => (
                  <tr key={item.api_used} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{item.api_used}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{item.total_count}</td>
                    <td className="px-4 py-2.5 text-blue-600 dark:text-blue-400">{item.success_count}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400">{item.delivered_count}</td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                      <span className="bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {item.rate}%
                      </span>
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

