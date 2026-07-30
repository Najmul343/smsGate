import React, { useState, useEffect, useMemo } from 'react';
import { SmsAccount, SmsRecord, AccountDeviceStatus } from '../types/sms';
import { getTabStats, getTodaysSuccessCount, insertNumbers, getLocalDateString, saveRecords } from '../utils/dbStore';
import { parseExcelFile } from '../utils/excelParser';
import { LiveExcelGrid } from './LiveExcelGrid';
import { Play, Square, Smartphone, Upload, CheckCircle2, Clock, Send, AlertTriangle, RefreshCw, Calendar, Filter, Search, Download, RotateCcw, FileText, Tag, Plus, Clipboard, Zap } from 'lucide-react';

interface AccountTabProps {
  account: SmsAccount;
  records: SmsRecord[];
  isRunning: boolean;
  onStart: (accountUser: string, messageText: string) => void;
  onStop: (accountUser: string) => void;
  onUpdateAccountName?: (accountUser: string, newName: string) => void;
  onUpdateAccountLimit?: (accountUser: string, limit: number) => void;
  dailyLimit: number;
  recentLogs: string[];
  onRecordsUpdated: (updated: SmsRecord[]) => void;
  lastMessage?: string;
  onSaveLastMessage?: (msg: string) => void;
  onSplitAndStart?: (numbers: (string | { phone: string; name?: string })[], message: string, targetAccountUsers: string[]) => { account: string; newCount: number; movedCount: number }[];
  onSendAllRemaining?: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  account,
  records,
  isRunning,
  onStart,
  onStop,
  onUpdateAccountName,
  onUpdateAccountLimit,
  dailyLimit,
  recentLogs,
  onRecordsUpdated,
  lastMessage,
  onSaveLastMessage,
  onSplitAndStart,
  onSendAllRemaining,
}) => {
  const [deviceStatus, setDeviceStatus] = useState<AccountDeviceStatus>({
    online: null,
    error: null,
    devices: [],
  });
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [accountNameInput, setAccountNameInput] = useState(account.name || '');

  useEffect(() => {
    setAccountNameInput(account.name || '');
  }, [account.name, account.user]);

  // Date & Filter states for account history
  const todayStr = getLocalDateString();
  const [selectedDateMode, setSelectedDateMode] = useState<'today' | 'yesterday' | '7days' | 'all' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'sent' | 'failed' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch device connectivity for this account
  const checkDeviceConnectivity = async () => {
    setDeviceLoading(true);
    try {
      const res = await fetch(
        `/api/sms/devices?account=${encodeURIComponent(account.user)}&password=${encodeURIComponent(account.pwd)}`
      );
      const data = await res.json();
      setDeviceStatus({
        online: data.online ?? null,
        error: data.error || null,
        devices: data.devices || [],
      });
    } catch (err: any) {
      setDeviceStatus({
        online: null,
        error: err.message || 'Connection error',
        devices: [],
      });
    } finally {
      setDeviceLoading(false);
    }
  };

  useEffect(() => {
    checkDeviceConnectivity();
    const interval = setInterval(checkDeviceConnectivity, 60000); // Poll device status every 60s
    return () => clearInterval(interval);
  }, [account.user, account.pwd]);

  const stats = getTabStats(records, account.user);
  const effectiveDailyLimit = account.dailyLimit && account.dailyLimit > 0 ? account.dailyLimit : dailyLimit;
  const sentToday = getTodaysSuccessCount(records, account.user);
  const limitLeft = Math.max(0, effectiveDailyLimit - sentToday);
  const quotaPercent = Math.min(100, Math.round((sentToday / effectiveDailyLimit) * 100));

  const [limitInputState, setLimitInputState] = useState<number>(effectiveDailyLimit);

  useEffect(() => {
    setLimitInputState(effectiveDailyLimit);
  }, [account.user, account.dailyLimit, dailyLimit]);

  const [accountPasteInput, setAccountPasteInput] = useState('');

  const handleAccountPasteSubmit = () => {
    if (!accountPasteInput.trim()) return;
    const lines = accountPasteInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedList: (string | { phone: string; name?: string })[] = [];

    lines.forEach((line) => {
      if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim());
        parsedList.push({ phone: parts[0], name: parts[1] });
      } else if (line.includes(',')) {
        const parts = line.split(',').map((p) => p.trim());
        parsedList.push({ phone: parts[0], name: parts[1] });
      } else {
        parsedList.push(line);
      }
    });

    const res = insertNumbers(records, parsedList, account.user);
    onRecordsUpdated(res.updatedRecords);
    setUploadMessage(`✅ Added ${res.newCount} new and ${res.requeuedCount} re-queued numbers to route '${account.name || account.user}'!`);
    setAccountPasteInput('');
  };

  const handleAccountFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      const res = insertNumbers(records, parsed.numbers, account.user);
      onRecordsUpdated(res.updatedRecords);
      setUploadMessage(`✅ Uploaded '${file.name}': Added ${res.newCount} new and ${res.requeuedCount} re-queued numbers to route '${account.name || account.user}'!`);
    } catch {
      alert('Error parsing Excel file for this route.');
    }
  };

  // Account specific records matching assigned_api or api_used
  const accountRecords = useMemo(() => {
    return records.filter(
      (r) => r.assigned_api === account.user || r.api_used === account.user
    );
  }, [records, account.user]);

  // Date & Status filtered account records
  const filteredAccountRecords = useMemo(() => {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterdayDate);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = getLocalDateString(sevenDaysAgo);

    return accountRecords.filter((r) => {
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
  }, [accountRecords, selectedDateMode, customDate, todayStr, statusFilter, searchQuery]);

  // Metric breakdown for filtered date range
  const accountDailyMetrics = useMemo(() => {
    const total = filteredAccountRecords.length;
    const delivered = filteredAccountRecords.filter((r) => r.delivery_status === 'DELIVERED').length;
    const sent = filteredAccountRecords.filter((r) => r.status === 'SUCCESS').length;
    const failed = filteredAccountRecords.filter((r) => r.status === 'FAILED' || r.delivery_status === 'FAILED' || r.delivery_status === 'UNDELIVERED').length;
    const pending = filteredAccountRecords.filter((r) => r.status === 'PENDING').length;
    const totalTries = filteredAccountRecords.reduce((acc, r) => acc + (r.attempts || 0), 0);
    const avgTries = total > 0 ? (totalTries / total).toFixed(1) : '0';

    return { total, delivered, sent, failed, pending, avgTries };
  }, [filteredAccountRecords]);

  // Account Logs Pagination
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDateMode, customDate, statusFilter, searchQuery, pageSize]);

  const paginatedAccountRecords = useMemo(() => {
    if (pageSize === -1) return filteredAccountRecords;
    const start = (currentPage - 1) * pageSize;
    return filteredAccountRecords.slice(start, start + pageSize);
  }, [filteredAccountRecords, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredAccountRecords.length / pageSize));

  // Re-queue single record for this account
  const handleRequeueSingle = (phone: string) => {
    const copy = [...records];
    const item = copy.find((r) => r.phone === phone);
    if (item) {
      item.status = 'PENDING';
      item.assigned_api = account.user;
      item.last_error = 'Manual re-queued';
      saveRecords(copy);
      onRecordsUpdated(copy);
    }
  };

  // Re-queue all failed numbers for this account
  const handleRequeueAllFailed = () => {
    const copy = [...records];
    let count = 0;
    copy.forEach((r) => {
      if ((r.assigned_api === account.user || r.api_used === account.user) && (r.status === 'FAILED' || r.delivery_status === 'FAILED')) {
        r.status = 'PENDING';
        r.assigned_api = account.user;
        r.last_error = 'Bulk re-queued';
        count++;
      }
    });

    if (count > 0) {
      saveRecords(copy);
      onRecordsUpdated(copy);
      alert(`Re-queued ${count} failed message(s) for account ${account.user}.`);
    } else {
      alert('No failed messages found to re-queue for this account.');
    }
  };

  // Export Account Daily CSV
  const handleExportAccountCSV = () => {
    if (filteredAccountRecords.length === 0) {
      alert('No logs found for this account with the selected filters.');
      return;
    }

    const headers = ['Phone Number', 'Client Name', 'Status', 'Delivery Status', 'Attempts / Tries', 'Message Sent', 'Error Reason', 'Timestamp'];
    const rows = filteredAccountRecords.map((r) => [
      `"${r.phone}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.delivery_status || ''}"`,
      r.attempts || 0,
      `"${(r.message_sent || '').replace(/"/g, '""')}"`,
      `"${(r.last_error || r.delivery_reason || '').replace(/"/g, '""')}"`,
      `"${r.last_time || r.created_at || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `account_${account.user}_daily_log_${selectedDateMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Route Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Route:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{account.name || account.user}</span>
            </h2>
            {account.name && (
              <code className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                User: {account.user}
              </code>
            )}
          </div>

          {/* Device Connectivity Status indicator */}
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            {deviceLoading ? (
              <span className="text-slate-400 animate-pulse">Checking device connection...</span>
            ) : deviceStatus.error ? (
              <span className="text-amber-600 dark:text-amber-400">Device check notice ({deviceStatus.error})</span>
            ) : deviceStatus.online === null ? (
              <span className="text-slate-400">No registered device on this account</span>
            ) : deviceStatus.online ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                🟢 Online — {deviceStatus.devices.filter((d) => d.online).map((d) => d.name).join(', ')}
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400 font-medium">
                🔴 Offline — last seen {deviceStatus.devices[0]?.minutesAgo ? `${Math.floor(deviceStatus.devices[0].minutesAgo)} min ago` : 'recently'}
              </span>
            )}
            <button
              onClick={checkDeviceConnectivity}
              title="Refresh device status"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <RefreshCw className={`w-3 h-3 ${deviceLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right side: Name Editor & Status badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
            <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">API Label:</span>
            <input
              type="text"
              placeholder="e.g. Primary SIM..."
              value={accountNameInput}
              onChange={(e) => setAccountNameInput(e.target.value)}
              onBlur={() => onUpdateAccountName?.(account.user, accountNameInput)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateAccountName?.(account.user, accountNameInput);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none w-32 sm:w-40 placeholder:font-normal placeholder:text-slate-400"
            />
          </div>

          <div>
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-300 dark:border-emerald-800 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                🟢 Sending now
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs border border-slate-200 dark:border-slate-700">
                ⚪ Idle
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ⚡ API SPECIFIC DAILY MAX LIMIT CONTROLS */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500 shrink-0" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                ⚡ Max Sends for THIS API Today ({account.name || account.user})
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>Sent Today: <strong className="text-slate-900 dark:text-white font-mono font-bold">{sentToday}</strong> / <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{effectiveDailyLimit}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              {limitLeft === 0 ? (
                <span className="text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-950/80 px-2 py-0.5 rounded text-[11px] animate-pulse">
                  🛑 DAILY LIMIT REACHED ({effectiveDailyLimit})
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  {limitLeft} sends remaining today
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 px-3 py-1.5 rounded-xl text-xs shadow-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px]">Set Limit:</span>
              <input
                type="number"
                min={1}
                max={100000}
                value={limitInputState}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLimitInputState(val);
                  if (val > 0) {
                    onUpdateAccountLimit?.(account.user, val);
                  }
                }}
                className="w-20 bg-transparent text-xs font-black font-mono text-slate-900 dark:text-white outline-none"
                placeholder="180"
              />
              <span className="text-[10px] text-amber-600 font-bold">/day</span>
            </div>

            <div className="flex items-center gap-1 text-xs">
              {[100, 200, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setLimitInputState(preset);
                    onUpdateAccountLimit?.(account.user, preset);
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    limitInputState === preset
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
            <span>Daily Quota Usage ({quotaPercent}%)</span>
            <span>{sentToday} of {effectiveDailyLimit} sent</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                quotaPercent >= 100
                  ? 'bg-red-500'
                  : quotaPercent >= 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending Queue
          </p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{stats.PENDING}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Send className="w-3 h-3" /> Total Gateway Sent
          </p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{stats.SUCCESS}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Total Failed
          </p>
          <p className="text-xl font-black text-red-600 dark:text-red-400 font-mono mt-0.5">{stats.FAILED}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Daily Limit Left
          </p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">{limitLeft}</p>
        </div>
      </div>

      {/* Start / Stop Controls */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onStart(account.user, accountMessage)}
          disabled={isRunning}
          className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>🚀 Start Route ({account.user})</span>
        </button>

        <button
          onClick={() => onStop(account.user)}
          disabled={!isRunning}
          className="py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Square className="w-4 h-4 fill-slate-900 dark:fill-white" />
          <span>⏹️ Stop Route</span>
        </button>
      </div>

      {/* 🌟 ACCOUNT DAILY LOG & RECIPIENT HISTORY SECTION */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/60 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>📊 Route Daily Logs & Recipient History</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Detailed breakdown of numbers, status, tries, and delivery timestamp for API account <code className="font-mono text-emerald-600 dark:text-emerald-400">{account.user}</code>.
            </p>
          </div>

          {/* Date Selector for this Account */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setSelectedDateMode('today')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedDateMode === 'today'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setSelectedDateMode('yesterday')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedDateMode === 'yesterday'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setSelectedDateMode('7days')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedDateMode === '7days'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setSelectedDateMode('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedDateMode === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Custom Date Picker */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-xl text-xs">
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
              onClick={handleExportAccountCSV}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>

            {accountDailyMetrics.failed > 0 && (
              <button
                onClick={handleRequeueAllFailed}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1"
                title="Re-queue all failed messages for this account"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry {accountDailyMetrics.failed} Failed</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Date Metrics summary for account */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
          <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Date Total</span>
            <span className="text-base font-black text-slate-900 dark:text-white">{accountDailyMetrics.total}</span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Delivered</span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{accountDailyMetrics.delivered}</span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/80 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block">Gateway Sent</span>
            <span className="text-base font-black text-blue-700 dark:text-blue-300">{accountDailyMetrics.sent}</span>
          </div>

          <div className="bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800/80 space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400 block">Failed</span>
            <span className="text-base font-black text-red-700 dark:text-red-300">{accountDailyMetrics.failed}</span>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">Avg Tries</span>
            <span className="text-base font-black text-indigo-700 dark:text-indigo-300">{accountDailyMetrics.avgTries} tries</span>
          </div>
        </div>

        {/* Filter controls & search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 overflow-x-auto text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              All ({accountDailyMetrics.total})
            </button>
            <button
              onClick={() => setStatusFilter('delivered')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                statusFilter === 'delivered'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50'
              }`}
            >
              Delivered ({accountDailyMetrics.delivered})
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                statusFilter === 'sent'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-blue-700 dark:text-blue-400 hover:bg-blue-100/50'
              }`}
            >
              Sent ({accountDailyMetrics.sent})
            </button>
            <button
              onClick={() => setStatusFilter('failed')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                statusFilter === 'failed'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-red-700 dark:text-red-400 hover:bg-red-100/50'
              }`}
            >
              Failed ({accountDailyMetrics.failed})
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search phone or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Account History Log Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="max-h-[300px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 min-w-[120px]">Phone Number</th>
                  <th className="px-3 py-2 min-w-[100px]">Client Name</th>
                  <th className="px-3 py-2 min-w-[110px]">Status</th>
                  <th className="px-3 py-2 min-w-[60px]">Tries</th>
                  <th className="px-3 py-2 min-w-[180px]">Message Sent</th>
                  <th className="px-3 py-2 min-w-[150px]">Error Detail</th>
                  <th className="px-3 py-2 min-w-[120px]">Timestamp</th>
                  <th className="px-3 py-2 text-right min-w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                {paginatedAccountRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-400 font-sans">
                      <div className="space-y-1">
                        <FileText className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="font-bold text-xs text-slate-600 dark:text-slate-300">No logs for account {account.user}</p>
                        <p className="text-[11px] text-slate-400">Try selecting another date filter above.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAccountRecords.map((r, i) => {
                    const err = r.last_error || r.delivery_reason;
                    const serialIndex = (pageSize === -1 ? 0 : (currentPage - 1) * pageSize) + i + 1;
                    return (
                      <tr key={r.phone + i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 font-bold text-[11px] font-mono">{serialIndex}</td>
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{r.phone}</td>
                        <td className="px-3 py-2 font-sans text-slate-600 dark:text-slate-300 truncate max-w-[100px]">
                          {r.name || <span className="text-slate-400 italic text-[10px]">-</span>}
                        </td>
                        <td className="px-3 py-2 font-bold">
                          {r.delivery_status === 'DELIVERED' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ✅ DELIVERED
                            </span>
                          ) : r.status === 'SUCCESS' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              🚀 GATEWAY SENT
                            </span>
                          ) : r.status === 'FAILED' || r.delivery_status === 'FAILED' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                              ❌ FAILED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              ⏳ PENDING
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold">{r.attempts || 0}</td>
                        <td className="px-3 py-2 font-sans text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[180px]" title={r.message_sent}>
                          {r.message_sent || accountMessage || <span className="text-slate-400 italic text-[10px]">No message body</span>}
                        </td>
                        <td className="px-3 py-2 font-sans text-[11px]">
                          {err ? (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded truncate max-w-[180px] block ${
                                r.status === 'FAILED' || r.delivery_status === 'FAILED' || err.toLowerCase().includes('fail') || err.toLowerCase().includes('error')
                                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50'
                                  : r.delivery_status === 'DELIVERED'
                                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50'
                                  : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50'
                              }`}
                            >
                              {err}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-[10px]">{r.last_time || r.created_at || '-'}</td>
                        <td className="px-3 py-2 text-right">
                          {(r.status === 'FAILED' || r.delivery_status === 'FAILED') && (
                            <button
                              onClick={() => handleRequeueSingle(r.phone)}
                              className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition-all shadow-xs cursor-pointer"
                              title="Re-queue this number"
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-sans">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{paginatedAccountRecords.length}</strong> of <strong>{filteredAccountRecords.length}</strong> filtered ({accountRecords.length} total for {account.user})
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={-1}>All ({filteredAccountRecords.length})</option>
                </select>
              </div>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Route-Specific Upload & Paste Expander */}
      <details className="group border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-slate-50/50 dark:bg-slate-900/50" open>
        <summary className="p-3.5 bg-slate-100 dark:bg-slate-800/80 text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>📥 Add / Upload Numbers directly for Route: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{account.name || account.user}</strong></span>
          </span>
          <span className="group-open:rotate-180 transition-transform text-slate-400">▼</span>
        </summary>
        <div className="p-4 space-y-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Numbers added or uploaded here will be assigned directly to API route <strong className="font-mono text-slate-800 dark:text-slate-200">{account.user}</strong> and put into the 'Yet to Send' queue.
          </p>

          <div className="space-y-4">
            {/* Option 1: Excel File Upload */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-600" /> Option 1: Upload Excel File (.xlsx, .xls)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleAccountFileUpload}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
              />
            </div>

            {/* Option 2: Live Excel & Sheets Grid */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clipboard className="w-3.5 h-3.5 text-emerald-600" /> Option 2: Paste Numbers Directly into Live Grid
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copy columns directly from Excel or Google Sheets (Ctrl+C / Cmd+C) and paste right into the live grid below. Click <strong className="font-bold text-slate-700 dark:text-slate-300">Paste Copied Excel Data</strong> to load, then <strong className="font-bold text-slate-700 dark:text-slate-300">Clean Grid</strong> to clean the data in table.
              </p>
              <LiveExcelGrid
                accounts={[account]}
                lastMessage={lastMessage || accountMessage || ''}
                onSaveLastMessage={(msg) => {
                  if (onSaveLastMessage) onSaveLastMessage(msg);
                  setAccountMessage(msg);
                }}
                onSplitAndStart={onSplitAndStart || (() => [])}
                onRecordsUpdated={onRecordsUpdated}
                onSendAllRemaining={onSendAllRemaining}
              />
            </div>
          </div>

          {uploadMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{uploadMessage}</span>
            </div>
          )}
        </div>
      </details>

      {/* Recent Activity Log */}
      {recentLogs.length > 0 && (
        <div className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
            Recent Activity Log:
          </div>
          {recentLogs.slice(-4).map((log, i) => (
            <div key={i} className="truncate text-slate-300">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

