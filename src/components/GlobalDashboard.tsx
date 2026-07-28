import React, { useMemo, useState } from 'react';
import { SmsAccount, SmsRecord } from '../types/sms';
import { getGlobalStats, getDeliveryStats, getLocalDateString } from '../utils/dbStore';
import { Smartphone, Clock, Send, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Trophy, Bot, TrendingUp, Activity, Calendar, Filter, Search, Download, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface GlobalDashboardProps {
  records: SmsRecord[];
  accounts?: SmsAccount[];
  dailyLimit: number;
  autoMode: boolean;
}

export const GlobalDashboard: React.FC<GlobalDashboardProps> = ({ records, accounts = [], dailyLimit, autoMode }) => {
  const stats = getGlobalStats(records);
  const delivery = getDeliveryStats(records);

  const accountNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    accounts.forEach((acc) => {
      if (acc.name) {
        map[acc.user] = acc.name;
      }
    });
    return map;
  }, [accounts]);

  const getApiDisplayName = (user: string) => {
    if (!user) return '-';
    const name = accountNameMap[user];
    return name ? `${name} (${user})` : user;
  };

  // Date selection state for Daily Log section
  const todayStr = getLocalDateString();
  const [selectedDateMode, setSelectedDateMode] = useState<'today' | 'yesterday' | '7days' | 'all' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'sent' | 'failed' | 'pending'>('all');
  const [apiFilter, setApiFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Overall delivery success rate calculation
  const totalAttempted = delivery.delivered + delivery.failed;
  const deliverySuccessRate = totalAttempted > 0 
    ? Math.round((delivery.delivered / totalAttempted) * 1000) / 10 
    : (stats.SUCCESS > 0 ? 100 : 0);

  // Extract unique API accounts for dropdown filter
  const uniqueApiAccounts = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.api_used) set.add(r.api_used);
      if (r.assigned_api) set.add(r.assigned_api);
    });
    return Array.from(set).filter(Boolean);
  }, [records]);

  // Group records by date for the success rate over time chart
  const timeSeriesData = useMemo(() => {
    const map = new Map<string, { date: string; delivered: number; gatewaySent: number; failed: number }>();

    // Seed last 7 days so chart is always visually complete
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
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

  // Calculate API leaderboard (Memoized)
  const leaderboard = useMemo(() => {
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

    return Array.from(apiLeaderboardMap.entries()).map(([api_used, counts]) => ({
      api_used,
      success_count: counts.success,
      delivered_count: counts.delivered,
      total_count: counts.total,
      rate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
    }));
  }, [records]);

  // Filter records based on selected date mode & filters
  const dateFilteredRecords = useMemo(() => {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterdayDate);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = getLocalDateString(sevenDaysAgo);

    return records.filter((r) => {
      const recordDateStr = (r.last_time || r.created_at || '').split(' ')[0] || (r.last_time || r.created_at || '').split('T')[0];

      // Date match
      if (selectedDateMode === 'today' && recordDateStr !== todayStr) return false;
      if (selectedDateMode === 'yesterday' && recordDateStr !== yesterdayStr) return false;
      if (selectedDateMode === '7days' && recordDateStr < sevenDaysStr) return false;
      if (selectedDateMode === 'custom' && customDate && recordDateStr !== customDate) return false;

      // Status match
      if (statusFilter === 'delivered' && r.delivery_status !== 'DELIVERED') return false;
      if (statusFilter === 'sent' && r.status !== 'SUCCESS') return false;
      if (statusFilter === 'failed' && r.status !== 'FAILED' && r.delivery_status !== 'FAILED' && r.delivery_status !== 'UNDELIVERED') return false;
      if (statusFilter === 'pending' && r.status !== 'PENDING') return false;

      // API route match
      if (apiFilter !== 'all' && r.api_used !== apiFilter && r.assigned_api !== apiFilter) return false;

      // Search match
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const num = r.phone.toLowerCase();
        const name = (r.name || '').toLowerCase();
        const msg = (r.message_sent || '').toLowerCase();
        const err = (r.last_error || r.delivery_reason || '').toLowerCase();
        if (!num.includes(q) && !name.includes(q) && !msg.includes(q) && !err.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedDateMode, customDate, todayStr, statusFilter, apiFilter, searchQuery]);

  // Daily log metric breakdown for selected date
  const dailyStats = useMemo(() => {
    const total = dateFilteredRecords.length;
    const delivered = dateFilteredRecords.filter((r) => r.delivery_status === 'DELIVERED').length;
    const sent = dateFilteredRecords.filter((r) => r.status === 'SUCCESS').length;
    const failed = dateFilteredRecords.filter((r) => r.status === 'FAILED' || r.delivery_status === 'FAILED' || r.delivery_status === 'UNDELIVERED').length;
    const pending = dateFilteredRecords.filter((r) => r.status === 'PENDING').length;
    
    // Total attempts made across these records
    const totalTries = dateFilteredRecords.reduce((acc, r) => acc + (r.attempts || 0), 0);
    const avgTries = total > 0 ? (totalTries / total).toFixed(1) : '0';

    return { total, delivered, sent, failed, pending, avgTries };
  }, [dateFilteredRecords]);

  // Export Daily Log to CSV
  const handleExportDailyLogCSV = () => {
    if (dateFilteredRecords.length === 0) {
      alert('No records found for the selected date filter.');
      return;
    }

    const headers = ['Phone Number', 'Client Name', 'Status', 'Delivery Status', 'API Account Used', 'Attempts / Tries', 'Message Sent', 'Error Reason', 'Timestamp'];
    const rows = dateFilteredRecords.map((r) => [
      `"${r.phone}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.delivery_status || ''}"`,
      `"${r.api_used || r.assigned_api || ''}"`,
      r.attempts || 0,
      `"${(r.message_sent || '').replace(/"/g, '""')}"`,
      `"${(r.last_error || r.delivery_reason || '').replace(/"/g, '""')}"`,
      `"${r.last_time || r.created_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_log_${selectedDateMode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      {/* Main Metric Cards Grid (5 columns on desktop) */}
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

      {/* 🌟 TODAY'S PERFORMANCE & DAILY LOG SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                📅 Today & Daily Dispatch History Logs
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analyze daily dispatch logs, numbers sent, delivery statuses, tries count, and errors for Today or previous dates.
            </p>
          </div>

          {/* Date Selector Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setSelectedDateMode('today')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  selectedDateMode === 'today'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedDateMode('yesterday')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  selectedDateMode === 'yesterday'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setSelectedDateMode('7days')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  selectedDateMode === '7days'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setSelectedDateMode('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  selectedDateMode === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Custom Date Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl text-xs">
              <span className="text-slate-400 font-semibold text-[11px]">Pick Date:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setSelectedDateMode('custom');
                }}
                className="bg-transparent text-slate-900 dark:text-white font-mono text-xs outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleExportDailyLogCSV}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Daily CSV</span>
            </button>
          </div>
        </div>

        {/* Selected Date Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Logs</span>
            <span className="text-lg font-black text-slate-900 dark:text-white">{dailyStats.total}</span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Confirmed Delivered</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{dailyStats.delivered}</span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800/80 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block">Gateway Sent</span>
            <span className="text-lg font-black text-blue-700 dark:text-blue-300">{dailyStats.sent}</span>
          </div>

          <div className="bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800/80 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400 block">Failed / Undelivered</span>
            <span className="text-lg font-black text-red-700 dark:text-red-300">{dailyStats.failed}</span>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/80 space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">Avg Tries / Number</span>
            <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">{dailyStats.avgTries} tries</span>
          </div>
        </div>

        {/* Filter Controls for Daily Log */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Statuses ({dailyStats.total})
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'delivered'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50'
              }`}
            >
              Delivered ({dailyStats.delivered})
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'sent'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-100/50'
              }`}
            >
              Sent ({dailyStats.sent})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'failed'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-red-700 dark:text-red-400 hover:bg-red-100/50'
              }`}
            >
              Failed ({dailyStats.failed})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {uniqueApiAccounts.length > 0 && (
              <select
                value={apiFilter}
                onChange={(e) => setApiFilter(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-800 dark:text-white"
              >
                <option value="all">All Sender APIs</option>
                {uniqueApiAccounts.map((acc) => (
                  <option key={acc} value={acc}>
                    {getApiDisplayName(acc)}
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search phone, message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Daily Log Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center">#</th>
                  <th className="px-3 py-2.5 min-w-[120px]">Phone Number</th>
                  <th className="px-3 py-2.5 min-w-[100px]">Client Name</th>
                  <th className="px-3 py-2.5 min-w-[100px]">Sender API</th>
                  <th className="px-3 py-2.5 min-w-[110px]">Status</th>
                  <th className="px-3 py-2.5 min-w-[70px]">Tries</th>
                  <th className="px-3 py-2.5 min-w-[180px]">Message Sent</th>
                  <th className="px-3 py-2.5 min-w-[160px]">Status / Failure Error</th>
                  <th className="px-3 py-2.5 min-w-[120px]">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                {dateFilteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans">
                      <div className="space-y-1">
                        <FileText className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="font-bold text-xs text-slate-600 dark:text-slate-300">No logs found for this date selection</p>
                        <p className="text-[11px] text-slate-400">Try changing the date filter above or switching search terms.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dateFilteredRecords.slice(0, 100).map((r, i) => {
                    const err = r.last_error || r.delivery_reason;
                    return (
                      <tr key={r.phone + i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 font-bold text-[11px] font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-bold font-mono text-slate-900 dark:text-white">{r.phone}</td>
                        <td className="px-3 py-2 font-sans text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                          {r.name || <span className="text-slate-400 italic text-[10px]">-</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{getApiDisplayName(r.api_used || r.assigned_api || '')}</td>
                        <td className="px-3 py-2 font-bold">
                          {r.delivery_status === 'DELIVERED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ✅ DELIVERED
                            </span>
                          ) : r.status === 'SUCCESS' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              🚀 GATEWAY SENT
                            </span>
                          ) : r.status === 'FAILED' || r.delivery_status === 'FAILED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                              ❌ FAILED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              ⏳ PENDING
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          <span className={r.attempts > 1 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>
                            {r.attempts || 0}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]" title={r.message_sent}>
                          {r.message_sent || <span className="text-slate-400 italic font-mono text-[10px]">No message text</span>}
                        </td>
                        <td className="px-3 py-2 font-sans text-[11px]">
                          {err ? (
                            <span className="text-red-600 dark:text-red-400 font-mono text-[10px] bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded truncate max-w-[180px] block">
                              {err}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-[10px] font-mono">{r.last_time || r.created_at || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 font-sans flex items-center justify-between">
            <span>Showing top {Math.min(100, dateFilteredRecords.length)} logs for selected filter</span>
            {dateFilteredRecords.length > 100 && (
              <span className="text-emerald-600 font-bold">Use Export Daily CSV to download all {dateFilteredRecords.length} records.</span>
            )}
          </div>
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
                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{getApiDisplayName(item.api_used)}</td>
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


