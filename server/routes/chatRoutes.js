import express from 'express';
import { z } from 'zod';
import asyncHandler from '../utils/asyncHandler.js';
import { badRequest } from '../utils/httpError.js';
import {
  clearChatThread,
  deleteChatMessage,
  deleteChatThread,
  getOrCreateChat,
  listChatThreads,
  sendChatMessage,
} from '../services/chatService.js';

const router = express.Router();

const requestSchema = z.object({
  sessionId: z.string().min(8).max(120),
  portfolioSessionId: z.string().min(6).max(120).optional(),
  displayCurrency: z.string().trim().toUpperCase().min(3).max(5).optional(),
  fxRate: z.coerce.number().positive().optional(),
  threadId: z.string().min(1).max(120).optional(),
  scope: z.enum(['coin', 'expert']),
  coinId: z.string().min(1).max(80).optional(),
});

const messageSchema = requestSchema.extend({
  message: z.string().min(1).max(1200),
});

router.get(
  '/threads',
  asyncHandler(async (req, res) => {
    const parsed = requestSchema.safeParse({
      sessionId: req.query.sessionId,
      portfolioSessionId: req.query.portfolioSessionId || undefined,
      displayCurrency: req.query.displayCurrency || undefined,
      fxRate: req.query.fxRate || undefined,
      scope: req.query.scope,
      coinId: req.query.coinId || undefined,
    });
    if (!parsed.success) throw badRequest('Invalid chat thread request');
    if (parsed.data.scope === 'coin' && !parsed.data.coinId) throw badRequest('coinId is required');
    const data = await listChatThreads(parsed.data);
    res.json({ data });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = requestSchema.safeParse({
      sessionId: req.query.sessionId,
      portfolioSessionId: req.query.portfolioSessionId || undefined,
      displayCurrency: req.query.displayCurrency || undefined,
      fxRate: req.query.fxRate || undefined,
      threadId: req.query.threadId || undefined,
      scope: req.query.scope,
      coinId: req.query.coinId || undefined,
    });
    if (!parsed.success) throw badRequest('Invalid chat request');
    if (parsed.data.scope === 'coin' && !parsed.data.coinId) throw badRequest('coinId is required');
    const data = await getOrCreateChat(parsed.data);
    res.json({ data });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid chat message');
    if (parsed.data.scope === 'coin' && !parsed.data.coinId) throw badRequest('coinId is required');
    const data = await sendChatMessage({
      ...parsed.data,
      question: parsed.data.message,
    });
    res.status(201).json({ data });
  })
);

router.delete(
  '/message',
  asyncHandler(async (req, res) => {
    const parsed = requestSchema.extend({ messageId: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid message delete request');
    const data = await deleteChatMessage(parsed.data);
    res.json({ data });
  })
);

router.delete(
  '/thread',
  asyncHandler(async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid thread delete request');
    await deleteChatThread(parsed.data);
    res.json({ data: { deleted: true } });
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid chat delete request');
    const data = await clearChatThread(parsed.data);
    res.json({ data, meta: { cleared: true } });
  })
);

export default router;
