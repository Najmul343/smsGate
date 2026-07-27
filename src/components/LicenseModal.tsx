import React, { useState } from 'react';
import { HARDCODED_KEYS, saveLicense } from '../utils/license';
import { ShieldAlert, Lock, Key, CheckCircle, RefreshCw } from 'lucide-react';

interface LicenseModalProps {
  isValid: boolean | null;
  activeKey: string;
  onActivated: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isValid, activeKey, onActivated }) => {
  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleActivate = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = inputKey.trim().toUpperCase();

    if (HARDCODED_KEYS[trimmed]) {
      const days = HARDCODED_KEYS[trimmed];
      saveLicense(trimmed, days);
      setSuccessMsg(`License Activated Successfully for ${days} Days!`);
      setTimeout(() => {
        onActivated();
      }, 1000);
    } else {
      setErrorMsg('❌ Invalid License Key. Contact administrator on WhatsApp to purchase or renew.');
    }
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

          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 text-left space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600" /> License Expired Notice
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Contact your software administrator on WhatsApp to request a fresh activation key.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Enter New License Key
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

            {errorMsg && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errorMsg}</p>}
            {successMsg && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {successMsg}</p>}

            <button
              onClick={handleActivate}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-md"
            >
              Activate New Key
            </button>
          </div>

          <div className="text-[11px] text-slate-400">
            Available trial keys for testing: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">PRO-AAAA-BBBB</code>, <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">TRIAL-1234-ABCD</code>
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
            🔒 Software Locked
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            SMS Pro Multi-Router System Security Verification
          </p>
        </div>

        <div className="space-y-3 text-left">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Enter License Key
          </label>
          <div className="relative">
            <Key className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter license key to unlock..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none"
            />
          </div>

          {errorMsg && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errorMsg}</p>}
          {successMsg && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {successMsg}</p>}

          <button
            onClick={handleActivate}
            className="w-full py-3 bg-black dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:bg-zinc-800 dark:hover:bg-slate-100 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>🔓 Unlock Software</span>
          </button>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 text-left space-y-1 border border-slate-200 dark:border-slate-800">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Demo License Keys:</p>
          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
            <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">TRIAL-1234-ABCD</span>
            <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">PRO-AAAA-BBBB</span>
            <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-900 dark:text-white">PRO-YOUR-NAME</span>
          </div>
        </div>
      </div>
    </div>
  );
};
