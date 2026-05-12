import express from 'express';
import { z } from 'zod';
import asyncHandler from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/httpError.js';
import {
  analyzeInvestmentPlan,
  createInvestmentPlan,
  deleteInvestmentPlan,
  listInvestmentPlans,
  migrateInvestmentPlans,
  updateInvestmentPlan,
} from '../services/investmentPlanService.js';

const router = express.Router();

const planSchema = z.object({
  sessionId: z.string().trim().min(6).max(120),
  coinId: z.string().trim().toLowerCase().min(2).max(80),
  status: z.enum(['PLANNED', 'OPEN']).default('PLANNED'),
  entryPrice: z.coerce.number().positive(),
  quantity: z.coerce.number().min(0).default(0),
  capitalUsd: z.coerce.number().min(0).default(0),
  targetPrice: z.coerce.number().positive().nullable().optional(),
  stopLossPrice: z.coerce.number().positive().nullable().optional(),
  note: z.string().trim().max(500).optional().default(''),
});

const updateSchema = planSchema.partial().extend({
  sessionId: z.string().trim().min(6).max(120),
});

const migrateSchema = z.object({
  fromSessionId: z.string().trim().min(6).max(120).optional(),
  fromSessionIds: z.array(z.string().trim().min(6).max(120)).optional(),
  toSessionId: z.string().trim().min(6).max(120),
});

const parseBody = (schema, body) => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('Invalid investment plan payload', { issues: parsed.error.issues });
  }
  return parsed.data;
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessionId = String(req.query.sessionId || '').trim();
    if (sessionId.length < 6) {
      throw badRequest('sessionId is required');
    }
    const data = await listInvestmentPlans(sessionId);
    res.json({ data, refreshedAt: new Date().toISOString() });
  })
);

router.post(
  '/migrate',
  asyncHandler(async (req, res) => {
    const payload = parseBody(migrateSchema, req.body);
    const sources = payload.fromSessionIds?.length ? payload.fromSessionIds : [payload.fromSessionId].filter(Boolean);
    const results = [];
    let migrated = 0;
    let removedDuplicates = 0;

    for (const fromSessionId of sources) {
      if (!fromSessionId || fromSessionId === payload.toSessionId) continue;
      const result = await migrateInvestmentPlans({ fromSessionId, toSessionId: payload.toSessionId });
      migrated += result.migrated || 0;
      removedDuplicates += result.removedDuplicates || 0;
      results.push({ fromSessionId, ...result });
    }

    const data = { migrated, removedDuplicates, results };
    res.json({ data });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = parseBody(planSchema, req.body);
    const plan = await createInvestmentPlan(payload);
    const analysis = await analyzeInvestmentPlan(plan);
    res.status(201).json({ data: analysis });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = parseBody(updateSchema, req.body);
    const { sessionId, ...updates } = payload;
    const plan = await updateInvestmentPlan({ sessionId, id: req.params.id, updates });
    if (!plan) {
      throw notFound('Investment plan not found');
    }
    const analysis = await analyzeInvestmentPlan(plan);
    res.json({ data: analysis });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const sessionId = String(req.body?.sessionId || req.query.sessionId || '').trim();
    if (sessionId.length < 6) {
      throw badRequest('sessionId is required');
    }
    const result = await deleteInvestmentPlan({ sessionId, id: req.params.id });
    res.json({ data: { deleted: result.deletedCount === 1 } });
  })
);

export default router;
