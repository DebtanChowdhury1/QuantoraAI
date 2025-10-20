import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { touchCounter } from '../utils/limits.js';
import { HttpError } from '../utils/httpError.js';

const predictionSchema = z.object({
  action: z.enum(['BUY', 'HOLD', 'SELL']),
  confidence: z.coerce.number().min(0).max(1),
  reason: z.string().min(3).max(500),
});

const stripCodeFence = (text) => text.replace(/```json|```/gi, '').trim();

const buildPrompt = ({ coinName, periodDays, avgPrice, volatility, change24h }) => {
  return [
    `Coin: ${coinName}`,
    `Period: ${periodDays} days historical`,
    `Avg Price: ${avgPrice.toFixed(2)}`,
    `Volatility: ${volatility.toFixed(2)} %`,
    `24 h Change: ${change24h.toFixed(2)} %`,
    'Task: Predict next trend (BUY/HOLD/SELL), confidence 0-1, reason.',
    'Respond JSON only: {"action":"BUY","confidence":0.78,"reason":"Momentum rising"}',
  ].join('\n');
};

const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, 'Gemini API key missing');
  }

  touchCounter('gemini');

  try {
    console.log('[Gemini] POST generateContent');
    const { data } = await axios.post(
      `${endpoint}?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      },
      { timeout: 20000 }
    );

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini response missing content');
    }
    const cleaned = stripCodeFence(rawText);
    const parsed = predictionSchema.parse(JSON.parse(cleaned));
    return { parsed, raw: data };
  } catch (error) {
    logger.error({ err: error }, 'Gemini API call failed');
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(502, 'Gemini API unavailable', { cause: error.message });
  }
};

export const generatePrediction = async ({
  coinId,
  coinName,
  periodDays,
  avgPrice,
  volatility,
  change24h,
  marketPrice,
}) => {
  const prompt = buildPrompt({ coinName, periodDays, avgPrice, volatility, change24h });
  logger.debug({ coinId, coinName, prompt }, 'Sending prompt to Gemini');

  const { parsed, raw } = await callGemini(prompt);
  const action = parsed.action.toUpperCase();
  const confidence = Math.min(Math.max(parsed.confidence, 0), 1);

  return {
    action,
    confidence,
    reason: parsed.reason.trim(),
    prompt,
    raw,
    metadata: {
      avgPrice,
      volatility,
      change24h,
      periodDays,
      marketPrice,
    },
  };
};




