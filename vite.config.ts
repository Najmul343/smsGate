import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import express from 'express';

import healthHandler from './api/health';
import sendHandler from './api/sms/send';
import deliveryHandler from './api/sms/delivery';
import devicesHandler from './api/sms/devices';
import webhookHandler from './api/sms/webhook';
import generateHandler from './api/generate';

function wrapHandler(handler: Function) {
  return async (req: any, res: any) => {
    if (!res.status) {
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
    }
    if (!res.json) {
      res.json = (data: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
      };
    }

    if (!req.query) {
      req.query = {};
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        for (const [k, v] of parsedUrl.searchParams.entries()) {
          req.query[k] = v;
        }
      } catch {}
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      if (!req.body) {
        req.body = {};
      }
    }

    try {
      await handler(req, res);
    } catch (err: any) {
      console.error('API Middleware Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
    }
  };
}

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(express.json());
      server.middlewares.use(express.urlencoded({ extended: true }));
      server.middlewares.use(express.text());

      server.middlewares.use('/api/health', wrapHandler(healthHandler));
      server.middlewares.use('/api/sms/send', wrapHandler(sendHandler));
      server.middlewares.use('/api/sms/delivery', wrapHandler(deliveryHandler));
      server.middlewares.use('/api/sms/devices', wrapHandler(devicesHandler));
      server.middlewares.use('/api/sms/webhook', wrapHandler(webhookHandler));
      server.middlewares.use('/api/generate', wrapHandler(generateHandler));
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
