import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  Info,
  Terminal,
  Layers
} from 'lucide-react';
import { CONFIG_FILES } from '../data/vercelConfigData';

export const ConfigInspector: React.FC = () => {
  const [selectedFileName, setSelectedFileName] = useState<string>('vercel.json');
  const [copied, setCopied] = useState<boolean>(false);

  const selectedFile = CONFIG_FILES.find((f) => f.name === selectedFileName) || CONFIG_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([selectedFile.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = selectedFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            <span>Vercel Configuration File Inspector</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review and copy optimized deployment files for your Vercel project.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Selector Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block px-1">
            Configuration Manifests ({CONFIG_FILES.length})
          </label>
          <div className="space-y-2">
            {CONFIG_FILES.map((file) => (
              <button
                key={file.name}
                id={`file-btn-${file.name}`}
                onClick={() => setSelectedFileName(file.name)}
                className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                  selectedFileName === file.name
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-900 dark:border-white shadow-sm ring-1 ring-slate-900 dark:ring-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold">{file.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      selectedFileName === file.name
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {file.path}
                  </span>
                </div>
                <p
                  className={`text-xs mt-1.5 line-clamp-2 ${
                    selectedFileName === file.name
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {file.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Code Previewer */}
        <div className="lg:col-span-8 flex flex-col rounded-xl bg-slate-950 text-slate-100 border border-slate-800 shadow-lg overflow-hidden">
          {/* Header Bar */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              </div>
              <span className="font-mono text-xs text-slate-300 font-semibold ml-2">
                {selectedFile.path}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="copy-file-btn"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                id="download-file-btn"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save File</span>
              </button>
            </div>
          </div>

          {/* Description banner */}
          <div className="p-3 bg-slate-900/40 border-b border-slate-800/80 px-4 flex items-center gap-2 text-xs text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-blue-400" />
            <span>{selectedFile.description}</span>
          </div>

          {/* Code Body */}
          <div className="p-4 font-mono text-xs text-emerald-300/90 bg-slate-950 overflow-x-auto min-h-[320px] max-h-[480px]">
            <pre className="leading-relaxed">{selectedFile.content}</pre>
          </div>

          {/* Footer Info */}
          <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <Terminal className="h-3.5 w-3.5 text-slate-500" /> Language: {selectedFile.language}
            </span>
            <span className="font-mono">Vercel Build Ready • UTF-8</span>
          </div>
        </div>
      </div>
    </div>
  );
};
