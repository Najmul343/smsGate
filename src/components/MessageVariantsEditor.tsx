import React, { useState } from 'react';
import { Sparkles, Shuffle, CheckCircle2, MessageSquare } from 'lucide-react';

interface MessageVariantsEditorProps {
  variants: string[];
  onChangeVariants: (variants: string[]) => void;
  className?: string;
}

export const MessageVariantsEditor: React.FC<MessageVariantsEditorProps> = ({
  variants,
  onChangeVariants,
  className = '',
}) => {
  // Ensure we always have an array of 4 items
  const currentVariants = [
    variants[0] || '',
    variants[1] || '',
    variants[2] || '',
    variants[3] || '',
  ];

  const [activeTab, setActiveTab] = useState<number>(0);
  const [testResult, setTestResult] = useState<{ index: number; text: string } | null>(null);

  const activeCount = currentVariants.filter((v) => v.trim().length > 0).length;

  const handleTextChange = (index: number, val: string) => {
    const updated = [...currentVariants];
    updated[index] = val;
    onChangeVariants(updated);
  };

  const handleTestRandom = () => {
    const activeIndices = currentVariants
      .map((v, i) => (v.trim().length > 0 ? i : -1))
      .filter((i) => i !== -1);

    if (activeIndices.length === 0) {
      setTestResult({ index: 0, text: 'No active variants. Please type a message.' });
      return;
    }

    const randomIdx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
    setTestResult({
      index: randomIdx,
      text: currentVariants[randomIdx],
    });
    setActiveTab(randomIdx);
  };

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>SMS Message Text (4 Human Variants)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-300 dark:border-emerald-800">
                {activeCount}/4 Active
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rotates automatically between non-empty variants so each recipient gets a unique message.
            </p>
          </div>
        </div>

        <button
          onClick={handleTestRandom}
          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
          title="Click to test random message picker"
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>🎲 Test Pick Variant</span>
        </button>
      </div>

      {/* Tabs for Variant 1, 2, 3, 4 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
        {[0, 1, 2, 3].map((idx) => {
          const hasContent = currentVariants[idx].trim().length > 0;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === idx
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Variant {idx + 1}</span>
              {hasContent ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Textarea for currently active tab */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>
            {activeTab === 0
              ? 'Variant 1 (Primary Default Message)'
              : `Variant ${activeTab + 1} (Alternative Human Wording)`}
          </span>
          <span>{currentVariants[activeTab].length} characters</span>
        </div>

        <textarea
          value={currentVariants[activeTab]}
          onChange={(e) => handleTextChange(activeTab, e.target.value)}
          rows={3}
          placeholder={
            activeTab === 0
              ? 'Enter primary SMS message...'
              : `Enter human variant ${activeTab + 1} (e.g. rephrased wording)...`
          }
          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500/50 font-sans"
        />
      </div>

      {/* Test Picker Result Alert */}
      {testResult && (
        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-indigo-900 dark:text-indigo-200 text-xs font-semibold flex items-start gap-2 animate-in fade-in duration-150">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-extrabold text-[11px] uppercase text-indigo-700 dark:text-indigo-300">
              Picked Variant {testResult.index + 1}:
            </div>
            <p className="italic text-slate-800 dark:text-slate-200 font-mono text-[11px]">
              "{testResult.text}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
