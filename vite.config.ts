import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import express from 'express';
import { GoogleGenAI } from '@google/genai';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(express.json());

      // Health
      server.middlewares.use('/api/health', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            status: 'ok',
            environment: 'local-vite-dev',
            timestamp: new Date().toISOString(),
            hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
          })
        );
      });

      // SMS Send Proxy
      server.middlewares.use('/api/sms/send', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          let body = req.body;
          if (!body || typeof body !== 'object') {
            const buffers: any[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            body = data ? JSON.parse(data) : {};
          }

          const { account, password, message, phoneNumbers, withDeliveryReport } = body;
          if (!account || !password) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing account credentials' }));
            return;
          }

          const authHeader = 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64');
          const response = await fetch('https://api.sms-gate.app/3rdparty/v1/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({
              message,
              phoneNumbers,
              withDeliveryReport: withDeliveryReport ?? true,
            }),
          });

          const data = await response.json().catch(() => ({}));
          res.setHeader('Content-Type', 'application/json');
          if (response.status === 202) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, id: data.id || null, status: response.status }));
          } else {
            res.statusCode = response.status;
            res.end(JSON.stringify({ success: false, status: response.status, error: data.message || data.error || `HTTP ${response.status}` }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });

      // SMS Delivery Status Proxy
      server.middlewares.use('/api/sms/delivery', async (req: any, res: any) => {
        try {
          const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
          const messageId = urlParams.get('messageId');
          const account = urlParams.get('account');
          const password = urlParams.get('password');

          if (!messageId || !account || !password) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing parameters' }));
            return;
          }

          const authHeader = 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64');
          const response = await fetch(`https://api.sms-gate.app/3rdparty/v1/messages/${messageId}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
          });

          res.setHeader('Content-Type', 'application/json');
          if (!response.ok) {
            res.statusCode = response.status;
            res.end(JSON.stringify({ error: `HTTP ${response.status}` }));
            return;
          }

          const data = await response.json();
          let state = (data.state || '').toUpperCase();
          let reason = '';
          if (Array.isArray(data.recipients) && data.recipients.length > 0) {
            const r0 = data.recipients[0];
            state = (r0.state || state).toUpperCase();
            reason = r0.error || '';
          }

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, state, reason, raw: data }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });

      // SMS Devices Check Proxy
      server.middlewares.use('/api/sms/devices', async (req: any, res: any) => {
        try {
          const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
          const account = urlParams.get('account');
          const password = urlParams.get('password');

          if (!account || !password) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing account' }));
            return;
          }

          const authHeader = 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64');
          const response = await fetch('https://api.sms-gate.app/3rdparty/v1/devices', {
            method: 'GET',
            headers: { 'Authorization': authHeader },
          });

          res.setHeader('Content-Type', 'application/json');
          if (!response.ok) {
            res.statusCode = 200;
            res.end(JSON.stringify({ online: null, error: `API_${response.status}`, devices: [] }));
            return;
          }

          const devices = await response.json();
          const parsed: any[] = [];
          let onlineAny = false;

          for (const d of devices || []) {
            const lastSeenRaw = d.lastSeen;
            let minutesAgo: number | null = null;
            let isOnline = false;

            if (lastSeenRaw) {
              try {
                const diffMs = Date.now() - new Date(lastSeenRaw).getTime();
                minutesAgo = Math.floor(diffMs / (1000 * 60));
                isOnline = minutesAgo <= 20;
              } catch {}
            }

            if (isOnline) onlineAny = true;
            parsed.push({
              name: d.name || 'Device',
              lastSeen: lastSeenRaw,
              minutesAgo,
              online: isOnline,
            });
          }

          res.statusCode = 200;
          res.end(JSON.stringify({
            online: (devices && devices.length > 0) ? onlineAny : null,
            error: null,
            devices: parsed,
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });

      // Gemini AI Generate Proxy
      server.middlewares.use('/api/generate', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'GEMINI_API_KEY environment variable is not set.',
            })
          );
          return;
        }

        try {
          let body = req.body;
          if (!body || typeof body !== 'object') {
            const buffers: any[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            body = data ? JSON.parse(data) : {};
          }

          const prompt = body.prompt;
          if (!prompt) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Prompt is required' }));
            return;
          }

          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ text: response.text }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
