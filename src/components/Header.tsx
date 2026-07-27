import React from 'react';
import { Smartphone, LayoutDashboard, Send, Users, Database, Server, CheckCircle2, ExternalLink } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeAccountsCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, activeAccountsCount }) => {
  return (
    <>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 fill-black dark:fill-white shrink-0" viewBox="0 0 76 65">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"></path>
            </svg>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                SMS PRO
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3" /> Vercel Ready
              </span>
            </div>
          </div>

          {/* Desktop/Tablet Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-6 text-xs sm:text-sm font-medium text-slate-500 overflow-x-auto py-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('send')}
              className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 whitespace-nowrap ${
                activeTab === 'send'
                  ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="h-4 w-4" />
              <span>Send Numbers</span>
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Accounts ({activeAccountsCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('master_log')}
              className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 whitespace-nowrap ${
                activeTab === 'master_log'
                  ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Database className="h-4 w-4" />
              <span>Master Log</span>
            </button>

            <button
              onClick={() => setActiveTab('vercel')}
              className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 whitespace-nowrap ${
                activeTab === 'vercel'
                  ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Server className="h-4 w-4" />
              <span>Vercel Config</span>
            </button>
          </nav>

          {/* Deploy Quick Button */}
          <div className="flex items-center gap-2">
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black text-white hover:bg-zinc-800 transition-colors shadow-sm"
            >
              <span>Deploy Vercel</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Sleek Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around items-center py-2 px-1 shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('send')}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all ${
            activeTab === 'send'
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Send className="h-5 w-5" />
          <span className="text-[10px]">Send</span>
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all relative ${
            activeTab === 'accounts'
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px]">Accounts ({activeAccountsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('master_log')}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all ${
            activeTab === 'master_log'
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Database className="h-5 w-5" />
          <span className="text-[10px]">Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('vercel')}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all ${
            activeTab === 'vercel'
              ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-105'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Server className="h-5 w-5" />
          <span className="text-[10px]">Vercel</span>
        </button>
      </nav>
    </>
  );
};
