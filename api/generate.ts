import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY environment variable is not set on Vercel or local environment.',
      docs: 'Configure GEMINI_API_KEY in your Vercel Project Settings > Environment Variables.'
    });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return res.status(200).json({ text: response.text });
  } catch (err: any) {
    console.error('API Error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while generating content'
    });
  }
}
