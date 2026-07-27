import React, { useState } from 'react';
import {
  Github,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Globe2,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';

export const DeploymentGuide: React.FC = () => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-emerald-500" />
          <span>Complete Vercel Deployment Workflow</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Follow these simple steps to go live on Vercel with automated continuous deployment.
        </p>

        {/* Workflow Tabs */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Method 1: Git Integration */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-black text-white dark:bg-slate-100 dark:text-black">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Option A: Vercel Git Import (Recommended)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automatic builds on every git push.
                </p>
              </div>
            </div>

            <ol className="space-y-3 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
              <li className="leading-relaxed">
                Push or sync your project repository to GitHub, GitLab, or Bitbucket.
              </li>
              <li className="leading-relaxed">
                Log into{' '}
                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-600 dark:text-emerald-400 underline inline-flex items-center gap-0.5"
                >
                  vercel.com/new <ExternalLink className="h-3 w-3" />
                </a>{' '}
                and click <strong>Import Project</strong>.
              </li>
              <li className="leading-relaxed">
                Vercel will auto-detect <strong>Vite</strong>. Leave Framework Preset as <strong>Vite</strong> and Build Command as <strong>npm run build</strong>.
              </li>
              <li className="leading-relaxed">
                In <strong>Environment Variables</strong>, add:
                <div className="mt-1.5 p-2 rounded bg-slate-900 text-slate-100 font-mono text-[11px] flex items-center justify-between">
                  <span>GEMINI_API_KEY = your_key_here</span>
                  <button
                    onClick={() => copyToClipboard('GEMINI_API_KEY', 'env1')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'env1' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
              <li className="leading-relaxed">
                Click <strong>Deploy</strong>. Vercel will build and assign your live production URL!
              </li>
            </ol>
          </div>

          {/* Method 2: Vercel CLI */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-600 text-white">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Option B: Vercel CLI Deployment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deploy straight from your terminal.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  1. Install Vercel CLI globally:
                </span>
                <div className="p-2.5 rounded bg-slate-900 text-emerald-300 font-mono text-xs flex items-center justify-between">
                  <span>npm i -g vercel</span>
                  <button
                    onClick={() => copyToClipboard('npm i -g vercel', 'cli1')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'cli1' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  2. Deploy preview build:
                </span>
                <div className="p-2.5 rounded bg-slate-900 text-emerald-300 font-mono text-xs flex items-center justify-between">
                  <span>vercel</span>
                  <button
                    onClick={() => copyToClipboard('vercel', 'cli2')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'cli2' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  3. Deploy directly to production:
                </span>
                <div className="p-2.5 rounded bg-slate-900 text-emerald-300 font-mono text-xs flex items-center justify-between">
                  <span>vercel --prod</span>
                  <button
                    onClick={() => copyToClipboard('vercel --prod', 'cli3')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'cli3' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          <span>Vercel Integration FAQ & Key Settings</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-purple-500" /> SPA Routing (404 Prevention)
            </span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Our <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">vercel.json</code> rewrites all routes to <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">/index.html</code> so React Router or deep links never return 404 on refresh.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-emerald-500" /> Serverless API Proxy
            </span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Functions in <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">/api/*.ts</code> run as Vercel Serverless Functions, keeping secrets like <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">GEMINI_API_KEY</code> completely secure.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Globe2 className="h-4 w-4 text-amber-500" /> Edge Network & SSL
            </span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Vercel automatically provisions free SSL certificates and serves compiled assets via global CDN edge nodes with long-term cache headers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
