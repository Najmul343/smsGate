import React, { useState } from 'react';
import { HARDCODED_KEYS, saveLicense, extendActiveLicense } from '../utils/license';
import { ShieldAlert, Lock, Key, CheckCircle, Zap } from 'lucide-react';

interface LicenseModalProps {
  isValid: boolean | null;
  activeKey: string;
  onActivated: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isValid, activeKey, onActivated }) => {
  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleActivateKey = (keyToActivate: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = keyToActivate.trim().toUpperCase();

    if (!trimmed) {
      setErrorMsg('Please enter a valid License Key.');
      return;
    }

    const days = HARDCODED_KEYS[trimmed] || 365;
    saveLicense(trimmed, days);
    setSuccessMsg(`License Activated: Key '${trimmed}' unlocked for ${days} days!`);
    setTimeout(() => {
      onActivated();
    }, 600);
  };

  const handleExtendCurrent = () => {
    setErrorMsg('');
    setSuccessMsg('');
    extendActiveLicense(365);
    setSuccessMsg(`⚡ License Extended! Added +365 Days to key '${activeKey || 'PRO-KEY'}'.`);
    setTimeout(() => {
      onActivated();
    }, 600);
  };

  if (isValid === false) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-red-600 dark:text-red-500 tracking-tight">
              🚫 SUBSCRIPTION EXPIRED
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              License Key <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-red-600 font-mono font-bold text-xs">{activeKey}</code> has run out of days.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <button
              onClick={handleExtendCurrent}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Extend Active Key (+365 Days)</span>
            </button>

            <div className="relative pt-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Or Enter New License Key
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="PRO-XXXX-YYYY"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none"
                />
              </div>
            </div>

            {errorMsg && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errorMsg}</p>}
            {successMsg && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {successMsg}</p>}

            <button
              onClick={() => handleActivateKey(inputKey)}
              className="w-full py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
            >
              Activate Key
            </button>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 text-left space-y-1.5 border border-slate-200 dark:border-slate-800">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Click to activate 365-Day PRO Keys:</p>
            <div className="flex flex-wrap gap-1 font-mono text-[10px]">
              {['NAJMUL-WORK-2026', 'PRO-NAJAM-1111', 'PRO-AAAA-BBBB'].map((k) => (
                <button
                  key={k}
                  onClick={() => handleActivateKey(k)}
                  className="bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  ⚡ {k} (365d)
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-900 dark:text-white">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            🔑 License Key Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active Key: <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{activeKey || 'PRO-KEY'}</code>
          </p>
        </div>

        <div className="space-y-3 text-left">
          <button
            onClick={handleExtendCurrent}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>⚡ Extend Active Key (+365 Days)</span>
          </button>

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Or Switch to New License Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter license key (e.g. PRO-AAAA-BBBB)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none"
              />
            </div>
          </div>

          {errorMsg && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errorMsg}</p>}
          {successMsg && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {successMsg}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => handleActivateKey(inputKey)}
              className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:bg-zinc-800 dark:hover:bg-slate-100 transition-all shadow-md cursor-pointer"
            >
              Unlock / Switch Key
            </button>
            <button
              onClick={onActivated}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 text-left space-y-1.5 border border-slate-200 dark:border-slate-800">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Click to instant-switch to 365-Day Key:</p>
          <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
            {['NAJMUL-WORK-2026', 'PRO-NAJAM-1111', 'PRO-AAAA-BBBB'].map((k) => (
              <button
                key={k}
                onClick={() => handleActivateKey(k)}
                className="bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
              >
                ⚡ {k} (365d)
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
