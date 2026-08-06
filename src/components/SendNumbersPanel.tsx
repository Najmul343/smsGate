import React, { useState, useEffect } from 'react';
import { SmsAccount, SavedFolder, SmsRecord } from '../types/sms';
import { parseExcelFile } from '../utils/excelParser';
import { loadSavedFolders, saveSavedFolders, loadRecords, insertNumbers, getMessageVariants, setMessageVariants } from '../utils/dbStore';
import { LiveExcelGrid } from './LiveExcelGrid';
import { MessageVariantsEditor } from './MessageVariantsEditor';
import { FileSpreadsheet, FolderPlus, Send, RefreshCw, Trash2, Folder, CheckCircle2, AlertCircle, Sparkles, Clipboard, Edit3, Plus } from 'lucide-react';

interface SendNumbersPanelProps {
  accounts: SmsAccount[];
  lastMessage: string;
  messageVariants?: string[];
  onSaveLastMessage: (msg: string) => void;
  onSaveMessageVariants?: (variants: string[]) => void;
  onSplitAndStart: (numbers: (string | { phone: string; name?: string })[], message: string, targetAccountUsers: string[], forceRetarget?: boolean) => { account: string; newCount: number; movedCount: number }[];
  onRetargetList: (numbers: string[], targetAccountUsers: string[]) => void;
  onRecordsUpdated?: (updated: SmsRecord[]) => void;
  onSendAllRemaining?: () => void;
}

export const SendNumbersPanel: React.FC<SendNumbersPanelProps> = ({
  accounts,
  lastMessage,
  messageVariants: propVariants,
  onSaveLastMessage,
  onSaveMessageVariants,
  onSplitAndStart,
  onRetargetList,
  onRecordsUpdated,
  onSendAllRemaining,
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'live_grid' | 'library'>('live_grid');

  // Live Grid Edit State (for loading saved files into live editor)
  const [gridInitialNumbers, setGridInitialNumbers] = useState<string[]>([]);
  const [gridInitialSheetName, setGridInitialSheetName] = useState<string>('');
  const [gridInitialFolderName, setGridInitialFolderName] = useState<string>('');

  // Message Variants State
  const [messageVariantsState, setMessageVariantsState] = useState<string[]>(
    () => propVariants || getMessageVariants()
  );

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

  // Quick Upload State
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(accounts.map((a) => a.user));
  const [parsedQuickNumbers, setParsedQuickNumbers] = useState<string[]>([]);
  const [quickFileInfo, setQuickFileInfo] = useState<{ name: string; total: number; invalid: number; duplicate: number } | null>(null);
  const [quickSummary, setQuickSummary] = useState<{ account: string; newCount: number; movedCount: number }[] | null>(null);

  // Saved Library State
  const [folders, setFolders] = useState<SavedFolder[]>(loadSavedFolders());
  const [selectedFolder, setSelectedFolder] = useState<string>(folders[0]?.name || '');
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [libSelectedAccounts, setLibSelectedAccounts] = useState<string[]>(accounts.map((a) => a.user));
  const [libActionMessage, setLibActionMessage] = useState<string>('');

  const activeAccountUsers = accounts.filter((a) => a.enabled).map((a) => a.user);

  // Handlers
  const handleQuickFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      setParsedQuickNumbers(parsed.numbers);
      setQuickFileInfo({
        name: file.name,
        total: parsed.totalRaw,
        invalid: parsed.invalidCount,
        duplicate: parsed.duplicateCount,
      });
      setQuickSummary(null);
    } catch (err) {
      alert('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
    }
  };

  const handleQuickSend = () => {
    if (!parsedQuickNumbers.length) {
      alert('Please upload an Excel file containing numbers first.');
      return;
    }
    if (!selectedAccounts.length) {
      alert('Please select at least one target account.');
      return;
    }
    const activeMessage = messageVariantsState.find((v) => v.trim().length > 0) || lastMessage;
    onSaveLastMessage(activeMessage);
    const summary = onSplitAndStart(parsedQuickNumbers, activeMessage, selectedAccounts);
    setQuickSummary(summary);
  };

  // Folder Operations
  const handleCreateFolder = () => {
    const cleanName = newFolderName.trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!cleanName) return;
    if (folders.some((f) => f.name === cleanName)) {
      alert('Folder name already exists!');
      return;
    }
    const updated = [...folders, { name: cleanName, files: [] }];
    setFolders(updated);
    saveSavedFolders(updated);
    setSelectedFolder(cleanName);
    setNewFolderName('');
  };

  const handleRenameFolder = () => {
    if (!renameTarget || !renameTo.trim()) return;
    const cleanTo = renameTo.trim().replace(/[\\/:*?"<>|]/g, '_');
    const updated = folders.map((f) => (f.name === renameTarget ? { ...f, name: cleanTo } : f));
    setFolders(updated);
    saveSavedFolders(updated);
    setSelectedFolder(cleanTo);
    setRenameTo('');
  };

  const handleDeleteFolder = (folderName: string) => {
    const updated = folders.filter((f) => f.name !== folderName);
    setFolders(updated);
    saveSavedFolders(updated);
    if (selectedFolder === folderName) {
      setSelectedFolder(updated[0]?.name || '');
    }
  };

  const handleSaveFileToFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFolder) return;

    try {
      const parsed = await parseExcelFile(file);
      const updated = folders.map((f) => {
        if (f.name === selectedFolder) {
          const filteredFiles = f.files.filter((x) => x.filename !== file.name);
          return {
            ...f,
            files: [
              ...filteredFiles,
              {
                filename: file.name,
                numbers: parsed.numbers,
                savedAt: new Date().toISOString().split('T')[0],
              },
            ],
          };
        }
        return f;
      });
      setFolders(updated);
      saveSavedFolders(updated);
      setSelectedFile(file.name);
      setLibActionMessage(`File '${file.name}' saved to folder '${selectedFolder}'!`);
    } catch {
      alert('Error saving Excel file to folder.');
    }
  };

  const currentFolderObj = folders.find((f) => f.name === selectedFolder);
  const currentFileObj = currentFolderObj?.files.find((f) => f.filename === selectedFile);

  const handleQuickQueue = () => {
    if (!parsedQuickNumbers.length) return;
    const activeMessage = messageVariantsState.find((v) => v.trim().length > 0) || lastMessage;
    const currentRecords = loadRecords();
    const assignedRoute = selectedAccounts[0] || '';
    const res = insertNumbers(currentRecords, parsedQuickNumbers, assignedRoute, activeMessage);
    if (onRecordsUpdated) {
      onRecordsUpdated(res.updatedRecords);
    }
    setQuickSummary([{ account: assignedRoute || 'Database', newCount: res.newCount, movedCount: res.requeuedCount }]);
  };

  const handleLibQueue = () => {
    if (!currentFileObj || !currentFileObj.numbers.length) return;
    const activeMessage = messageVariantsState.find((v) => v.trim().length > 0) || lastMessage;
    const currentRecords = loadRecords();
    const assignedRoute = libSelectedAccounts[0] || '';
    const res = insertNumbers(currentRecords, currentFileObj.numbers, assignedRoute, activeMessage);
    if (onRecordsUpdated) {
      onRecordsUpdated(res.updatedRecords);
    }
    setLibActionMessage(`✅ Queued ${res.newCount} new and ${res.requeuedCount} re-queued numbers from '${currentFileObj.filename}' into 'Yet to Send' database!`);
  };

  const handleLibSend = () => {
    if (!currentFileObj || !currentFileObj.numbers.length) {
      alert('Selected file has no numbers.');
      return;
    }
    const activeMessage = messageVariantsState.find((v) => v.trim().length > 0) || lastMessage;
    const summary = onSplitAndStart(currentFileObj.numbers, activeMessage, libSelectedAccounts);
    setLibActionMessage(`✅ Dispatched '${currentFileObj.filename}' across ${libSelectedAccounts.length} account(s)!`);
  };

  const handleLibRetarget = () => {
    if (!currentFileObj || !currentFileObj.numbers.length) return;
    onRetargetList(currentFileObj.numbers, libSelectedAccounts);
    setLibActionMessage(`✅ Retargeted ${currentFileObj.numbers.length} numbers from '${currentFileObj.filename}'. Click Send to trigger.`);
  };

  const handleDeleteFile = () => {
    if (!currentFolderObj || !selectedFile) return;
    const updated = folders.map((f) => {
      if (f.name === selectedFolder) {
        return {
          ...f,
          files: f.files.filter((x) => x.filename !== selectedFile),
        };
      }
      return f;
    });
    setFolders(updated);
    saveSavedFolders(updated);
    setSelectedFile('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-slate-900 dark:text-white" />
            <span>📨 Send Numbers</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sends will be split across {activeAccountUsers.length} active account(s): {activeAccountUsers.join(', ')}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('live_grid')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'live_grid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📋 Live Excel Grid
          </button>
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'quick'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ⚡ File Upload
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'library'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            🗂️ Saved Library
          </button>
        </div>
      </div>

      {activeTab === 'live_grid' && (
        <LiveExcelGrid
          accounts={accounts}
          lastMessage={lastMessage}
          messageVariants={messageVariantsState}
          onSaveLastMessage={onSaveLastMessage}
          onSaveMessageVariants={handleUpdateVariants}
          onSplitAndStart={onSplitAndStart}
          initialNumbers={gridInitialNumbers}
          initialSheetName={gridInitialSheetName}
          initialFolderName={gridInitialFolderName}
          onSaveComplete={() => setFolders(loadSavedFolders())}
          onRecordsUpdated={onRecordsUpdated}
          onSendAllRemaining={onSendAllRemaining}
        />
      )}

      {activeTab === 'quick' && (
        <div className="space-y-5">
          {/* File Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleQuickFileChange}
              id="quick-excel-input"
              className="hidden"
            />
            <label htmlFor="quick-excel-input" className="cursor-pointer block space-y-2">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Click to upload Excel master file (.xlsx, .xls)
              </div>
              <p className="text-[11px] text-slate-400">One list containing all recipient phone numbers</p>
            </label>

            {quickFileInfo && (
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold px-3 py-1 rounded-full text-xs border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  {quickFileInfo.name}: {parsedQuickNumbers.length} valid numbers ready
                  {quickFileInfo.invalid > 0 && ` · ${quickFileInfo.invalid} invalid skipped`}
                  {quickFileInfo.duplicate > 0 && ` · ${quickFileInfo.duplicate} duplicates removed`}
                </span>
              </div>
            )}
          </div>

          {/* Message Variants Editor */}
          <MessageVariantsEditor
            variants={messageVariantsState}
            onChangeVariants={handleUpdateVariants}
          />

          {/* Account selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Send from which account(s)?
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

          {/* Trigger Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleQuickQueue}
              disabled={!parsedQuickNumbers.length}
              className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>📥 Add {parsedQuickNumbers.length} Numbers to Queue</span>
            </button>

            <button
              onClick={handleQuickSend}
              disabled={!parsedQuickNumbers.length || !selectedAccounts.length}
              className="py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>🚀 Split & Start Chosen APIs</span>
            </button>
          </div>

          {/* Execution Summary Table */}
          {quickSummary && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sending started across {quickSummary.length} account(s)!
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">New Numbers Assigned</th>
                      <th className="px-3 py-2">Rebalanced from Elsewhere</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-200 dark:divide-emerald-800 font-mono text-emerald-950 dark:text-emerald-100">
                    {quickSummary.map((s) => (
                      <tr key={s.account}>
                        <td className="px-3 py-2 font-bold">{s.account}</td>
                        <td className="px-3 py-2">{s.newCount}</td>
                        <td className="px-3 py-2">{s.movedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'library' && (
        <div className="space-y-5">
          {/* Folder Management Expander */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-blue-500" /> Manage Folder Library
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="New folder name (e.g. Mumbai_Batch1)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="sm:col-span-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
              <button
                onClick={handleCreateFolder}
                className="px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg text-xs hover:bg-zinc-800 transition-colors"
              >
                ➕ Create
              </button>
            </div>

            {folders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <select
                  value={renameTarget}
                  onChange={(e) => setRenameTarget(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Select Folder to Rename/Delete</option>
                  {folders.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="New name"
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />

                <div className="flex gap-1">
                  <button
                    onClick={handleRenameFolder}
                    className="flex-1 px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg text-xs"
                  >
                    ✏️ Rename
                  </button>
                  {renameTarget && (
                    <button
                      onClick={() => handleDeleteFolder(renameTarget)}
                      className="px-2 py-1.5 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 font-semibold rounded-lg text-xs"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Folder & File selector */}
          {folders.length === 0 ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs rounded-xl">
              No saved folders yet — create one above to organize lists.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Folder</label>
                <select
                  value={selectedFolder}
                  onChange={(e) => {
                    setSelectedFolder(e.target.value);
                    setSelectedFile('');
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium"
                >
                  {folders.map((f) => (
                    <option key={f.name} value={f.name}>
                      📁 {f.name} ({f.files.length} files)
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload to folder */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                  Save new Excel file into folder '{selectedFolder}':
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleSaveFileToFolder}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 dark:file:bg-white dark:file:text-slate-900 cursor-pointer"
                />
              </div>

              {/* Saved File Selection */}
              {currentFolderObj && currentFolderObj.files.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Select Saved File
                    </label>
                    <select
                      value={selectedFile}
                      onChange={(e) => setSelectedFile(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium"
                    >
                      <option value="">-- Choose file --</option>
                      {currentFolderObj.files.map((file) => (
                        <option key={file.filename} value={file.filename}>
                          📄 {file.filename} ({file.numbers.length} numbers)
                        </option>
                      ))}
                    </select>
                  </div>

                  <MessageVariantsEditor
                    variants={messageVariantsState}
                    onChangeVariants={handleUpdateVariants}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <button
                      onClick={handleLibQueue}
                      disabled={!selectedFile}
                      className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      title="Add numbers from this file directly into 'Yet to Send' database"
                    >
                      <Plus className="w-3.5 h-3.5" /> 📥 Queue
                    </button>
                    <button
                      onClick={handleLibSend}
                      disabled={!selectedFile}
                      className="py-2.5 px-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> 🚀 Send
                    </button>
                    <button
                      onClick={() => {
                        if (!currentFileObj) return;
                        setGridInitialNumbers(currentFileObj.numbers);
                        setGridInitialSheetName(currentFileObj.filename);
                        setGridInitialFolderName(selectedFolder);
                        setActiveTab('live_grid');
                      }}
                      disabled={!selectedFile}
                      className="py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> ✏️ Edit
                    </button>
                    <button
                      onClick={handleLibRetarget}
                      disabled={!selectedFile}
                      className="py-2.5 px-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> 🔁 Retarget
                    </button>
                    <button
                      onClick={handleDeleteFile}
                      disabled={!selectedFile}
                      className="py-2.5 px-2 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs hover:bg-red-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 🗑️ Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {libActionMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{libActionMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
