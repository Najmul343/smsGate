import React, { useState, useEffect } from 'react';
import { SmsAccount, SavedFolder, SmsRecord } from '../types/sms';
import { normalizePhone } from '../utils/normalize';
import { loadSavedFolders, saveSavedFolders, loadRecords, insertNumbers, getMessageVariants, setMessageVariants, getRandomMessageVariant } from '../utils/dbStore';
import { MessageVariantsEditor } from './MessageVariantsEditor';
import { FileSpreadsheet, Clipboard, Plus, Trash2, Save, Send, Sparkles, CheckCircle2, AlertCircle, RefreshCw, FolderPlus, FileText } from 'lucide-react';

interface RowData {
  id: string;
  phone: string;
  name?: string;
  valid: boolean;
  duplicate: boolean;
  normalizedPhone: string;
}

interface LiveExcelGridProps {
  accounts: SmsAccount[];
  lastMessage: string;
  messageVariants?: string[];
  onSaveLastMessage: (msg: string) => void;
  onSaveMessageVariants?: (variants: string[]) => void;
  onSplitAndStart: (numbers: (string | { phone: string; name?: string })[], message: string, targetAccountUsers: string[]) => { account: string; newCount: number; movedCount: number }[];
  initialNumbers?: string[];
  initialSheetName?: string;
  initialFolderName?: string;
  onSaveComplete?: () => void;
  onRecordsUpdated?: (updated: SmsRecord[]) => void;
  onSendAllRemaining?: () => void;
}

export const LiveExcelGrid: React.FC<LiveExcelGridProps> = ({
  accounts,
  lastMessage,
  messageVariants: propVariants,
  onSaveLastMessage,
  onSaveMessageVariants,
  onSplitAndStart,
  initialNumbers = [],
  initialSheetName = '',
  initialFolderName = '',
  onSaveComplete,
  onRecordsUpdated,
  onSendAllRemaining,
}) => {
  const [rows, setRows] = useState<RowData[]>([]);
  const [pasteInput, setPasteInput] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [sheetName, setSheetName] = useState(initialSheetName || `Excel_Paste_${new Date().toISOString().substring(0, 10)}`);
  const [folders, setFolders] = useState<SavedFolder[]>(loadSavedFolders());
  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolderName || folders[0]?.name || 'Default');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderCreate, setShowFolderCreate] = useState(false);

  const [messageVariantsState, setMessageVariantsState] = useState<string[]>(
    () => propVariants || getMessageVariants()
  );
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(accounts.filter(a => a.enabled).map(a => a.user));
  const [forceRetargetMode, setForceRetargetMode] = useState(false);
  const [actionSummary, setActionSummary] = useState<string | null>(null);

  const activeAccountUsers = accounts.filter((a) => a.enabled).map((a) => a.user);

  useEffect(() => {
    const activeUsers = accounts.filter((a) => a.enabled).map((a) => a.user);
    if (activeUsers.length > 0) {
      setSelectedAccounts((prev) => {
        if (prev.length === 0) return activeUsers;
        const validPrev = prev.filter((u) => activeUsers.includes(u));
        return validPrev.length > 0 ? validPrev : activeUsers;
      });
    }
  }, [accounts]);

  useEffect(() => {
    if (propVariants) {
      setMessageVariantsState(propVariants);
    }
  }, [propVariants]);

  const handleUpdateVariants = (updated: string[]) => {
    setMessageVariantsState(updated);
    setMessageVariants(updated);
    if (updated[0] !== undefined) {
      onSaveLastMessage(updated[0]);
    }
    if (onSaveMessageVariants) {
      onSaveMessageVariants(updated);
    }
  };

  // Initialize with initialNumbers if provided
  useEffect(() => {
    if (initialNumbers && initialNumbers.length > 0) {
      parseAndSetRawText(initialNumbers.join('\n'));
    }
  }, [initialNumbers]);

  // Recalculate row validity & duplicate states whenever rows change
  const processRows = (rawList: { phone: string; name?: string }[]): RowData[] => {
    const seen = new Set<string>();
    return rawList.map((item, idx) => {
      const norm = normalizePhone(item.phone);
      const isValid = Boolean(norm);
      let isDuplicate = false;

      if (norm) {
        if (seen.has(norm)) {
          isDuplicate = true;
        } else {
          seen.add(norm);
        }
      }

      return {
        id: `row-${idx}-${Date.now()}-${Math.random()}`,
        phone: item.phone,
        name: item.name || '',
        valid: isValid,
        duplicate: isDuplicate,
        normalizedPhone: norm || '',
      };
    });
  };

  // Helper to parse pasted TSV / CSV / Multi-line text
  const parseAndSetRawText = (rawText: string) => {
    if (!rawText.trim()) return;

    const lines = rawText.split(/\r?\n/);
    const parsedList: { phone: string; name?: string }[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Handle tab-separated (from Excel / Google Sheets copy paste)
      if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t').map((p) => p.trim());
        // Find which part looks like a phone number or default to col 0 / col 1
        let phoneVal = parts[0];
        let nameVal = parts[1] || '';

        // If part[1] is phone and part[0] is name
        if (normalizePhone(parts[1]) && !normalizePhone(parts[0])) {
          phoneVal = parts[1];
          nameVal = parts[0];
        }

        parsedList.push({ phone: phoneVal, name: nameVal });
      } else if (trimmed.includes(',')) {
        // CSV line
        const parts = trimmed.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
        parsedList.push({ phone: parts[0], name: parts[1] || '' });
      } else {
        // Plain line with single number or string
        parsedList.push({ phone: trimmed });
      }
    });

    const newRowData = processRows(parsedList);
    setRows(newRowData);
  };

  const handlePasteSubmit = () => {
    parseAndSetRawText(pasteInput);
    setPasteInput('');
    setShowPasteModal(false);
  };

  const handleCellChange = (id: string, field: 'phone' | 'name', value: string) => {
    const updated = rows.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    // Re-evaluate duplicates and validity
    const reProcessed = processRows(updated.map((r) => ({ phone: r.phone, name: r.name })));
    setRows(reProcessed);
  };

  const handleDeleteRow = (id: string) => {
    const updated = rows.filter((r) => r.id !== id);
    setRows(processRows(updated.map((r) => ({ phone: r.phone, name: r.name }))));
  };

  const handleAddRow = () => {
    const newRows = [...rows, { id: `row-${Date.now()}`, phone: '', name: '', valid: false, duplicate: false, normalizedPhone: '' }];
    setRows(newRows);
  };

  const handleClearAll = () => {
    setRows([]);
  };

  const handleCleanGrid = () => {
    // Keep only valid, non-duplicate entries
    const cleanList = rows
      .filter((r) => r.valid && !r.duplicate)
      .map((r) => ({ phone: r.normalizedPhone, name: r.name }));
    setRows(processRows(cleanList));
  };

  // Stats
  const validRows = rows.filter((r) => r.valid && !r.duplicate);
  const invalidCount = rows.filter((r) => !r.valid && r.phone.trim() !== '').length;
  const duplicateCount = rows.filter((r) => r.duplicate).length;

  // Save to Folder Library
  const handleSaveToFolder = () => {
    const cleanName = sheetName.trim().replace(/[\\/:*?"<>|]/g, '_') || `Sheet_${Date.now()}`;
    const validNumbers = validRows.map((r) => r.normalizedPhone);

    if (!validNumbers.length) {
      alert('Grid contains no valid numbers to save.');
      return;
    }

    let targetFolder = selectedFolder;
    if (!targetFolder) {
      targetFolder = 'Default';
    }

    const currentFolders = loadSavedFolders();
    let folderExists = currentFolders.some((f) => f.name === targetFolder);

    let updatedFolders = currentFolders;
    if (!folderExists) {
      updatedFolders = [...currentFolders, { name: targetFolder, files: [] }];
    }

    updatedFolders = updatedFolders.map((f) => {
      if (f.name === targetFolder) {
        // Replace or update file with cleanName
        const otherFiles = f.files.filter((x) => x.filename !== cleanName);
        return {
          ...f,
          files: [
            ...otherFiles,
            {
              filename: cleanName,
              numbers: validNumbers,
              savedAt: new Date().toISOString().substring(0, 10),
            },
          ],
        };
      }
      return f;
    });

    setFolders(updatedFolders);
    saveSavedFolders(updatedFolders);
    setActionSummary(`💾 Saved sheet '${cleanName}' (${validNumbers.length} numbers) into folder '${targetFolder}'!`);
    if (onSaveComplete) onSaveComplete();
  };

  // Folder creation
  const handleCreateNewFolder = () => {
    const clean = newFolderName.trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!clean) return;
    const current = loadSavedFolders();
    if (current.some((f) => f.name === clean)) {
      alert('Folder name already exists!');
      return;
    }
    const updated = [...current, { name: clean, files: [] }];
    setFolders(updated);
    saveSavedFolders(updated);
    setSelectedFolder(clean);
    setNewFolderName('');
    setShowFolderCreate(false);
  };

  // Send directly
  const handleSendLiveGrid = (force?: boolean) => {
    const isForce = force !== undefined ? force : forceRetargetMode;
    const validItems = validRows.map((r) => ({ phone: r.normalizedPhone, name: r.name }));
    if (!validItems.length) {
      alert('Grid contains no valid numbers to send.');
      return;
    }
    if (!selectedAccounts.length) {
      alert('Please select at least one active API device.');
      return;
    }

    const activeMessage = messageVariantsState.find((v) => v.trim().length > 0) || lastMessage;
    onSaveLastMessage(activeMessage);
    const summary = onSplitAndStart(validItems, activeMessage, selectedAccounts, isForce);
    setActionSummary(`🚀 Dispatched ${validItems.length} numbers across ${summary.length} active device(s)${isForce ? ' (Force Retargeted All Numbers)' : ''}!`);
  };

  // Queue to Master 'Yet to Send' Database directly
  const handleQueueToMaster = (force?: boolean) => {
    const isForce = force !== undefined ? force : forceRetargetMode;
    const validItems = validRows.map((r) => ({ phone: r.normalizedPhone, name: r.name }));
    if (!validItems.length) {
      alert('Grid contains no valid numbers to queue.');
      return;
    }

    const activeMessage = messageVariantsState.find((v) => v.trim().length > 0) || lastMessage;
    const currentRecords = loadRecords();
    const targetRoute = selectedAccounts[0] || '';
    const res = insertNumbers(currentRecords, validItems, targetRoute, activeMessage, isForce);
    if (onRecordsUpdated) {
      onRecordsUpdated(res.updatedRecords);
    }
    setActionSummary(`✅ Added ${res.newCount} new and ${res.requeuedCount} re-queued numbers to 'Yet to Send' database${isForce ? ' (Force Retargeted All Numbers)' : ''}!`);
  };

  const handleForceRetargetAndSend = () => {
    handleSendLiveGrid(true);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>📋 Live Excel / Google Sheets Pasting</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Copy columns directly from Excel or Google Sheets (Ctrl+C / Cmd+C) and paste right into the live grid below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPasteModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
            >
              <Clipboard className="w-4 h-4" />
              <span>Paste Copied Excel Data</span>
            </button>

            {rows.length > 0 && (
              <>
                <button
                  onClick={handleCleanGrid}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-200 font-bold rounded-xl text-xs transition-all flex items-center gap-1"
                  title="Remove invalid and duplicate numbers"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Clean Grid</span>
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-2.5 py-2 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-200 font-bold rounded-xl text-xs transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Grid</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Grid Metrics Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-mono font-semibold">
          <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {validRows.length} Valid Numbers
          </span>
          {invalidCount > 0 && (
            <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-800 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {invalidCount} Invalid Skipped
            </span>
          )}
          {duplicateCount > 0 && (
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 flex items-center gap-1">
              {duplicateCount} Duplicates
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500 ml-auto text-[11px] font-sans">
            Total Rows: {rows.length}
          </span>
        </div>
      </div>

      {/* Paste Modal / Dialog */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Clipboard className="w-5 h-5 text-emerald-600" />
                <span>Paste copied Excel or Sheets cells</span>
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Copy rows/columns directly from Microsoft Excel, Google Sheets, or CSV file and paste in the box below:
            </p>

            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              rows={8}
              placeholder={`Example:\n+1234567890\tJohn Doe\n+9876543210\tSarah Smith\n\nOr paste single column of numbers...`}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                disabled={!pasteInput.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
              >
                📥 Load into Grid Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Content & Account Dispatch Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <MessageVariantsEditor
          variants={messageVariantsState}
          onChangeVariants={handleUpdateVariants}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Target Active API Devices ({selectedAccounts.length} selected)
          </label>
          <div className="flex flex-wrap gap-2">
            {activeAccountUsers.map((user) => {
              const isSelected = selectedAccounts.includes(user);
              return (
                <button
                  key={user}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedAccounts(selectedAccounts.filter((u) => u !== user));
                    } else {
                      setSelectedAccounts([...selectedAccounts, user]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {user} {isSelected ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Force Retarget Option Toggle */}
        <div className="flex items-center justify-between p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900 dark:text-amber-300">
            <input
              type="checkbox"
              checked={forceRetargetMode}
              onChange={(e) => setForceRetargetMode(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 accent-amber-600 cursor-pointer"
            />
            <span>🎯 Force Retarget Mode (Reset & re-send numbers even if they were already sent or delivered before)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleQueueToMaster()}
            disabled={!validRows.length}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="Add numbers to 'Yet to Send' queue"
          >
            <Plus className="w-4 h-4" />
            <span>📥 Add to 'Yet to Send' Queue</span>
          </button>

          <button
            onClick={() => handleSendLiveGrid()}
            disabled={!validRows.length || !selectedAccounts.length}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="Split numbers across selected active devices and start sending"
          >
            <Send className="w-4 h-4" />
            <span>🚀 Split & Start Grid</span>
          </button>

          <button
            onClick={handleForceRetargetAndSend}
            disabled={!validRows.length || !selectedAccounts.length}
            className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="Re-add these numbers and send immediately, even if they were already sent before"
          >
            <RefreshCw className="w-4 h-4" />
            <span>🔄 Force Retarget & Send</span>
          </button>

          {onSendAllRemaining && (
            <button
              onClick={onSendAllRemaining}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 animate-pulse"
              title="Remove account filters and send all remaining database numbers from any available API!"
            >
              <Send className="w-4 h-4" />
              <span>🌐 Send All Remaining (Any API)</span>
            </button>
          )}
        </div>
      </div>

      {actionSummary && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSummary}</span>
        </div>
      )}

      {/* Live Excel Spreadsheet Interactive Grid */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center border-b border-slate-200 dark:border-slate-700">#</th>
                <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">Phone Number (Editable)</th>
                <th className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">Name / Note (Optional)</th>
                <th className="px-3 py-2.5 w-28 text-center border-b border-slate-200 dark:border-slate-700">Validation</th>
                <th className="px-3 py-2.5 w-12 text-center border-b border-slate-200 dark:border-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">Live Grid Table is empty</p>
                      <p className="text-[11px] text-slate-400">
                        Click <strong className="text-emerald-600">"Paste Copied Excel Data"</strong> or click <strong className="text-slate-700 dark:text-slate-200">"+ Add Row"</strong> below to type numbers directly.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2 text-center text-slate-400 font-bold text-[11px]">
                      {index + 1}
                    </td>

                    {/* Phone Cell */}
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.phone}
                        onChange={(e) => handleCellChange(row.id, 'phone', e.target.value)}
                        placeholder="+1234567890"
                        className={`w-full px-2 py-1 rounded border bg-transparent font-mono text-xs outline-none focus:ring-1 ${
                          !row.valid && row.phone.trim() !== ''
                            ? 'border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50/40'
                            : row.duplicate
                            ? 'border-slate-300 text-slate-500 bg-slate-100/50'
                            : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 text-slate-900 dark:text-white'
                        }`}
                      />
                    </td>

                    {/* Name/Note Cell */}
                    <td className="px-4 py-1.5">
                      <input
                        type="text"
                        value={row.name || ''}
                        onChange={(e) => handleCellChange(row.id, 'name', e.target.value)}
                        placeholder="Client name / note"
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:border-emerald-500 outline-none"
                      />
                    </td>

                    {/* Validation Pill */}
                    <td className="px-3 py-1.5 text-center font-sans text-[10px]">
                      {row.valid ? (
                        row.duplicate ? (
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                            👥 Duplicate
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                            ✅ Valid
                          </span>
                        )
                      ) : row.phone.trim() === '' ? (
                        <span className="text-slate-300">Empty</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                          ⚠️ Invalid
                        </span>
                      )}
                    </td>

                    {/* Delete Row Button */}
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add row footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 font-bold rounded-lg text-xs transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>

          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {validRows.length} valid number(s) ready in grid
          </span>
        </div>
      </div>

      {/* Save & Rename Sheet into Folder Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Save className="w-4 h-4 text-blue-600" />
            <span>Save Sheet & Rename Custom List</span>
          </h4>

          <button
            onClick={() => setShowFolderCreate(!showFolderCreate)}
            className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>
        </div>

        {showFolderCreate && (
          <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
            <input
              type="text"
              placeholder="Folder Name (e.g. July_Campaigns)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-xs text-slate-900 dark:text-white"
            />
            <button
              onClick={handleCreateNewFolder}
              className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs"
            >
              Add
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Target Folder */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
              Folder
            </label>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {folders.map((f) => (
                <option key={f.name} value={f.name}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Sheet Name */}
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
              Sheet Name / Rename List
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="e.g. VIP_Customers_Batch_1"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
              />
              <button
                onClick={handleSaveToFolder}
                disabled={!validRows.length}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Sheet</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
