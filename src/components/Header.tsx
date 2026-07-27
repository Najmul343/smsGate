import React from 'react';
import {
  CheckCircle,
  ExternalLink,
  Code2,
  Sparkles,
  Zap,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'overview' | 'config' | 'deploy' | 'ai';
  setActiveTab: (tab: 'overview' | 'config' | 'deploy' | 'ai') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8">
      <div className="flex items-center gap-6 sm:gap-8">
        {/* Vercel Style Brand */}
        <div className="flex items-center gap-2.5">
          <svg className="w-6 h-6 fill-black dark:fill-white" viewBox="0 0 76 65">
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"></path>
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              VERCEL
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle className="h-3 w-3" /> Ready
            </span>
          </div>
        </div>

        {/* Navigation Tabs with Professional Polish underline */}
        <nav className="flex items-center gap-1 sm:gap-6 text-xs sm:text-sm font-medium text-slate-500">
          <button
            id="tab-overview-btn"
            onClick={() => setActiveTab('overview')}
            className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 ${
              activeTab === 'overview'
                ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>Readiness</span>
          </button>

          <button
            id="tab-config-btn"
            onClick={() => setActiveTab('config')}
            className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 ${
              activeTab === 'config'
                ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Code2 className="h-4 w-4" />
            <span>Config Inspector</span>
          </button>

          <button
            id="tab-deploy-btn"
            onClick={() => setActiveTab('deploy')}
            className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 ${
              activeTab === 'deploy'
                ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Deploy Guide</span>
          </button>

          <button
            id="tab-ai-btn"
            onClick={() => setActiveTab('ai')}
            className={`h-16 flex items-center gap-1.5 transition-all border-b-2 px-1 ${
              activeTab === 'ai'
                ? 'text-slate-900 dark:text-white border-slate-900 dark:border-white font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>AI Playground</span>
          </button>
        </nav>
      </div>

      {/* Quick Action Link */}
      <div className="flex items-center gap-3">
        <a
          href="https://vercel.com/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-black text-white hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <span>Deploy to Vercel</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </header>
  );
};

