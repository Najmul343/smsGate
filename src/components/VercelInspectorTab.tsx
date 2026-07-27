import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, ShieldAlert, Code2, Copy, Download, RefreshCw, FileCode } from 'lucide-react';

export const VercelInspectorTab: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<'vercel' | 'apiSend' | 'apiDelivery' | 'apiDevices'>('vercel');

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch {
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const configFiles = {
    vercel: {
      path: 'vercel.json',
      lang: 'json',
      content: JSON.stringify(
        {
          version: 2,
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
          framework: 'vite',
          rewrites: [
            { source: '/api/(.*)', destination: '/api/$1' },
            { source: '/(.*)', destination: '/index.html' },
          ],
        },
        null,
        2
      ),
    },
    apiSend: {
      path: 'api/sms/send.ts',
      lang: 'typescript',
      content: `// Vercel Serverless Function: Proxy SMS dispatch to SMS Gate 3rd-party API
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { account, password, message, phoneNumbers, withDeliveryReport } = req.body;
  const authHeader = 'Basic ' + Buffer.from(\`\${account}:\${password}\`).toString('base64');
  const response = await fetch('https://api.sms-gate.app/3rdparty/v1/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
    body: JSON.stringify({ message, phoneNumbers, withDeliveryReport: withDeliveryReport ?? true }),
  });
  const data = await response.json();
  res.status(response.status === 202 ? 200 : response.status).json({ success: response.status === 202, id: data.id, raw: data });
}`,
    },
    apiDelivery: {
      path: 'api/sms/delivery.ts',
      lang: 'typescript',
      content: `// Vercel Serverless Function: Check real phone delivery report from SMS Gate
export default async function handler(req, res) {
  const { messageId, account, password } = req.query;
  const authHeader = 'Basic ' + Buffer.from(\`\${account}:\${password}\`).toString('base64');
  const response = await fetch(\`https://api.sms-gate.app/3rdparty/v1/messages/\${messageId}\`, {
    headers: { 'Authorization': authHeader }
  });
  const data = await response.json();
  res.status(200).json({ success: true, state: data.state, recipients: data.recipients });
}`,
    },
    apiDevices: {
      path: 'api/sms/devices.ts',
      lang: 'typescript',
      content: `// Vercel Serverless Function: Check connected Android devices lastSeen time
export default async function handler(req, res) {
  const { account, password } = req.query;
  const authHeader = 'Basic ' + Buffer.from(\`\${account}:\${password}\`).toString('base64');
  const response = await fetch('https://api.sms-gate.app/3rdparty/v1/devices', {
    headers: { 'Authorization': authHeader }
  });
  const devices = await response.json();
  res.status(200).json({ success: true, devices });
}`,
    },
  };

  const currentFile = configFiles[selectedConfig];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Vercel Serverless API Diagnostics (<code className="text-xs font-mono">/api/health</code>)
            </h2>
          </div>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Check Health</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Status</span>
            <p className="font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {healthData ? '200 OK' : 'Pending'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Environment</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white uppercase">
              {healthData?.environment || 'Vercel Serverless'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Server Timestamp</span>
            <p className="font-mono font-bold text-slate-900 dark:text-white text-[11px] truncate">
              {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : '--'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Serverless Routes</span>
            <p className="font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vercel Ready
            </p>
          </div>
        </div>
      </div>

      {/* Code Inspector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
          <FileCode className="w-4 h-4 text-slate-500" />
          <span>Vercel Configuration & Serverless Functions Inspector</span>
        </h3>

        <div className="flex flex-wrap gap-2 text-xs font-mono font-semibold">
          {[
            { key: 'vercel', label: 'vercel.json' },
            { key: 'apiSend', label: 'api/sms/send.ts' },
            { key: 'apiDelivery', label: 'api/sms/delivery.ts' },
            { key: 'apiDevices', label: 'api/sms/devices.ts' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedConfig(item.key as any)}
              className={`px-3 py-1.5 rounded-lg border transition-all ${
                selectedConfig === item.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-slate-950 text-slate-100 border border-slate-800 overflow-hidden font-mono text-xs">
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-slate-300 font-bold">{currentFile.path}</span>
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="p-4 overflow-x-auto text-slate-300 leading-relaxed">
            <code>{currentFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
