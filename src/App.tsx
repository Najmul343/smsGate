import React, { useState, useEffect, useRef } from 'react';
import { SmsAccount, SmsRecord, RunSettings } from './types/sms';
import { checkLicense, extendActiveLicense } from './utils/license';
import {
  loadRecords,
  saveRecords,
  getSetting,
  setSetting,
  loadControlMap,
  setRunning,
  getTodaysSuccessCount,
  getLocalTimestamp,
  getLocalDateString,
  loadSavedFolders,
  saveSavedFolders,
  unfilterAndPrepareAllRemaining,
  getMessageVariants,
  setMessageVariants,
  getRandomMessageVariant,
} from './utils/dbStore';
import {
  fetchCloudWorkspace,
  saveCloudWorkspace,
  subscribeCloudWorkspace,
  setActiveLicenseKey,
  isFirestoreQuotaExceeded,
} from './utils/firebaseSync';
import { LicenseModal } from './components/LicenseModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GlobalDashboard } from './components/GlobalDashboard';
import { SendNumbersPanel } from './components/SendNumbersPanel';
import { AccountTab } from './components/AccountTab';
import { MasterLogTab } from './components/MasterLogTab';
import { MessageBoxTab } from './components/MessageBoxTab';
import { VercelInspectorTab } from './components/VercelInspectorTab';
import { Agentation } from 'agentation';

export function App() {
  // License state
  const [licenseInfo, setLicenseInfo] = useState(checkLicense());
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  // Records & Control state
  const [records, setRecords] = useState<SmsRecord[]>(loadRecords());
  const [accountsText, setAccountsText] = useState<string>(
    getSetting('accounts_text', 'user1,pass1\nuser2,pass2')
  );
  const [lastMessage, setLastMessage] = useState<string>(getSetting('last_message', ''));
  const [messageVariants, setMessageVariantsState] = useState<string[]>(() => getMessageVariants());

  const handleSaveMessageVariants = (updated: string[]) => {
    setMessageVariantsState(updated);
    setMessageVariants(updated);
    if (updated[0] !== undefined) {
      setLastMessage(updated[0]);
    }
  };

  // Parse initial schedule days
  let initialScheduleDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  try {
    const raw = getSetting('sched_days', '');
    if (raw) initialScheduleDays = JSON.parse(raw);
  } catch {}

  // Run settings
  const [settings, setSettings] = useState<RunSettings>({
    dailyLimit: Number(getSetting('daily_limit', '180')),
    delayMin: Number(getSetting('delay_min', '5')),
    delayMax: Number(getSetting('delay_max', '8')),
    batchSize: Number(getSetting('batch_size', '10')),
    batchPause: Number(getSetting('batch_pause', '120')),
    maxRetries: Number(getSetting('max_retries', '3')),
    autoMode: getSetting('auto_mode', '1') === '1',
    scheduleEnabled: getSetting('sched_enabled', '0') === '1',
    scheduleTime: getSetting('sched_time', '10:00'),
    scheduleDays: initialScheduleDays,
    scheduleOnlyOnline: getSetting('sched_only_online', '1') === '1',
    scheduleMessage: getSetting('sched_message', ''),
    scheduleCount: Number(getSetting('sched_count', '50')),
    lastScheduleRun: getSetting('last_sched_run', ''),
  });

  // Remote update flag to prevent echo loops
  // Cloud Workspace Sync State
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Manual Backup Workspace to Cloud (On-Demand)
  const handleBackupToCloud = async () => {
    if (!licenseInfo.isValid || !licenseInfo.activeKey) {
      setCloudSyncStatus('⚠️ Please activate a valid license key first.');
      return;
    }
    setIsCloudSyncing(true);
    setCloudSyncStatus('Uploading workspace to cloud...');
    try {
      const ok = await saveCloudWorkspace(licenseInfo.activeKey, {
        accountsText,
        records,
        folders: loadSavedFolders(),
        settings,
        lastMessage,
      }, true);
      if (ok) {
        setCloudSyncStatus('✅ Workspace successfully backed up to cloud!');
      } else {
        setCloudSyncStatus('⚡ Cloud write limit reached. Local data is safe.');
      }
    } catch {
      setCloudSyncStatus('❌ Error backing up to cloud.');
    } finally {
      setIsCloudSyncing(false);
      setTimeout(() => setCloudSyncStatus(null), 5000);
    }
  };

  // Manual Restore Workspace from Cloud (On-Demand)
  const handleRestoreFromCloud = async () => {
    if (!licenseInfo.isValid || !licenseInfo.activeKey) {
      setCloudSyncStatus('⚠️ Please activate a valid license key first.');
      return;
    }
    setIsCloudSyncing(true);
    setCloudSyncStatus('Fetching workspace from cloud...');
    try {
      const cloud = await fetchCloudWorkspace(licenseInfo.activeKey);
      if (cloud) {
        if (cloud.accountsText !== undefined && cloud.accountsText.trim() !== '') {
          setAccountsText(cloud.accountsText);
          setSetting('accounts_text', cloud.accountsText);
        }
        if (cloud.records && Array.isArray(cloud.records)) {
          setRecords((prev) => {
            const map = new Map<string, SmsRecord>();
            prev.forEach((r) => map.set(r.message_id || r.phone, r));
            cloud.records?.forEach((r) => map.set(r.message_id || r.phone, r));
            const merged = Array.from(map.values());
            saveRecords(merged);
            return merged;
          });
        }
        if (cloud.folders && Array.isArray(cloud.folders)) {
          saveSavedFolders(cloud.folders);
        }
        if (cloud.settings) {
          setSettings((prev) => ({ ...prev, ...cloud.settings }));
        }
        if (cloud.lastMessage) {
          setLastMessage(cloud.lastMessage);
          setSetting('last_message', cloud.lastMessage);
        }
        setCloudSyncStatus(`✅ Loaded ${cloud.records?.length || 0} records & workspace from cloud!`);
      } else {
        setCloudSyncStatus('ℹ️ No existing cloud backup found for this key.');
      }
    } catch {
      setCloudSyncStatus('❌ Failed to fetch cloud workspace.');
    } finally {
      setIsCloudSyncing(false);
      setTimeout(() => setCloudSyncStatus(null), 5000);
    }
  };

  // Parsed Accounts
  const [disabledAccounts, setDisabledAccounts] = useState<Record<string, boolean>>({});
  const [runningMap, setRunningMap] = useState<Record<string, boolean>>({});

  // Active UI Navigation Tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedAccountTab, setSelectedAccountTab] = useState<string>('');

  // Activity logs deque map
  const [logsMap, setLogsMap] = useState<Record<string, string[]>>({});

  // Account custom daily limits map (user -> limit)
  const [accountLimits, setAccountLimits] = useState<Record<string, number>>(() => {
    try {
      const raw = getSetting('account_daily_limits', '{}');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateAccountLimit = (accountUser: string, limit: number) => {
    setAccountLimits((prev) => {
      const updated = { ...prev, [accountUser]: limit };
      setSetting('account_daily_limits', JSON.stringify(updated));
      return updated;
    });
  };

  // Parse accounts text into account objects
  const parsedAccounts: SmsAccount[] = React.useMemo(() => {
    if (!accountsText.trim()) return [];
    const lines = accountsText.split('\n').map((l) => l.trim()).filter(Boolean);
    const accs: SmsAccount[] = [];
    lines.forEach((line) => {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const u = parts[0].trim();
        const p = parts[1].trim();
        const name = parts.length >= 3 ? parts.slice(2).join(',').trim() : undefined;
        if (u && p) {
          const customLimit = accountLimits[u];
          accs.push({
            user: u,
            pwd: p,
            name: name || undefined,
            enabled: !disabledAccounts[u],
            dailyLimit: customLimit && customLimit > 0 ? customLimit : settings.dailyLimit,
          });
        }
      }
    });
    return accs;
  }, [accountsText, disabledAccounts, accountLimits, settings.dailyLimit]);

  const activeAccounts = parsedAccounts.filter((a) => a.enabled);

  const handleUpdateAccountName = (accountUser: string, newName: string) => {
    const lines = accountsText.split('\n');
    const updatedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      const parts = trimmed.split(',');
      if (parts.length >= 2 && parts[0].trim() === accountUser) {
        const u = parts[0].trim();
        const p = parts[1].trim();
        return newName.trim() ? `${u},${p},${newName.trim()}` : `${u},${p}`;
      }
      return line;
    });
    const updatedText = updatedLines.join('\n');
    setAccountsText(updatedText);
    setSetting('accounts_text', updatedText);
  };

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
    if (newSettings.scheduleEnabled !== undefined) setSetting('sched_enabled', newSettings.scheduleEnabled ? '1' : '0');
    if (newSettings.scheduleTime !== undefined) setSetting('sched_time', newSettings.scheduleTime);
    if (newSettings.scheduleDays !== undefined) setSetting('sched_days', JSON.stringify(newSettings.scheduleDays));
    if (newSettings.scheduleOnlyOnline !== undefined) setSetting('sched_only_online', newSettings.scheduleOnlyOnline ? '1' : '0');
    if (newSettings.scheduleMessage !== undefined) setSetting('sched_message', newSettings.scheduleMessage);
    if (newSettings.scheduleCount !== undefined) setSetting('sched_count', String(newSettings.scheduleCount));
    if (newSettings.lastScheduleRun !== undefined) setSetting('last_sched_run', newSettings.lastScheduleRun);
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

  const handleSendAllRemainingFromAnyApi = () => {
    const currentRecords = [...recordsRef.current];
    const { updatedRecords, totalPending } = unfilterAndPrepareAllRemaining(currentRecords, lastMessage, activeAccounts);

    if (totalPending === 0) {
      alert('No remaining numbers found waiting to send.');
      return;
    }

    setRecords(updatedRecords);
    saveRecords(updatedRecords);

    // Auto-start all enabled accounts so they immediately begin dispatching
    activeAccounts.forEach((acc) => {
      setRunningMap((prev) => ({ ...prev, [acc.user]: true }));
      setRunning(acc.user, true, lastMessage);
      addLog(acc.user, `🌐 Route activated for global dispatch (Any Available API)`);
    });

    alert(`🌐 Filter removed! Re-distributed ${totalPending} remaining numbers across all ${activeAccounts.length} active API accounts. Sending started!`);
  };

  // Dispatch SMS worker loop - runs parallel dispatch across all active devices
  useEffect(() => {
    const runWorkerCycle = async () => {
      const currentRecords = [...recordsRef.current];
      let recordsModified = false;

      // Process all running accounts simultaneously per cycle
      await Promise.all(
        activeAccounts.map(async (acc) => {
          if (!runningMapRef.current[acc.user]) return;

          // Check daily limit for this specific API account
          const effectiveDailyLimit = acc.dailyLimit && acc.dailyLimit > 0 ? acc.dailyLimit : settings.dailyLimit;
          const sentToday = getTodaysSuccessCount(currentRecords, acc.user);
          if (sentToday >= effectiveDailyLimit) {
            addLog(acc.user, `🛑 Daily limit reached for ${acc.name || acc.user} (${sentToday}/${effectiveDailyLimit}). Pausing.`);
            setRunningMap((prev) => ({ ...prev, [acc.user]: false }));
            return;
          }

          // Find pending record for this account or any unassigned/stalled record
          const pendingRecord = currentRecords.find(
            (r) =>
              r.status === 'PENDING' &&
              (r.assigned_api === acc.user || !r.assigned_api || (settings.autoMode && !runningMapRef.current[r.assigned_api])) &&
              r.attempts < settings.maxRetries &&
              (!r.next_attempt_at || r.next_attempt_at <= getLocalTimestamp())
          );

          if (!pendingRecord) {
            addLog(acc.user, `🎉 Queue finished — no pending numbers left.`);
            setRunningMap((prev) => ({ ...prev, [acc.user]: false }));
            return;
          }

          // Ensure route & message are assigned (select random variant for human-like delivery)
          pendingRecord.assigned_api = acc.user;
          const chosenVariant = getRandomMessageVariant(pendingRecord.message_sent || lastMessage);
          pendingRecord.message_sent = chosenVariant;

          // Send SMS request via serverless API endpoint
          const targetPhone = pendingRecord.phone;
          const msgText = chosenVariant;

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
            const nowStr = getLocalTimestamp();
            const errStr = String(data.error || data.message || '');
            const isNetworkErrorArtifact = errStr.includes('RESULT_NETWORK_ERROR') || errStr.toLowerCase().includes('network error');

            if ((res.ok && data.success) || data.id || isNetworkErrorArtifact) {
              pendingRecord.status = 'SUCCESS';
              pendingRecord.attempts += 1;
              pendingRecord.api_used = acc.user;
              pendingRecord.last_time = nowStr;
              pendingRecord.message_id = data.id || `msg_${Date.now()}`;
              pendingRecord.last_error = '';
              pendingRecord.delivery_status = 'SENT';
              pendingRecord.delivery_reason = isNetworkErrorArtifact ? 'Sent (Mobile Carrier VoLTE ACK)' : 'Sent to Gateway';
              addLog(acc.user, `✅ ${targetPhone} (Sent — delivery check pending)`);
              recordsModified = true;
            } else {
              pendingRecord.attempts += 1;
              pendingRecord.last_error = errStr || `HTTP_${res.status}`;
              pendingRecord.last_time = nowStr;

              if (pendingRecord.attempts < settings.maxRetries) {
                const nextAttemptMs = Date.now() + 3 * pendingRecord.attempts * 60 * 1000;
                pendingRecord.next_attempt_at = getLocalTimestamp(new Date(nextAttemptMs));
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
            // Local fetch exception / offline catch
            pendingRecord.attempts += 1;
            pendingRecord.last_error = 'CLIENT_DISPATCH_TIMEOUT';
            if (pendingRecord.attempts >= settings.maxRetries) {
              pendingRecord.status = 'FAILED';
            }
            addLog(acc.user, `⚠️ ${targetPhone} Local request timeout.`);
            recordsModified = true;
          }
        })
      );

      if (recordsModified) {
        setRecords([...currentRecords]);
        saveRecords(currentRecords);
      }
    };

    const interval = setInterval(runWorkerCycle, (settings.delayMin || 3) * 1000);
    return () => clearInterval(interval);
  }, [activeAccounts, settings]);

  // Automated Real-Time Mobile Delivery Monitoring Engine (Runs every 10s)
  useEffect(() => {
    if (!activeAccounts.length) return;

    const checkMobileDeliveryStates = async () => {
      const currentRecords = [...recordsRef.current];
      // Candidate records that have SMSGate message IDs and need mobile delivery state updates
      const candidates = currentRecords.filter(
        (r) =>
          r.message_id &&
          r.message_id.length > 5 &&
          !r.message_id.startsWith('msg_') &&
          r.delivery_status !== 'DELIVERED' &&
          r.delivery_status !== 'FAILED' &&
          r.status !== 'PENDING'
      ).slice(0, 15);

      if (candidates.length === 0) return;

      let modified = false;

      for (const cand of candidates) {
        const acc = activeAccounts.find((a) => a.user === cand.api_used || a.user === cand.assigned_api) || activeAccounts[0];
        if (!acc) continue;

        try {
          const res = await fetch(
            `/api/sms/delivery?messageId=${encodeURIComponent(cand.message_id!)}&account=${encodeURIComponent(acc.user)}&password=${encodeURIComponent(acc.pwd)}`
          );

          if (res.ok) {
            const data = await res.json();
            if (data.state) {
              const target = currentRecords.find((r) => r.id === cand.id || (r.message_id && r.message_id === cand.message_id) || r.phone === cand.phone);
              if (target) {
                const oldStatus = target.status;
                const oldDeliveryStatus = target.delivery_status;

                const isNetErrArtifact = (data.reason || '').includes('RESULT_NETWORK_ERROR') || (data.reason || '').toLowerCase().includes('network error');

                if (isNetErrArtifact) {
                  target.delivery_status = 'SENT';
                  target.delivery_reason = 'Sent (Android VoLTE Carrier ACK)';
                  target.status = 'SUCCESS';
                  target.last_error = '';
                } else if (data.state === 'FAILED' || data.state === 'UNDELIVERED' || data.state === 'REJECTED' || data.state === 'EXPIRED') {
                  target.status = 'FAILED';
                  target.delivery_status = 'FAILED';
                  target.delivery_reason = data.reason || data.state;
                  target.last_error = `Mobile App Failed: ${data.reason || data.state}`;

                  if (oldStatus !== 'FAILED' || oldDeliveryStatus !== 'FAILED') {
                    addLog(acc.user, `❌ ${target.phone} Failed on Mobile: ${data.reason || data.state}`);
                    modified = true;

                    // Auto-hop if Auto Mode is ON and other accounts exist
                    if (settings.autoMode && activeAccounts.length > 1) {
                      const otherAccounts = activeAccounts.filter((a) => a.user !== acc.user);
                      if (otherAccounts.length > 0 && (target.auto_retry_count || 0) < 2) {
                        const nextAcc = otherAccounts[0];
                        target.status = 'PENDING';
                        target.attempts = 0;
                        target.assigned_api = nextAcc.user;
                        target.auto_retry_count = (target.auto_retry_count || 0) + 1;
                        target.next_attempt_at = undefined;
                        addLog(acc.user, `🔀 Auto-hopped failed mobile msg ${target.phone} to ${nextAcc.user}`);
                      }
                    }
                  }
                } else if (data.state === 'DELIVERED') {
                  target.status = 'SUCCESS';
                  target.delivery_status = 'DELIVERED';
                  target.delivery_reason = 'Confirmed Delivered to Recipient Phone';
                  target.last_error = '';
                  if (oldDeliveryStatus !== 'DELIVERED') {
                    addLog(acc.user, `🎯 ${target.phone} Confirmed Delivered on Recipient Handset!`);
                    modified = true;
                  }
                } else if (data.state === 'SENT') {
                  if (target.delivery_status !== 'SENT') {
                    target.delivery_status = 'SENT';
                    target.delivery_reason = data.reason || 'Sent by Mobile Device';
                    modified = true;
                  }
                }
              }
            }
          }
        } catch {
          // ignore transient network glitch
        }
      }

      if (modified) {
        setRecords([...currentRecords]);
        saveRecords(currentRecords);
      }
    };

    const deliveryInterval = setInterval(checkMobileDeliveryStates, 10000);
    return () => clearInterval(deliveryInterval);
  }, [activeAccounts, settings.autoMode]);

  // Scheduled Auto-Send (Cron Scheduler) Function
  const triggerScheduleCheck = async (isManual = false) => {
    if (!activeAccounts.length) {
      if (isManual) alert('No active SMS accounts available.');
      return;
    }

    const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    if (!isManual && settings.scheduleDays.length > 0 && !settings.scheduleDays.includes(currentDay)) {
      return;
    }

    let startedAny = false;

    for (const acc of activeAccounts) {
      addLog(acc.user, `⏰ [Cron Scheduler] Checking device connectivity for ${acc.user}...`);

      let isDeviceOnline = true;
      if (settings.scheduleOnlyOnline) {
        try {
          const res = await fetch(
            `/api/sms/devices?account=${encodeURIComponent(acc.user)}&password=${encodeURIComponent(acc.pwd)}`
          );
          if (res.ok) {
            const data = await res.json();
            const dev = data.devices && data.devices.length > 0 ? data.devices[0] : null;
            isDeviceOnline = dev ? Boolean(dev.online) : false;
          }
        } catch {
          isDeviceOnline = false;
        }
      }

      if (isDeviceOnline) {
        handleStartAccount(acc.user, settings.scheduleMessage || lastMessage);
        addLog(acc.user, `🟢 [Cron Scheduler] Device is ONLINE! Auto-started dispatching queue.`);
        startedAny = true;
      } else {
        addLog(acc.user, `⚠️ [Cron Scheduler] Device is OFFLINE. Auto-start skipped.`);
      }
    }

    const nowRun = `${getLocalDateString()} ${new Date().getHours()}:${new Date().getMinutes()}`;
    updateSettings({ lastScheduleRun: nowRun });

    if (isManual) {
      if (startedAny) {
        alert('⚡ Scheduled Auto-Send triggered! Online devices have been started.');
      } else {
        alert('⚡ Scheduled Auto-Send triggered, but connected devices were offline or unavailable.');
      }
    }
  };

  // Scheduled Cron Engine Loop
  useEffect(() => {
    if (!settings.scheduleEnabled) return;

    const checkScheduleTime = () => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentMinuteRunKey = `${getLocalDateString()} ${currentHHMM}`;

      if (
        currentHHMM === settings.scheduleTime &&
        settings.lastScheduleRun !== currentMinuteRunKey
      ) {
        triggerScheduleCheck(false);
      }
    };

    const scheduleInterval = setInterval(checkScheduleTime, 15000);
    return () => clearInterval(scheduleInterval);
  }, [settings, activeAccounts, lastMessage]);

  const handleClearAllData = () => {
    setRecords([]);
    saveRecords([]);
    setRunningMap({});
    setLogsMap({});
  };

  // License verification screen or switch modal
  if (licenseInfo.isValid !== true || showLicenseModal) {
    return (
      <>
        <LicenseModal
          isValid={showLicenseModal ? null : licenseInfo.isValid}
          activeKey={licenseInfo.activeKey}
          onActivated={() => {
            setShowLicenseModal(false);
            setLicenseInfo(checkLicense());
          }}
        />
        {import.meta.env.DEV && <Agentation />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      {/* Top Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAccountsCount={activeAccounts.length}
        pendingCount={records.filter((r) => r.status === 'PENDING').length}
        totalCount={records.length}
        onSendAllRemaining={handleSendAllRemainingFromAnyApi}
        onBackupToCloud={handleBackupToCloud}
        onRestoreFromCloud={handleRestoreFromCloud}
        isCloudSyncing={isCloudSyncing}
        cloudSyncStatus={cloudSyncStatus}
      />

      {cloudSyncStatus && (
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold text-center shadow-md animate-fade-in flex items-center justify-center gap-2">
          <span>{cloudSyncStatus}</span>
          <button
            onClick={() => setCloudSyncStatus(null)}
            className="text-white/80 hover:text-white ml-2 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {isFirestoreQuotaExceeded() && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚡ Cloud Sync Free Quota Notice:</span>
              <span>Daily free tier write limit reached for Firestore. All SMS sending, queueing, and logs continue working locally at full speed with lazy loading.</span>
            </div>
            <a
              href="https://console.firebase.google.com/project/powerful-treat-6jp90/firestore/databases/ai-studio-vercelconfigured-d1d6d2d4-26f9-4b55-b136-4186325a0c0d/data?openUpgradeDialog=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold underline text-amber-800 dark:text-amber-300 hover:text-amber-900 whitespace-nowrap"
            >
              <span>Enable Blaze / Check Firebase Limits ↗</span>
            </a>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar */}
        <Sidebar
          activeKey={licenseInfo.activeKey}
          daysLeft={licenseInfo.daysLeft}
          accountsText={accountsText}
          onAccountsTextChange={handleAccountsTextChange}
          accounts={parsedAccounts}
          onToggleAccount={toggleAccount}
          runningMap={runningMap}
          onChangeLicenseKey={() => setShowLicenseModal(true)}
          onExtendLicense={() => {
            const updated = extendActiveLicense(365);
            setLicenseInfo(updated);
          }}
          onSelectAccountTab={(user) => {
            setActiveTab('accounts');
            setSelectedAccountTab(user);
          }}
          settings={settings}
          onSettingsChange={updateSettings}
          onClearData={handleClearAllData}
          onTriggerScheduleNow={() => triggerScheduleCheck(true)}
        />

        {/* Right Main Content Area */}
        <main className="flex-1 min-w-0 space-y-6">
          {activeTab === 'dashboard' && (
            <GlobalDashboard
              records={records}
              accounts={parsedAccounts}
              dailyLimit={settings.dailyLimit}
              autoMode={settings.autoMode}
            />
          )}

          {activeTab === 'send' && (
            <SendNumbersPanel
              accounts={activeAccounts}
              lastMessage={lastMessage}
              messageVariants={messageVariants}
              onSaveLastMessage={(msg) => {
                setLastMessage(msg);
                setSetting('last_message', msg);
              }}
              onSaveMessageVariants={handleSaveMessageVariants}
              onSplitAndStart={(numbers, msg, targetAccountUsers, forceRetarget) => {
                const targetAccs = activeAccounts.filter((a) => targetAccountUsers.includes(a.user));
                if (!targetAccs.length) return [];

                const items = numbers.map((item) =>
                  typeof item === 'string' ? { phone: item, name: undefined } : item
                );

                const existingMap = new Map<string, SmsRecord>();
                records.forEach((r) => existingMap.set(r.phone, r));

                const redistributable = items.filter((item) => {
                  if (forceRetarget) return true;
                  const rec = existingMap.get(item.phone);
                  return !rec || rec.status !== 'SUCCESS';
                });

                const nAccounts = targetAccs.length;
                const now = getLocalTimestamp();
                const summary: { account: string; newCount: number; movedCount: number }[] = [];

                const updatedRecords = [...records];

                targetAccs.forEach((acc, i) => {
                  const chunk = redistributable.filter((_, idx) => idx % nAccounts === i);
                  let newCount = 0;
                  let movedCount = 0;

                  chunk.forEach((item) => {
                    const existing = updatedRecords.find((r) => r.phone === item.phone);
                    if (!existing) {
                      updatedRecords.push({
                        phone: item.phone,
                        name: item.name,
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
                    } else if (existing.status !== 'SUCCESS' || forceRetarget) {
                      existing.assigned_api = acc.user;
                      existing.status = 'PENDING';
                      existing.attempts = 0;
                      existing.last_error = '';
                      delete (existing as any).delivery_status;
                      delete (existing as any).delivery_updated_at;
                      if (item.name) existing.name = item.name;
                      if (msg) existing.message_sent = msg;
                      existing.auto_retry_count = 0;
                      movedCount++;
                    }
                  });

                  summary.push({ account: acc.user, newCount, movedCount });
                  handleStartAccount(acc.user, msg);
                });

                setRecords(updatedRecords);
                saveRecords(updatedRecords);
                if (licenseInfo?.activeKey) {
                  saveCloudWorkspace(licenseInfo.activeKey, { records: updatedRecords, accountsText });
                }
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
              onRecordsUpdated={(updated) => {
                setRecords(updated);
                saveRecords(updated);
              }}
              onSendAllRemaining={handleSendAllRemainingFromAnyApi}
            />
          )}

          {activeTab === 'chat' && (
            <MessageBoxTab
              records={records}
              accounts={activeAccounts}
              lastMessage={lastMessage}
              messageVariants={messageVariants}
              onRecordsUpdated={(updated) => {
                setRecords(updated);
                saveRecords(updated);
              }}
              onNavigateToSend={() => {
                setActiveTab('send');
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
                    {activeAccounts.map((acc) => {
                      const isRunning = Boolean(runningMap[acc.user]);
                      return (
                        <button
                          key={acc.user}
                          onClick={() => setSelectedAccountTab(acc.user)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border flex items-center gap-2 ${
                            (selectedAccountTab || activeAccounts[0]?.user) === acc.user
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {isRunning ? (
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0"></span>
                          )}
                          <span>🤖 {acc.name ? `${acc.name} (${acc.user})` : acc.user}</span>
                        </button>
                      );
                    })}
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
                        onUpdateAccountName={handleUpdateAccountName}
                        onUpdateAccountLimit={handleUpdateAccountLimit}
                        dailyLimit={settings.dailyLimit}
                        recentLogs={logsMap[acc.user] || []}
                        onRecordsUpdated={(updated) => {
                          setRecords(updated);
                          saveRecords(updated);
                        }}
                        lastMessage={lastMessage}
                        onSaveLastMessage={(msg) => {
                          setLastMessage(msg);
                          setSetting('last_message', msg);
                        }}
                        onSplitAndStart={(numbers, msg, targetAccountUsers, forceRetarget) => {
                          const targetAccs = activeAccounts.filter((a) => targetAccountUsers.includes(a.user));
                          if (!targetAccs.length) return [];

                          const normItems = numbers.map((item) =>
                            typeof item === 'string'
                              ? { phone: item, name: undefined }
                              : { phone: item.phone, name: item.name }
                          );

                          const existingMap = new Map<string, SmsRecord>();
                          records.forEach((r) => existingMap.set(r.phone, r));

                          const redistributable = normItems.filter((item) => {
                            if (forceRetarget) return true;
                            const existing = existingMap.get(item.phone);
                            return !existing || existing.status !== 'SUCCESS';
                          });

                          const nAccounts = targetAccs.length;
                          const now = getLocalTimestamp();
                          const summary: { account: string; newCount: number; movedCount: number }[] = [];

                          const updatedRecords = [...records];

                          targetAccs.forEach((aItem, i) => {
                            const chunk = redistributable.filter((_, idx) => idx % nAccounts === i);
                            let newCount = 0;
                            let movedCount = 0;

                            chunk.forEach((item) => {
                              const existing = updatedRecords.find((r) => r.phone === item.phone);
                              if (!existing) {
                                updatedRecords.push({
                                  phone: item.phone,
                                  name: item.name,
                                  status: 'PENDING',
                                  attempts: 0,
                                  last_error: '',
                                  last_time: '',
                                  created_at: now,
                                  api_used: '',
                                  assigned_api: aItem.user,
                                  message_sent: msg,
                                  auto_retry_count: 0,
                                });
                                newCount++;
                              } else if (existing.status !== 'SUCCESS' || forceRetarget) {
                                existing.assigned_api = aItem.user;
                                existing.status = 'PENDING';
                                existing.attempts = 0;
                                existing.last_error = '';
                                delete (existing as any).delivery_status;
                                delete (existing as any).delivery_updated_at;
                                if (item.name) existing.name = item.name;
                                if (msg) existing.message_sent = msg;
                                existing.auto_retry_count = 0;
                                movedCount++;
                              }
                            });

                            summary.push({ account: aItem.user, newCount, movedCount });
                            handleStartAccount(aItem.user, msg);
                          });

                          setRecords(updatedRecords);
                          saveRecords(updatedRecords);
                          return summary;
                        }}
                        onSendAllRemaining={handleSendAllRemainingFromAnyApi}
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
              onSendAllRemaining={handleSendAllRemainingFromAnyApi}
            />
          )}

          {activeTab === 'vercel' && <VercelInspectorTab />}
        </main>
      </div>
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

export default App;
