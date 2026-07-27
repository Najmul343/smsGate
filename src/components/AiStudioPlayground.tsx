import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Server
} from 'lucide-react';
import { PROMPT_TEMPLATES } from '../data/vercelConfigData';

export const AiStudioPlayground: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerate = async (customPrompt?: string) => {
    const textToSubmit = customPrompt || prompt;
    if (!textToSubmit.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSubmit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.docs || 'Failed to generate response');
      }

      setResponse(data.text);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while connecting to /api/generate');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span>Vercel Serverless AI API Tester</span>
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              /api/generate
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Test backend serverless API endpoints powered by Gemini AI. Works both in AI Studio dev environment and on Vercel deployment!
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shrink-0">
          <Server className="h-4 w-4" />
          <span>Server-Side Secure Endpoint</span>
        </div>
      </div>

      {/* Preset Prompts Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-1">
          Preset Vercel Prompts
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PROMPT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              id={`preset-prompt-${tmpl.id}`}
              onClick={() => {
                setPrompt(tmpl.prompt);
                handleGenerate(tmpl.prompt);
              }}
              className="text-left p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white mb-1">
                <span>{tmpl.title}</span>
                <Zap className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                {tmpl.prompt}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Input Form & Response View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Enter Prompt / Question</span>
              <span className="text-[11px] font-normal text-slate-400">Model: gemini-2.5-flash</span>
            </label>

            <textarea
              id="ai-prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. How do I optimize Vite bundle size when building for Vercel?"
              rows={6}
              className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-sans"
            />
          </div>

          <button
            id="send-ai-prompt-btn"
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="w-full py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                <span>Calling /api/generate...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Execute via Vercel Serverless Route</span>
              </>
            )}
          </button>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col min-h-[360px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-500" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">
                Serverless AI Output
              </span>
            </div>

            {response && (
              <button
                id="copy-response-btn"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 p-4 mt-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 overflow-y-auto max-h-[380px]">
            {loading && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-xs animate-pulse">Requesting response from Vercel serverless API function...</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Environment Secret Notice</span>
                </div>
                <p className="leading-relaxed">{error}</p>
                <div className="mt-2 p-2 bg-amber-100/50 dark:bg-amber-900/40 rounded text-[11px] font-mono">
                  Tip: Add GEMINI_API_KEY in your Vercel Project Settings &gt; Environment Variables.
                </div>
              </div>
            )}

            {!loading && !error && response && (
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {response}
              </div>
            )}

            {!loading && !error && !response && (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
                <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="text-xs">Select a preset above or type a prompt to test your serverless Vercel function.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
