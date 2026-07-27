import React, { useState, useEffect, useRef } from 'react';
import { SmsAccount, SmsRecord, RunSettings } from './types/sms';
import { checkLicense } from './utils/license';
import {
  loadRecords,
  saveRecords,
  getSetting,
  setSetting,
  loadControlMap,
  setRunning,
  getTodaysSuccessCount,
} from './utils/dbStore';
import { LicenseModal } from './components/LicenseModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GlobalDashboard } from './components/GlobalDashboard';
import { SendNumbersPanel } from './components/SendNumbersPanel';
import { AccountTab } from './components/AccountTab';
import { MasterLogTab } from './components/MasterLogTab';
import { VercelInspectorTab } from './components/VercelInspectorTab';

export function App() {
  // License state
  const [licenseInfo, setLicenseInfo] = useState(checkLicense());

  // Records & Control state
  const [records, setRecords] = useState<SmsRecord[]>(loadRecords());
  const [accountsText, setAccountsText] = useState<string>(
    getSetting('accounts_text', 'user1,pass1\nuser2,pass2')
  );
  const [lastMessage, setLastMessage] = useState<string>(getSetting('last_message', ''));

  // Run settings
  const [settings, setSettings] = useState<RunSettings>({
    dailyLimit: Number(getSetting('daily_limit', '180')),
    delayMin: Number(getSetting('delay_min', '5')),
    delayMax: Number(getSetting('delay_max', '8')),
    batchSize: Number(getSetting('batch_size', '10')),
    batchPause: Number(getSetting('batch_pause', '120')),
    maxRetries: Number(getSetting('max_retries', '3')),
    autoMode: getSetting('auto_mode', '1') === '1',
  });

  // Parsed Accounts
  const [disabledAccounts, setDisabledAccounts] = useState<Record<string, boolean>>({});
  const [runningMap, setRunningMap] = useState<Record<string, boolean>>({});

  // Active UI Navigation Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedAccountTab, setSelectedAccountTab] = useState<string>('');

  // Activity logs deque map
  const [logsMap, setLogsMap] = useState<Record<string, string[]>>({});

  // Parse accounts text into account objects
  const parsedAccounts: SmsAccount[] = React.useMemo(() => {
    if (!accountsText.trim()) return [];
    const lines = accountsText.split('\n').map((l) => l.strip ? l.strip() : l.trim()).filter(Boolean);
    const accs: SmsAccount[] = [];
    lines.forEach((line) => {
      const parts = line.split(',');
      if (parts.length === 2) {
        const u = parts[0].trim();
        const p = parts[1].trim();
        if (u && p) {
          accs.push({
            user: u,
            pwd: p,
            enabled: !disabledAccounts[u],
          });
        }
      }
    });
    return accs;
  }, [accountsText, disabledAccounts]);

  const activeAccounts = parsedAccounts.filter((a) => a.enabled);

  // Sync settings when changed
  const updateSettings = (newSettings: Partial<RunSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (newSettings.dailyLimit !== undefined) setSetting('daily_limit', String(newSettings.dailyLimit));
    if (newSettings.delayMin !== undefined) setSetting('delay_min', String(newSettings.delayMin));
    if (newSettings.delayMax !== undefined) setSetting('delay_max', String(newSettings.delayMax));
    if (newSettings.batchSize !== undefined) setSetting('batch_size', String(newSettings.batchSize));
    if (newSettings.batchPause !== undefined) setSetting('batch_pause', String(newSettings.batchPause));
    if (newSettings.maxRetries !== undefined) setSetting('max_retries', String(newSettings.maxRetries));
    if (newSettings.autoMode !== undefined) setSetting('auto_mode', newSettings.autoMode ? '1' : '0');
  };

  const handleAccountsTextChange = (text: string) => {
    setAccountsText(text);
    setSetting('accounts_text', text);
  };

  const toggleAccount = (user: string) => {
    setDisabledAccounts((prev) => ({ ...prev, [user]: !prev[user] }));
  };

  const addLog = (user: string, msg: string) => {
    setLogsMap((prev) => {
      const list = prev[user] || [];
      return { ...prev, [user]: [...list.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`] };
    });
  };

  // Background Runner Engine Loop
  const runnerRef = useRef<NodeJS.Timeout | null>(null);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const runningMapRef = useRef(runningMap);
  runningMapRef.current = runningMap;

  const handleStartAccount = (accountUser: string, messageText: string) => {
    setRunningMap((prev) => ({ ...prev, [accountUser]: true }));
    setRunning(accountUser, true, messageText);
    addLog(accountUser, `🚀 Started route worker for ${accountUser}`);
  };

  const handleStopAccount = (accountUser: string) => {
    setRunningMap((prev) => ({ ...prev, [accountUser]: false }));
    setRunning(accountUser, false);
    addLog(accountUser, `⏹️ Stopped route worker for ${accountUser}`);
  };

  // Dispatch SMS worker loop
  useEffect(() => {
    const runWorkerCycle = async () => {
      const currentRecords = [...recordsRef.current];
      let recordsModified = false;

      for (const acc of activeAccounts) {
        if (!runningMapRef.current[acc.user]) continue;

        // Check daily limit
        const sentToday = getTodaysSuccessCount(currentRecords, acc.user);
        if (sentToday >= settings.dailyLimit) {
          addLog(acc.user, `🛑 Daily limit reached (${settings.dailyLimit}). Pausing.`);
          setRunningMap((prev) => ({ ...prev, [acc.user]: false }));
          continue;
        }

        // Find pending record for this account
        const pendingRecord = currentRecords.find(
          (r) =>
            r.status === 'PENDING' &&
            r.assigned_api === acc.user &&
            r.attempts < settings.maxRetries &&
            (!r.next_attempt_at || r.next_attempt_at <= new Date().toISOString())
        );

        if (!pendingRecord) {
          addLog(acc.user, `🎉 Queue finished — no pending numbers left.`);
          setRunningMap((prev) => ({ ...prev, [acc.user]: false }));
          continue;
        }

        // Send SMS request via serverless API endpoint
        const targetPhone = pendingRecord.phone;
        const msgText = pendingRecord.message_sent || lastMessage;

        try {
          const res = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account: acc.user,
              password: acc.pwd,
              message: msgText,
              phoneNumbers: [targetPhone],
              withDeliveryReport: true,
            }),
          });

          const data = await res.json();
          const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

          if (res.ok && data.success) {
            pendingRecord.status = 'SUCCESS';
            pendingRecord.attempts += 1;
            pendingRecord.api_used = acc.user;
            pendingRecord.last_time = nowStr;
            pendingRecord.message_id = data.id || undefined;
            addLog(acc.user, `✅ ${targetPhone} (Sent — delivery check pending)`);
            recordsModified = true;
          } else {
            pendingRecord.attempts += 1;
            pendingRecord.last_error = data.error || `HTTP_${res.status}`;
            pendingRecord.last_time = nowStr;

            if (pendingRecord.attempts < settings.maxRetries) {
              const nextAttemptMs = Date.now() + 3 * pendingRecord.attempts * 60 * 1000;
              pendingRecord.next_attempt_at = new Date(nextAttemptMs).toISOString();
              addLog(acc.user, `⏳ ${targetPhone} - ${pendingRecord.last_error}, retrying in ${3 * pendingRecord.attempts} min`);
            } else {
              pendingRecord.status = 'FAILED';
              addLog(acc.user, `❌ ${targetPhone} - ${pendingRecord.last_error} (retries exhausted)`);

              // Auto-hop if Auto Mode is ON
              if (settings.autoMode && activeAccounts.length > 1) {
                const otherAccounts = activeAccounts.filter((a) => a.user !== acc.user);
                if (otherAccounts.length > 0 && (pendingRecord.auto_retry_count || 0) < 2) {
                  const targetAcc = otherAccounts[0];
                  pendingRecord.status = 'PENDING';
                  pendingRecord.attempts = 0;
                  pendingRecord.assigned_api = targetAcc.user;
                  pendingRecord.auto_retry_count = (pendingRecord.auto_retry_count || 0) + 1;
                  pendingRecord.next_attempt_at = undefined;
                  addLog(acc.user, `🔀 Auto-hopped ${targetPhone} to ${targetAcc.user}`);
                }
              }
            }
            recordsModified = true;
          }
        } catch (err: any) {
          pendingRecord.attempts += 1;
          pendingRecord.last_error = 'NETWORK_ERROR';
          if (pendingRecord.attempts >= settings.maxRetries) {
            pendingRecord.status = 'FAILED';
          }
          addLog(acc.user, `❌ ${targetPhone} Network error.`);
          recordsModified = true;
        }

        // Only process one SMS per loop iteration to maintain delay spacing
        break;
      }

      if (recordsModified) {
        setRecords([...currentRecords]);
        saveRecords(currentRecords);
      }
    };

    const interval = setInterval(runWorkerCycle, (settings.delayMin || 3) * 1000);
    return () => clearInterval(interval);
  }, [activeAccounts, settings]);

  const handleClearAllData = () => {
    setRecords([]);
    saveRecords([]);
    setRunningMap({});
    setLogsMap({});
  };

  // License verification screen
  if (licenseInfo.isValid !== true) {
    return (
      <LicenseModal
        isValid={licenseInfo.isValid}
        activeKey={licenseInfo.activeKey}
        onActivated={() => setLicenseInfo(checkLicense())}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      {/* Top Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAccountsCount={activeAccounts.length}
      />

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar */}
        <Sidebar
          activeKey={licenseInfo.activeKey}
          daysLeft={licenseInfo.daysLeft}
          accountsText={accountsText}
          onAccountsTextChange={handleAccountsTextChange}
          accounts={parsedAccounts}
          onToggleAccount={toggleAccount}
          settings={settings}
          onSettingsChange={updateSettings}
          onClearData={handleClearAllData}
        />

        {/* Right Main Content Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {activeTab === 'dashboard' && (
            <GlobalDashboard
              records={records}
              dailyLimit={settings.dailyLimit}
              autoMode={settings.autoMode}
            />
          )}

          {activeTab === 'send' && (
            <SendNumbersPanel
              accounts={activeAccounts}
              lastMessage={lastMessage}
              onSaveLastMessage={(msg) => {
                setLastMessage(msg);
                setSetting('last_message', msg);
              }}
              onSplitAndStart={(numbers, msg, targetAccountUsers) => {
                const targetAccs = activeAccounts.filter((a) => targetAccountUsers.includes(a.user));
                if (!targetAccs.length) return [];

                // Redistribute & Start
                const existingMap = new Map<string, SmsRecord>();
                records.forEach((r) => existingMap.set(r.phone, r));

                const redistributable = numbers.filter((n) => {
                  const rec = existingMap.get(n);
                  return !rec || rec.status !== 'SUCCESS';
                });

                const nAccounts = targetAccs.length;
                const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
                const summary: { account: string; newCount: number; movedCount: number }[] = [];

                const updatedRecords = [...records];

                targetAccs.forEach((acc, i) => {
                  const chunk = redistributable.filter((_, idx) => idx % nAccounts === i);
                  let newCount = 0;
                  let movedCount = 0;

                  chunk.forEach((num) => {
                    const existing = updatedRecords.find((r) => r.phone === num);
                    if (!existing) {
                      updatedRecords.push({
                        phone: num,
                        status: 'PENDING',
                        attempts: 0,
                        last_error: '',
                        last_time: '',
                        created_at: now,
                        api_used: '',
                        assigned_api: acc.user,
                        message_sent: msg,
                        auto_retry_count: 0,
                      });
                      newCount++;
                    } else if (existing.status !== 'SUCCESS') {
                      existing.assigned_api = acc.user;
                      existing.status = 'PENDING';
                      movedCount++;
                    }
                  });

                  summary.push({ account: acc.user, newCount, movedCount });
                  handleStartAccount(acc.user, msg);
                });

                setRecords(updatedRecords);
                saveRecords(updatedRecords);
                return summary;
              }}
              onRetargetList={(numbers) => {
                const updated = [...records];
                const setN = new Set(numbers);
                updated.forEach((r) => {
                  if (setN.has(r.phone) && r.status === 'SUCCESS') {
                    r.status = 'PENDING';
                    r.attempts = 0;
                  }
                });
                setRecords(updated);
                saveRecords(updated);
              }}
            />
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              {activeAccounts.length === 0 ? (
                <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No active accounts selected
                  </p>
                  <p className="text-xs text-slate-500">
                    Paste account details in the sidebar (Username,Password) and check the toggle box.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
                    {activeAccounts.map((acc) => (
                      <button
                        key={acc.user}
                        onClick={() => setSelectedAccountTab(acc.user)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                          (selectedAccountTab || activeAccounts[0]?.user) === acc.user
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        🤖 {acc.user}
                      </button>
                    ))}
                  </div>

                  {activeAccounts
                    .filter((a) => a.user === (selectedAccountTab || activeAccounts[0]?.user))
                    .map((acc) => (
                      <AccountTab
                        key={acc.user}
                        account={acc}
                        records={records}
                        isRunning={Boolean(runningMap[acc.user])}
                        onStart={handleStartAccount}
                        onStop={handleStopAccount}
                        dailyLimit={settings.dailyLimit}
                        recentLogs={logsMap[acc.user] || []}
                        onRecordsUpdated={(updated) => {
                          setRecords(updated);
                          saveRecords(updated);
                        }}
                      />
                    ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'master_log' && (
            <MasterLogTab
              records={records}
              accounts={activeAccounts}
              onRecordsUpdated={(updated) => {
                setRecords(updated);
                saveRecords(updated);
              }}
            />
          )}

          {activeTab === 'vercel' && <VercelInspectorTab />}
        </main>
      </div>
    </div>
  );
}

export default App;
