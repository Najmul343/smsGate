import React, { useState } from 'react';
import { SmsRecord, SmsAccount } from '../types/sms';
import {
  getRoutesWithPending,
  reassignNumbers,
  getDeliveryStats,
  saveRecords,
  getLocalTimestamp,
} from '../utils/dbStore';
import { parseExcelFile } from '../utils/excelParser';
import {
  Truck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  ShieldAlert,
  Search,
  Database,
  Trash2,
  Clock,
  Send,
  Edit3,
  RotateCcw,
  UserCheck,
  Smartphone,
  CheckSquare,
  Square,
  Sparkles,
  Info,
} from 'lucide-react';

interface MasterLogTabProps {
  records: SmsRecord[];
  accounts: SmsAccount[];
  onRecordsUpdated: (updated: SmsRecord[]) => void;
}

export const MasterLogTab: React.FC<MasterLogTabProps> = ({
  records,
  accounts,
  onRecordsUpdated,
}) => {
  // Selection State for Bulk Operations
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());

  // Editing Name Modal / State
  const [editingRecordPhone, setEditingRecordPhone] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');

  // Reassignment Center State
  const routesPending = getRoutesWithPending(records);
  const activeAccountUsers = accounts.filter((a) => a.enabled).map((a) => a.user);
  const [moveFrom, setMoveFrom] = useState(routesPending[0]?.assigned_api || '');
  const [moveTo, setMoveTo] = useState(activeAccountUsers[0] || '');
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState('');

  // Retargeting State
  const [retargetScope, setRetargetScope] = useState<'all' | 'account' | 'date' | 'list'>('all');
  const [retargetAccountFilter, setRetargetAccountFilter] = useState('');
  const [retargetBeforeDate, setRetargetBeforeDate] = useState('');
  const [retargetPhoneList, setRetargetPhoneList] = useState<string[]>([]);
  const [retargetReassignChoice, setRetargetReassignChoice] = useState('keep');
  const [retargetConfirmed, setRetargetConfirmed] = useState(false);
  const [retargetMsg, setRetargetMsg] = useState('');

  // Delivery check state
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [deliveryCheckMsg, setDeliveryCheckMsg] = useState('');

  // Data Table Filter State
  const [viewFilter, setViewFilter] = useState<'all' | 'success' | 'pending' | 'failed' | 'delivered' | 'failed_phone'>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Reassignment Action
  const handleMoveNumbers = () => {
    if (!moveFrom || !moveTo) return;
    if (moveFrom === moveTo) {
      alert('Cannot move to the same route!');
      return;
    }
    const res = reassignNumbers(records, moveFrom, moveTo);
    onRecordsUpdated(res.updatedRecords);
    setReassignSuccessMsg(`✅ Moved ${res.count} pending numbers from '${moveFrom}' to '${moveTo}'!`);
  };

  // Retargeting Action
  const handleRetargetListUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      setRetargetPhoneList(parsed.numbers);
    } catch {
      alert('Error reading Excel for retarget list.');
    }
  };

  // Calculate candidates for retargeting
  const getRetargetCandidates = (): SmsRecord[] => {
    return records.filter((r) => {
      if (r.status !== 'SUCCESS') return false;
      if (retargetScope === 'account' && retargetAccountFilter && r.assigned_api !== retargetAccountFilter) {
        return false;
      }
      if (retargetScope === 'date' && retargetBeforeDate && r.last_time >= retargetBeforeDate) {
        return false;
      }
      if (retargetScope === 'list' && retargetPhoneList.length > 0 && !retargetPhoneList.includes(r.phone)) {
        return false;
      }
      return true;
    });
  };

  const candidatesToRetarget = getRetargetCandidates();

  const handleRetargetNow = () => {
    if (!retargetConfirmed || candidatesToRetarget.length === 0) return;

    const targetSet = new Set(candidatesToRetarget.map((c) => c.phone));
    let count = 0;

    const updated = [...records];
    updated.forEach((r) => {
      if (targetSet.has(r.phone)) {
        r.status = 'PENDING';
        r.attempts = 0;
        r.last_error = '';
        if (retargetReassignChoice !== 'keep') {
          r.assigned_api = retargetReassignChoice;
        }
        count++;
      }
    });

    saveRecords(updated);
    onRecordsUpdated(updated);
    setRetargetMsg(`✅ ${count} number(s) reset to PENDING and re-queued for sending.`);
  };

  // Manual delivery check
  const handleCheckDeliveryNow = async () => {
    setCheckingDelivery(true);
    setDeliveryCheckMsg('');
    try {
      const candidates = records.filter(
        (r) =>
          r.status === 'SUCCESS' &&
          r.message_id &&
          (!r.delivery_status || (r.delivery_status !== 'DELIVERED' && r.delivery_status !== 'FAILED'))
      ).slice(0, 50);

      if (candidates.length === 0) {
        setDeliveryCheckMsg('No pending delivery status confirmations found to check.');
        setCheckingDelivery(false);
        return;
      }

      let checkedCount = 0;
      const updated = [...records];
      for (const cand of candidates) {
        const acc = accounts.find((a) => a.user === cand.api_used || a.user === cand.assigned_api);
        if (!acc) continue;

        try {
          const res = await fetch(
            `/api/sms/delivery?messageId=${encodeURIComponent(cand.message_id!)}&account=${encodeURIComponent(acc.user)}&password=${encodeURIComponent(acc.pwd)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.state) {
              const target = updated.find(r => r.phone === cand.phone);
              if (target) {
                target.delivery_status = data.state;
                target.delivery_reason = data.reason || '';
                target.delivery_checked_at = getLocalTimestamp();
              }
              checkedCount++;
            }
          }
        } catch {}
      }

      saveRecords(updated);
      onRecordsUpdated(updated);
      setDeliveryCheckMsg(`Checked ${checkedCount} message delivery confirmations!`);
    } catch {
      setDeliveryCheckMsg('Delivery check complete.');
    } finally {
      setCheckingDelivery(false);
    }
  };

  // CSV Complete Database Report Generator
  const handleDownloadCSV = (onlySelected = false) => {
    let source = onlySelected
      ? records.filter((r) => selectedPhones.has(r.phone))
      : displayRecords;

    if (source.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'Name',
      'Phone Number',
      'Status',
      'Delivery Status',
      'Assigned Device',
      'API Used',
      'Message Sent',
      'Attempts',
      'Auto Retry Count',
      'Failure Error Reason',
      'Delivery Reason',
      'Created At',
      'Last Time Updated',
    ];

    const rows = source.map((r) => [
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      `"${r.status}"`,
      `"${r.delivery_status || ''}"`,
      `"${r.assigned_api}"`,
      `"${r.api_used}"`,
      `"${(r.message_sent || '').replace(/"/g, '""')}"`,
      r.attempts,
      r.auto_retry_count || 0,
      `"${(r.last_error || '').replace(/"/g, '""')}"`,
      `"${(r.delivery_reason || '').replace(/"/g, '""')}"`,
      `"${r.created_at || ''}"`,
      `"${r.last_time || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `global_sms_database_${onlySelected ? 'selected' : 'report'}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Record Single Action Handlers
  const handleRetryRecord = (phone: string) => {
    const updated = records.map((r) => {
      if (r.phone === phone) {
        return {
          ...r,
          status: 'PENDING' as const,
          attempts: 0,
          last_error: '',
          next_attempt_at: undefined,
        };
      }
      return r;
    });
    saveRecords(updated);
    onRecordsUpdated(updated);
  };

  const handleDeleteRecord = (phone: string) => {
    if (window.confirm(`Delete ${phone} from global database?`)) {
      const updated = records.filter((r) => r.phone !== phone);
      saveRecords(updated);
      onRecordsUpdated(updated);
      selectedPhones.delete(phone);
      setSelectedPhones(new Set(selectedPhones));
    }
  };

  const handleSaveNameEdit = () => {
    if (!editingRecordPhone) return;
    const updated = records.map((r) => {
      if (r.phone === editingRecordPhone) {
        return { ...r, name: editingNameValue.trim() || undefined };
      }
      return r;
    });
    saveRecords(updated);
    onRecordsUpdated(updated);
    setEditingRecordPhone(null);
    setEditingNameValue('');
  };

  // Bulk Operations
  const handleToggleSelectAll = () => {
    if (selectedPhones.size === displayRecords.length && displayRecords.length > 0) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(new Set(displayRecords.map((r) => r.phone)));
    }
  };

  const handleBulkDelete = () => {
    if (!selectedPhones.size) return;
    if (window.confirm(`Delete ${selectedPhones.size} selected records from database?`)) {
      const updated = records.filter((r) => !selectedPhones.has(r.phone));
      saveRecords(updated);
      onRecordsUpdated(updated);
      setSelectedPhones(new Set());
    }
  };

  const handleBulkRequeue = () => {
    if (!selectedPhones.size) return;
    const updated = records.map((r) => {
      if (selectedPhones.has(r.phone)) {
        return {
          ...r,
          status: 'PENDING' as const,
          attempts: 0,
          last_error: '',
        };
      }
      return r;
    });
    saveRecords(updated);
    onRecordsUpdated(updated);
    alert(`Re-queued ${selectedPhones.size} records back to PENDING!`);
  };

  // Filtered Records for Display
  let displayRecords = [...records];
  if (viewFilter === 'success') displayRecords = displayRecords.filter((r) => r.status === 'SUCCESS');
  else if (viewFilter === 'pending') displayRecords = displayRecords.filter((r) => r.status === 'PENDING');
  else if (viewFilter === 'failed') displayRecords = displayRecords.filter((r) => r.status === 'FAILED');
  else if (viewFilter === 'delivered') displayRecords = displayRecords.filter((r) => r.delivery_status === 'DELIVERED');
  else if (viewFilter === 'failed_phone') displayRecords = displayRecords.filter((r) => r.delivery_status === 'FAILED');

  if (deviceFilter !== 'all') {
    displayRecords = displayRecords.filter((r) => r.assigned_api === deviceFilter || r.api_used === deviceFilter);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    displayRecords = displayRecords.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(term)) ||
        r.phone.toLowerCase().includes(term) ||
        r.assigned_api.toLowerCase().includes(term) ||
        r.api_used.toLowerCase().includes(term) ||
        r.message_sent.toLowerCase().includes(term) ||
        (r.last_error && r.last_error.toLowerCase().includes(term)) ||
        (r.delivery_reason && r.delivery_reason.toLowerCase().includes(term))
    );
  }

  const deliveryStats = getDeliveryStats(records);
  const successAccountsList = Array.from(
    new Set(records.filter((r) => r.status === 'SUCCESS' && r.assigned_api).map((r) => r.assigned_api))
  );

  // Stats calculation
  const totalRecordsCount = records.length;
  const pendingCount = records.filter((r) => r.status === 'PENDING').length;
  const successCount = records.filter((r) => r.status === 'SUCCESS').length;
  const failedCount = records.filter((r) => r.status === 'FAILED').length;
  const deliveredCount = deliveryStats.delivered;
  const phoneFailedCount = deliveryStats.failed;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>🌐 Global Database & Master Reports</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Centralized repository for all added phone numbers, names, delivery logs, failure reasons, and retry histories across all API devices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDownloadCSV(false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>📥 Export CSV Database</span>
            </button>
          </div>
        </div>

        {/* Global Database Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">📊 Total DB Records</span>
            <span className="text-xl font-black text-slate-900 dark:text-white">{totalRecordsCount}</span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">✅ Confirmed Delivered</span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{deliveredCount}</span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block">🚀 Gateway Sent</span>
            <span className="text-xl font-black text-blue-700 dark:text-blue-300">{successCount}</span>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">⏳ Queue Pending</span>
            <span className="text-xl font-black text-amber-700 dark:text-amber-300">{pendingCount}</span>
          </div>

          <div className="bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400 block">❌ Rejected / Failed</span>
            <span className="text-xl font-black text-red-700 dark:text-red-300">{failedCount + phoneFailedCount}</span>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">👥 Named Records</span>
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
              {records.filter((r) => Boolean(r.name)).length}
            </span>
          </div>
        </div>

        {/* Global Database Search & Filtering Toolbar */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 text-xs font-semibold">
              <Filter className="w-4 h-4 text-slate-400 shrink-0 ml-1 mr-1" />
              {[
                { id: 'all', label: `All (${records.length})` },
                { id: 'delivered', label: `Delivered (${deliveredCount})` },
                { id: 'success', label: `Gateway Sent (${successCount})` },
                { id: 'pending', label: `Pending (${pendingCount})` },
                { id: 'failed', label: `Gateway Failed (${failedCount})` },
                { id: 'failed_phone', label: `Phone Failed (${phoneFailedCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setViewFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    viewFilter === f.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Device Filter & Search */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="w-full sm:w-44 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-white"
              >
                <option value="all">📱 All API Devices</option>
                {accounts.map((acc) => (
                  <option key={acc.user} value={acc.user}>
                    🤖 {acc.user}
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, error, message..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Bulk Action Bar (when rows selected) */}
          {selectedPhones.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>{selectedPhones.size} records selected</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkRequeue}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-queue Selected</span>
                </button>
                <button
                  onClick={() => handleDownloadCSV(true)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-all flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Selected</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Database Master Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="max-h-[500px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <button onClick={handleToggleSelectAll} title="Select All">
                      {selectedPhones.size > 0 && selectedPhones.size === displayRecords.length ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 min-w-[130px]">Client / Contact Name</th>
                  <th className="px-3 py-3 min-w-[120px]">Phone Number</th>
                  <th className="px-3 py-3 min-w-[100px]">Gateway Status</th>
                  <th className="px-3 py-3 min-w-[110px]">Delivery Status</th>
                  <th className="px-3 py-3 min-w-[110px]">Assigned / API Used</th>
                  <th className="px-3 py-3 min-w-[80px]">Retries</th>
                  <th className="px-3 py-3 min-w-[180px]">Failure / Error Reason</th>
                  <th className="px-3 py-3 min-w-[180px]">Message Content</th>
                  <th className="px-3 py-3 min-w-[130px]">Timestamp</th>
                  <th className="px-3 py-3 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-slate-800 dark:text-slate-200">
                {displayRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-sans">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Database className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="font-bold text-xs text-slate-600 dark:text-slate-300">No database records found</p>
                        <p className="text-[11px] text-slate-400">Try adjusting your filters or search terms.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayRecords.map((r, i) => {
                    const isSelected = selectedPhones.has(r.phone);
                    const errorReason = r.last_error || r.delivery_reason || '-';

                    return (
                      <tr
                        key={r.phone + i}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => {
                              const newSet = new Set(selectedPhones);
                              if (isSelected) newSet.delete(r.phone);
                              else newSet.add(r.phone);
                              setSelectedPhones(newSet);
                            }}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </button>
                        </td>

                        {/* Name Column with Edit Button */}
                        <td className="px-3 py-2.5 font-sans font-semibold text-slate-900 dark:text-slate-100">
                          {editingRecordPhone === r.phone ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingNameValue}
                                onChange={(e) => setEditingNameValue(e.target.value)}
                                className="px-2 py-0.5 rounded border border-emerald-500 bg-white dark:bg-slate-950 text-xs w-28 text-slate-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                onClick={handleSaveNameEdit}
                                className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span className={r.name ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic font-normal text-[11px]'}>
                                {r.name || 'No Name'}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingRecordPhone(r.phone);
                                  setEditingNameValue(r.name || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity"
                                title="Edit name"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Phone Column */}
                        <td className="px-3 py-2.5 font-bold font-mono text-slate-900 dark:text-white">
                          {r.phone}
                        </td>

                        {/* Gateway Status Badge */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : r.status === 'FAILED'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>

                        {/* Delivery Status Badge */}
                        <td className="px-3 py-2.5 font-bold">
                          {r.delivery_status === 'DELIVERED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                              ✅ DELIVERED
                            </span>
                          ) : r.delivery_status === 'FAILED' || r.delivery_status === 'UNDELIVERED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-50 dark:bg-red-950 text-red-600 border border-red-200 dark:border-red-800">
                              ❌ REJECTED
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">
                              {r.delivery_status || 'AWAITING'}
                            </span>
                          )}
                        </td>

                        {/* Assigned API / API Used */}
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          <div>{r.assigned_api || '-'}</div>
                          {r.api_used && r.api_used !== r.assigned_api && (
                            <div className="text-[10px] text-slate-400">Used: {r.api_used}</div>
                          )}
                        </td>

                        {/* Attempts & Retries */}
                        <td className="px-3 py-2.5 text-[11px] font-bold">
                          <span className={r.attempts > 1 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>
                            {r.attempts} try
                          </span>
                          {(r.auto_retry_count || 0) > 0 && (
                            <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold">
                              {r.auto_retry_count} hop
                            </div>
                          )}
                        </td>

                        {/* Failure Error Reason */}
                        <td className="px-3 py-2.5 font-sans text-[11px]">
                          {errorReason !== '-' ? (
                            <span className="text-red-600 dark:text-red-400 font-mono text-[10px] break-all bg-red-50/60 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                              {errorReason}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">-</span>
                          )}
                        </td>

                        {/* Message Content */}
                        <td className="px-3 py-2.5 font-sans text-[11px] text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={r.message_sent}>
                          {r.message_sent || <span className="text-slate-400 italic font-mono text-[10px]">No message body</span>}
                        </td>

                        {/* Timestamp */}
                        <td className="px-3 py-2.5 text-slate-400 text-[10px] font-mono">
                          {r.last_time || r.created_at || '-'}
                        </td>

                        {/* Inline Actions */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleRetryRecord(r.phone)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Reset status & re-queue for sending"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(r.phone)}
                              className="text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete record from database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-sans">
            <span>
              Showing <strong>{displayRecords.length}</strong> of <strong>{records.length}</strong> total records in database
            </span>

            <span className="text-[11px] text-slate-400">
              💡 Tip: Double-click or hover on any row name to quickly edit client contact information.
            </span>
          </div>
        </div>

        {/* Collapsible Utility Sub-sections (Reassignment & Retargeting) */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Database Utilities & Route Re-routing Tools</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Reassignment Center */}
            <details className="group border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
              <summary className="p-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span>🚚 Route Reassignment Center</span>
                </span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 bg-white dark:bg-slate-900 space-y-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  Move pending queued numbers from an offline/dead route to an active route.
                </p>

                {routesPending.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono">No pending numbers sitting in any route.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Move FROM:</label>
                        <select
                          value={moveFrom}
                          onChange={(e) => setMoveFrom(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                        >
                          {routesPending.map((r) => (
                            <option key={r.assigned_api} value={r.assigned_api}>
                              {r.assigned_api} ({r.count} pending)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Move TO:</label>
                        <select
                          value={moveTo}
                          onChange={(e) => setMoveTo(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                        >
                          {activeAccountUsers.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleMoveNumbers}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Truck className="w-3.5 h-3.5" /> Move Numbers Between Routes
                    </button>
                  </div>
                )}

                {reassignSuccessMsg && <p className="text-xs font-bold text-emerald-600">{reassignSuccessMsg}</p>}
              </div>
            </details>

            {/* 2. Real Phone Delivery Checker */}
            <details className="group border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
              <summary className="p-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-500" />
                  <span>📶 Real Phone Delivery Status Checker</span>
                </span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-4 bg-white dark:bg-slate-900 space-y-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  Verifies whether messages accepted by the gateway actually reached the recipient device.
                </p>

                <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                    <span className="text-slate-400 block text-[9px]">DELIVERED</span>
                    <span className="font-bold text-emerald-600 text-sm">{deliveryStats.delivered}</span>
                  </div>
                  <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-lg">
                    <span className="text-slate-400 block text-[9px]">FAILED</span>
                    <span className="font-bold text-red-600 text-sm">{deliveryStats.failed}</span>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                    <span className="text-slate-400 block text-[9px]">AWAITING</span>
                    <span className="font-bold text-blue-600 text-sm">{deliveryStats.awaiting}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckDeliveryNow}
                  disabled={checkingDelivery}
                  className="w-full py-2 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingDelivery ? 'animate-spin' : ''}`} />
                  <span>{checkingDelivery ? 'Checking delivery status...' : '🔄 Check delivery status now'}</span>
                </button>

                {deliveryCheckMsg && <p className="text-xs font-semibold text-emerald-600">{deliveryCheckMsg}</p>}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};
