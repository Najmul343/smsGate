import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { VercelChecker } from './components/VercelChecker';
import { ConfigInspector } from './components/ConfigInspector';
import { DeploymentGuide } from './components/DeploymentGuide';
import { AiStudioPlayground } from './components/AiStudioPlayground';
import { ApiStatusCard } from './components/ApiStatusCard';
import { Rocket, ShieldCheck, Heart } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'deploy' | 'ai'>('overview');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Sticky Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="tab-overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <VercelChecker onNavigateTab={(tab) => setActiveTab(tab)} />
              <ApiStatusCard />
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div
              key="tab-config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ConfigInspector />
            </motion.div>
          )}

          {activeTab === 'deploy' && (
            <motion.div
              key="tab-deploy"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DeploymentGuide />
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div
              key="tab-ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AiStudioPlayground />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 fill-black dark:fill-white" viewBox="0 0 76 65">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"></path>
            </svg>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Vercel Deployment Ready
            </span>
            <span>•</span>
            <span>Vite 6 • React 19 • Serverless /api</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://vercel.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Vercel Docs
            </a>
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Deploy Now
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
