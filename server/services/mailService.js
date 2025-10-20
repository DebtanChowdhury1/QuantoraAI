import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import { touchCounter } from '../utils/limits.js';
import { HttpError } from '../utils/httpError.js';

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new HttpError(500, 'SMTP credentials missing');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
};

const renderHtml = ({ coinName, coinId, action, confidence, price, reason }) => `
  <div style="font-family: Arial, sans-serif; background-color: #0e1116; color: #f8fafc; padding: 24px;">
    <h1 style="color: #00ff88; margin-bottom: 16px;">Quantora AI Alert — ${action} ${coinId.toUpperCase()}</h1>
    <p style="margin-bottom: 12px;">Coin: <strong>${coinName} (${coinId.toUpperCase()})</strong></p>
    <p style="margin-bottom: 12px;">Market Price: <strong>$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></p>
    <p style="margin-bottom: 12px;">Confidence: <strong>${(confidence * 100).toFixed(1)}%</strong></p>
    <p style="margin-bottom: 12px;">Reason:</p>
    <blockquote style="border-left: 4px solid #00ff88; padding-left: 12px; color: #e2e8f0;">${reason}</blockquote>
    <p style="margin-top: 24px; color: #94a3b8;">Quantora AI — Predict Smarter. Spend Nothing.</p>
  </div>
`;

export const sendAlertEmail = async ({ to, coinId, coinName, action, confidence, price, reason }) => {
  if (!to) {
    throw new HttpError(400, 'Recipient email missing');
  }
  touchCounter('email');

  const mail = {
    from: `Quantora AI <${process.env.SMTP_USER}>`,
    to,
    subject: `🚀 Quantora AI Alert — ${action} ${coinId.toUpperCase()}`,
    html: renderHtml({ coinId, coinName, action, confidence, price, reason }),
  };

  try {
    console.log(`[Mail] Sending alert to ${to}`);
    const result = await getTransporter().sendMail(mail);
    logger.info({ to, messageId: result.messageId }, 'Alert email dispatched');
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Failed to send alert email');
    throw new HttpError(502, 'Alert email dispatch failed', { cause: error.message });
  }
};



