import { ConfigFile, PromptTemplate } from '../types';

export const VERCEL_JSON_CONTENT = `{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}`;

export const VERCEL_IGNORE_CONTENT = `.git
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
node_modules
dist
.vercel
assets/.aistudio`;

export const PACKAGE_JSON_CONTENT = `{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  }
}`;

export const API_HEALTH_CONTENT = `import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
  res.status(200).json({
    status: 'ok',
    environment: process.env.VERCEL ? 'vercel' : 'local',
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
}`;

export const API_GENERATE_CONTENT = `import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY environment variable is not set on Vercel.',
      docs: 'Configure GEMINI_API_KEY in Vercel Project Settings > Environment Variables.'
    });
  }

  try {
    const { prompt } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.status(200).json({ text: response.text });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}`;

export const CONFIG_FILES: ConfigFile[] = [
  {
    name: 'vercel.json',
    path: '/vercel.json',
    description: 'Vercel deployment manifest configuring framework (Vite), build output directory (dist), SPA routing rewrites, and static header caching.',
    content: VERCEL_JSON_CONTENT,
    language: 'json',
  },
  {
    name: '.vercelignore',
    path: '/.vercelignore',
    description: 'Excludes node_modules, build artifacts, and secret files from being uploaded to Vercel build servers.',
    content: VERCEL_IGNORE_CONTENT,
    language: 'ignore',
  },
  {
    name: 'package.json',
    path: '/package.json',
    description: 'Standard Node manifest with Vite build script and zero-config dependency definitions.',
    content: PACKAGE_JSON_CONTENT,
    language: 'json',
  },
  {
    name: 'api/health.ts',
    path: '/api/health.ts',
    description: 'Vercel Serverless Function endpoint for deployment health checks and environment validation.',
    content: API_HEALTH_CONTENT,
    language: 'typescript',
  },
  {
    name: 'api/generate.ts',
    path: '/api/generate.ts',
    description: 'Serverless backend proxy for Google Gemini AI API calls keeping API keys secure on Vercel.',
    content: API_GENERATE_CONTENT,
    language: 'typescript',
  },
];

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: '1',
    title: 'Vercel Optimization Checklist',
    category: 'Deployment',
    iconName: 'CheckCircle2',
    prompt: 'Provide a concise 5-point checklist for verifying a Vite React app before deploying to Vercel.',
  },
  {
    id: '2',
    title: 'Serverless Function Best Practices',
    category: 'Architecture',
    iconName: 'Server',
    prompt: 'Explain how Vercel Serverless Functions handle CORS, environment variables, and memory limits in TypeScript.',
  },
  {
    id: '3',
    title: 'Custom Domain Setup Guide',
    category: 'DNS & Domains',
    iconName: 'Globe',
    prompt: 'How do I map a custom domain name to my Vercel project using CNAME and A records?',
  },
  {
    id: '4',
    title: 'Vite Environment Variables',
    category: 'Security',
    iconName: 'Key',
    prompt: 'What is the difference between client-side VITE_ variables and server-side process.env secrets on Vercel?',
  },
];
