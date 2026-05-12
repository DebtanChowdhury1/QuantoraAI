import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { getFxRates, getSupportedFxCurrencies } from '../services/fxService.js';

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = await getFxRates();
    res.json({
      data: {
        ...data,
        supported: getSupportedFxCurrencies(),
      },
    });
  })
);

export default router;
