import React, { useState } from 'react';
import { SmsAccount, RunSettings } from '../types/sms';
import { Settings, Users, Clock, Bot, Trash2, Key, ShieldCheck, Zap, Calendar, Smartphone, Play, Cloud, CloudCheck, Copy, Check, RefreshCw } from 'lucide-react';

interface SidebarProps {
  activeKey: string;
  daysLeft: number;
  accountsText: string;
  onAccountsTextChange: (text: string) => void;
  accounts: SmsAccount[];
  onToggleAccount: (user: string) => void;
  runningMap?: Record<string, boolean>;
  onSelectAccountTab?: (user: string) => void;
  settings: RunSettings;
  onSettingsChange: (newSettings: Partial<RunSettings>) => void;
  onClearData: () => void;
  onTriggerScheduleNow?: () => void;
  onChangeLicenseKey?: () => void;
  onExtendLicense?: () => void;
  isCloudSynced?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeKey,
  daysLeft,
  accountsText,
  onAccountsTextChange,
  accounts,
  onToggleAccount,
  runningMap = {},
  onSelectAccountTab,
  settings,
  onSettingsChange,
  onClearData,
  onTriggerScheduleNow,
  onChangeLicenseKey,
  onExtendLicense,
  isCloudSynced = true,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleCopyKey = () => {
    if (!activeKey) return;
    navigator.clipboard.writeText(activeKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleDay = (day: string) => {
    const current = settings.scheduleDays || [];
    const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    onSettingsChange({ scheduleDays: updated });
  };

  return (
    <aside className="w-full lg:w-80 bg-white dark:bg-slate-900 border lg:border-r border-slate-200 dark:border-slate-800 rounded-2xl lg:rounded-none p-4 sm:p-5 space-y-4 lg:space-y-6 shrink-0 overflow-y-auto">
      {/* Mobile Toggle Button */}
      <div className="flex lg:hidden items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
          <Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>License & Automation Settings</span>
        </div>
        <button
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
        >
          {mobileExpanded ? 'Hide Settings ▲' : 'Show Settings ▼'}
        </button>
      </div>

      <div className={`${mobileExpanded ? 'block' : 'hidden lg:block'} space-y-6`}>
        {/* License & Cloud Sync Card */}
      <div className="bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
            <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>LICENSE KEY</span>
          </div>
          <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            ⏳ {daysLeft} Days
          </span>
        </div>

        <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800 px-3 py-2 rounded-xl text-xs font-mono">
          <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[150px]">
            {activeKey || 'PRO-KEY'}
          </span>
          <button
            onClick={handleCopyKey}
            className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1"
            title="Copy License Key to sync on another device"
          >
            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Extend Days & Switch Key Actions */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60 text-[10px]">
          {onExtendLicense && (
            <button
              onClick={onExtendLicense}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              title="Add +365 days to active license key"
            >
              <span>⚡ Extend +365 Days</span>
            </button>
          )}

          {onChangeLicenseKey && (
            <button
              onClick={onChangeLicenseKey}
              className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/80 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-extrabold rounded-lg transition-colors cursor-pointer"
            >
              🔑 Switch Key
            </button>
          )}
        </div>

        {/* Cloud Status Indicator */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
          <span className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
            <CloudCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Cloud Sync Active</span>
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
            Firestore Ready
          </span>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          <h2 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">
            Master Settings
          </h2>
        </div>

        {/* API Accounts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" /> API Accounts
            </label>
            <span className="text-[10px] text-slate-400 font-mono">user,pass,Name (opt)</span>
          </div>

          <textarea
            value={accountsText}
            onChange={(e) => onAccountsTextChange(e.target.value)}
            rows={4}
            placeholder={`username1,password1,Primary SIM\nusername2,password2,Secondary Route`}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none resize-none"
          />

          {accounts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Devices / Routes:</p>
                <span className="text-[10px] text-slate-400">Status Dot</span>
              </div>
              {accounts.map((acc) => {
                const isRunning = Boolean(runningMap[acc.user]);
                return (
                  <div
                    key={acc.user}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div 
                      onClick={() => onSelectAccountTab?.(acc.user)}
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-2"
                      title="Click to view this device tab"
                    >
                      {/* Visual Status Indicator Dot */}
                      {acc.enabled ? (
                        isRunning ? (
                          <span className="relative flex h-2.5 w-2.5 shrink-0" title="Device Running & Sending Queue">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" title="Device Online / Idle"></span>
                        )
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" title="Device Disabled"></span>
                      )}

                      <div className="flex flex-col min-w-0 flex-1">
                        {acc.name ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-bold text-slate-900 dark:text-white truncate">{acc.name}</span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">({acc.user})</span>
                          </div>
                        ) : (
                          <span className="font-mono font-medium truncate">{acc.user}</span>
                        )}
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          Max {acc.dailyLimit || settings.dailyLimit}/day
                        </span>
                      </div>
                      
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-tight shrink-0 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {acc.enabled ? (isRunning ? 'Running' : 'Ready') : 'Disabled'}
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={acc.enabled}
                      onChange={() => onToggleAccount(acc.user)}
                      className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
        {/* Daily Limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Daily Limit (Per Route)
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Max sends for EACH API today</p>
          <input
            type="number"
            min={1}
            max={50000}
            value={settings.dailyLimit}
            onChange={(e) => onSettingsChange({ dailyLimit: Number(e.target.value) || 180 })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-mono"
          />
        </div>

        {/* Timing Controls */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> Timing & Delays
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                <span>Min Delay</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{settings.delayMin}s</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={settings.delayMin}
                onChange={(e) => onSettingsChange({ delayMin: Number(e.target.value) })}
                className="w-full accent-slate-900 dark:accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
                <span>Max Delay</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{settings.delayMax}s</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={settings.delayMax}
                onChange={(e) => onSettingsChange({ delayMax: Number(e.target.value) })}
                className="w-full accent-slate-900 dark:accent-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Batch Size</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.batchSize}
                  onChange={(e) => onSettingsChange({ batchSize: Number(e.target.value) || 10 })}
                  className="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Batch Pause (s)</label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={settings.batchPause}
                  onChange={(e) => onSettingsChange({ batchPause: Number(e.target.value) || 120 })}
                  className="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Max Retries</label>
              <input
                type="number"
                min={1}
                max={5}
                value={settings.maxRetries}
                onChange={(e) => onSettingsChange({ maxRetries: Number(e.target.value) || 3 })}
                className="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Auto Mode */}
        <div className="pt-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-emerald-500" /> Auto Mode
              </span>
              <input
                type="checkbox"
                checked={settings.autoMode}
                onChange={(e) => onSettingsChange({ autoMode: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Smart retry & auto-hop (recommended). Automatically retries failures with spacing and hands stuck numbers to another active account.
            </p>
            {settings.autoMode && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Auto Mode active — auto-retries & rerouting enabled.
              </p>
            )}
          </div>
        </div>

        {/* Scheduled Auto-Send (Cron Job) */}
        <div className="pt-2">
          <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Scheduled Auto-Send</span>
              </span>
              <input
                type="checkbox"
                checked={settings.scheduleEnabled}
                onChange={(e) => onSettingsChange({ scheduleEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Automatically triggers daily SMS dispatch if phone device is online.
            </p>

            <div className="p-2 bg-blue-100/60 dark:bg-blue-900/40 rounded-lg text-[10px] text-blue-900 dark:text-blue-200 space-y-1">
              <span className="font-bold">📌 How queue selection works:</span>
              <p>
                When triggered, it picks up all <strong>PENDING</strong> numbers currently assigned to each active route — combining numbers added from <strong>Send Numbers</strong> (quick paste / saved folder) and <strong>Route Uploads</strong>.
              </p>
            </div>

            {settings.scheduleEnabled && (
              <div className="space-y-2.5 pt-1 text-xs">
                {/* Schedule Time */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Daily Trigger Time:
                  </label>
                  <input
                    type="time"
                    value={settings.scheduleTime || '10:00'}
                    onChange={(e) => onSettingsChange({ scheduleTime: e.target.value })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold"
                  />
                </div>

                {/* Day selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Repeat Days:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {weekdays.map((day) => {
                      const isSel = (settings.scheduleDays || []).includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            isSel
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Only send if online */}
                <label className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={settings.scheduleOnlyOnline}
                    onChange={(e) => onSettingsChange({ scheduleOnlyOnline: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex items-center gap-1 font-semibold">
                    <Smartphone className="w-3 h-3 text-emerald-500" /> Only if device is ONLINE
                  </span>
                </label>

                {/* Scheduled Count Limit */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Max Messages per Run (0 = all):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={settings.scheduleCount || 50}
                    onChange={(e) => onSettingsChange({ scheduleCount: Number(e.target.value) || 0 })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs"
                  />
                </div>

                {/* Trigger test button */}
                {onTriggerScheduleNow && (
                  <button
                    type="button"
                    onClick={onTriggerScheduleNow}
                    className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center justify-center gap-1 mt-1"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>⚡ Run Schedule Trigger Now</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clear Data Button */}
        <div className="pt-2">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear ALL tracking database records and settings?')) {
                onClearData();
              }
            }}
            className="w-full py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear ALL Data</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
  );
};
