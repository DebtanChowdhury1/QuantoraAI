import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

import axios from 'axios';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { touchCounter } from '../utils/limits.js';
import { HttpError } from '../utils/httpError.js';

const predictionSchema = z.object({
  action: z.enum(['BUY', 'HOLD', 'SELL']),
  confidence: z.coerce.number().min(0).max(1),
  reasoning: z.string().min(3).max(700).optional(),
  reason: z.string().min(3).max(700).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  trendDirection: z.enum(['UPTREND', 'SIDEWAYS', 'DOWNTREND']).optional(),
  predictionHorizon: z.string().min(2).max(24).optional(),
}).refine((value) => value.reasoning || value.reason, {
  message: 'reasoning is required',
});

const stripCodeFence = (text) => text.replace(/```json|```/gi, '').trim();

const buildPrompt = ({ coinName, periodDays, avgPrice, volatility, change24h, marketPrice }) => {
  return [
    'You are Quantora AI, a crypto market intelligence signal engine.',
    'Use only the market metrics provided. Do not invent prices, news, or events.',
    `Coin: ${coinName}`,
    `Period: ${periodDays} days historical`,
    `Current Price: ${marketPrice}`,
    `Avg Price: ${avgPrice.toFixed(2)}`,
    `Volatility: ${volatility.toFixed(2)} %`,
    `24 h Change: ${change24h.toFixed(2)} %`,
    'Task: Generate a structured BUY/HOLD/SELL signal for a 24-72 hour horizon.',
    'Confidence must be calibrated from 0-1 and lower when volatility is high or direction is mixed.',
    'Respond JSON only with this exact shape:',
    '{"action":"BUY|HOLD|SELL","confidence":0.78,"reasoning":"Concise market-based explanation","riskLevel":"LOW|MEDIUM|HIGH","trendDirection":"UPTREND|SIDEWAYS|DOWNTREND","predictionHorizon":"24-72H"}',
  ].join('\n');
};

const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const aiProvider = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
const groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

const summarizeAxiosError = (error, provider) => ({
  message: error.message,
  status: error?.response?.status,
  code: error.code,
  provider,
  model: provider === 'groq' ? groqModel : model,
});

const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, 'Gemini API key missing');
  }

  touchCounter('gemini');

  try {
    console.log('[Gemini] POST generateContent');
    const { data } = await axios.post(
      endpoint,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      },
      {
        timeout: 20000,
        headers: {
          'x-goog-api-key': apiKey,
        },
      }
    );

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini response missing content');
    }
    const cleaned = stripCodeFence(rawText);
    const parsed = predictionSchema.parse(JSON.parse(cleaned));
    return { parsed, raw: data };
  } catch (error) {
    logger.error({ err: summarizeAxiosError(error, 'gemini') }, 'Gemini API call failed');
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(502, 'Gemini API unavailable', { cause: error.message });
  }
};

const callGroq = async (prompt) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, 'Groq API key missing');
  }

  try {
    console.log('[Groq] POST chat/completions');
    const { data } = await axios.post(
      groqEndpoint,
      {
        model: groqModel,
        messages: [
          {
            role: 'system',
            content:
              'You are Quantora AI signal engine. Return only valid JSON with action, confidence, reasoning, riskLevel, trendDirection, and predictionHorizon.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new Error('Groq response missing content');
    }
    const cleaned = stripCodeFence(rawText);
    const parsed = predictionSchema.parse(JSON.parse(cleaned));
    return { parsed, raw: { provider: 'groq', model: groqModel, response: data } };
  } catch (error) {
    logger.error({ err: summarizeAxiosError(error, 'groq') }, 'Groq API call failed');
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(502, 'Groq API unavailable', { cause: error.message });
  }
};

export const generateTextAnswer = async ({ system, prompt }) => {
  const fullPrompt = [system, prompt].filter(Boolean).join('\n\n');

  if (aiProvider === 'heuristic') {
    throw new HttpError(503, 'AI provider disabled');
  }

  if (aiProvider === 'groq' || (!process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY)) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new HttpError(500, 'Groq API key missing');
    const { data } = await axios.post(
      groqEndpoint,
      {
        model: groqModel,
        messages: [
          { role: 'system', content: system || 'You are Quantora AI.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.25,
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI text response missing content');
    return { content: content.trim(), provider: 'groq' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, 'No AI provider configured');
  }
  touchCounter('gemini');
  const { data } = await axios.post(
    endpoint,
    {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.25,
      },
    },
    {
      timeout: 20000,
      headers: {
        'x-goog-api-key': apiKey,
      },
    }
  );

  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('AI text response missing content');
  return { content: content.trim(), provider: 'gemini' };
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
  const prompt = buildPrompt({ coinName, periodDays, avgPrice, volatility, change24h, marketPrice });
  logger.debug({ coinId, coinName }, 'Sending market context to Quantora AI provider');

  let parsed;
  let raw;

  if (aiProvider === 'heuristic') {
    throw new HttpError(503, 'AI provider disabled; using heuristic fallback');
  }

  if (aiProvider === 'groq') {
    ({ parsed, raw } = await callGroq(prompt));
  } else if (aiProvider === 'gemini') {
    ({ parsed, raw } = await callGemini(prompt));
  } else if (process.env.GEMINI_API_KEY) {
    try {
      ({ parsed, raw } = await callGemini(prompt));
    } catch (error) {
      if (!process.env.GROQ_API_KEY) {
        throw error;
      }
      logger.warn({ coinId, cause: error.message }, 'Gemini failed; trying Groq fallback');
      ({ parsed, raw } = await callGroq(prompt));
    }
  } else if (process.env.GROQ_API_KEY) {
    ({ parsed, raw } = await callGroq(prompt));
  } else {
    throw new HttpError(500, 'No AI provider configured');
  }

  const action = parsed.action.toUpperCase();
  const confidence = Math.min(Math.max(parsed.confidence, 0), 1);

  return {
    action,
    confidence,
    reason: (parsed.reasoning || parsed.reason).trim(),
    reasoning: (parsed.reasoning || parsed.reason).trim(),
    riskLevel: parsed.riskLevel,
    trendDirection: parsed.trendDirection,
    predictionHorizon: parsed.predictionHorizon,
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




