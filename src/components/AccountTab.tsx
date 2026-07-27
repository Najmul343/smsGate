import React, { useState, useEffect } from 'react';
import { SmsAccount, SmsRecord, AccountDeviceStatus, RunSettings } from '../types/sms';
import { getTabStats, getTodaysSuccessCount, insertNumbers } from '../utils/dbStore';
import { parseExcelFile } from '../utils/excelParser';
import { Play, Square, Smartphone, Upload, CheckCircle2, Clock, Send, AlertTriangle, RefreshCw } from 'lucide-react';

interface AccountTabProps {
  account: SmsAccount;
  records: SmsRecord[];
  isRunning: boolean;
  onStart: (accountUser: string, messageText: string) => void;
  onStop: (accountUser: string) => void;
  dailyLimit: number;
  recentLogs: string[];
  onRecordsUpdated: (updated: SmsRecord[]) => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  account,
  records,
  isRunning,
  onStart,
  onStop,
  dailyLimit,
  recentLogs,
  onRecordsUpdated,
}) => {
  const [deviceStatus, setDeviceStatus] = useState<AccountDeviceStatus>({
    online: null,
    error: null,
    devices: [],
  });
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

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
  const sentToday = getTodaysSuccessCount(records, account.user);
  const limitLeft = Math.max(0, dailyLimit - sentToday);

  const handleAccountFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      const res = insertNumbers(records, parsed.numbers, account.user);
      onRecordsUpdated(res.updatedRecords);
      setUploadMessage(`✅ Added ${res.newCount} new number(s). ${res.skippedCount ? `Skipped ${res.skippedCount} existing/claimed.` : ''}`);
    } catch {
      alert('Error parsing Excel file for this route.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Route Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Route:</span>
            <code className="text-emerald-600 dark:text-emerald-400 font-mono">{account.user}</code>
          </h2>
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

        {/* Status badge */}
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </p>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{stats.PENDING}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Send className="w-3 h-3" /> Sent
          </p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{stats.SUCCESS}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Failed
          </p>
          <p className="text-xl font-black text-red-600 dark:text-red-400 font-mono mt-0.5">{stats.FAILED}</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Limit Left Today
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
          <span>🚀 Start</span>
        </button>

        <button
          onClick={() => onStop(account.user)}
          disabled={!isRunning}
          className="py-3 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Square className="w-4 h-4 fill-slate-900 dark:fill-white" />
          <span>⏹️ Stop</span>
        </button>
      </div>

      {/* Route-Specific Upload Expander */}
      <details className="group border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <summary className="p-3 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-slate-500" />
            Upload numbers just for this account (optional)
          </span>
          <span className="group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleAccountFileUpload}
            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white cursor-pointer"
          />
          {uploadMessage && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{uploadMessage}</p>
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
