import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: true, quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import { touchCounter } from '../utils/limits.js';
import { HttpError } from '../utils/httpError.js';

let transporter;

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const TYPE_LABELS = {
  SIGNAL: 'AI Signal',
  AI_SIGNAL: 'AI Signal',
  MARKET_MOVE: 'Market Move',
  PORTFOLIO_TRIGGER: 'Portfolio Trigger',
  PORTFOLIO_VALUE: 'Portfolio Update',
  TEST: 'Delivery Test',
};

const ACTION_LABELS = {
  BUY: 'Buy signal',
  HOLD: 'Hold signal',
  SELL: 'Sell signal',
  UP: 'Price up',
  DOWN: 'Price down',
  PROFIT: 'Take-profit review',
  STOP: 'Risk review',
  UPDATE: 'Portfolio update',
};

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const normalizeAction = (action = 'UPDATE') => String(action || 'UPDATE').toUpperCase();

const actionColor = (action = '') => {
  const normalized = normalizeAction(action);
  if (['BUY', 'UP', 'PROFIT'].includes(normalized)) return '#00f58c';
  if (['SELL', 'DOWN', 'STOP'].includes(normalized)) return '#ff6370';
  return '#ffc400';
};

const formatPrice = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `$${number.toLocaleString('en-US', {
    minimumFractionDigits: number >= 1 ? 2 : 6,
    maximumFractionDigits: number >= 1 ? 2 : 8,
  })}`;
};

const formatConfidence = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const pct = number <= 1 ? number * 100 : number;
  return `${pct.toFixed(3)}%`;
};

const formatChange = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${number >= 0 ? '+' : ''}${number.toFixed(3)}%`;
};

const buildPlainText = ({ title, body, metaItems }) =>
  [
    title,
    '',
    body,
    '',
    ...metaItems.map((item) => `${item.label}: ${item.value}`),
    '',
    'This platform provides AI-generated market insights and not financial advice.',
  ].join('\n');

const renderNotificationHtml = ({
  title,
  body,
  type = 'SIGNAL',
  coinId,
  coinName,
  displayName,
  action = 'UPDATE',
  confidence,
  price,
  changePct,
  trigger,
}) => {
  const normalizedAction = normalizeAction(action);
  const accent = actionColor(normalizedAction);
  const typeLabel = TYPE_LABELS[String(type || '').toUpperCase()] || 'Quantora Alert';
  const coinLabel = displayName || coinName || coinId || 'Account';
  const symbol = coinId ? String(coinId).toUpperCase() : 'QUANTORA';
  const metaItems = [
    { label: 'Alert type', value: typeLabel },
    { label: 'Asset', value: coinLabel ? `${coinLabel}${coinId ? ` (${symbol})` : ''}` : null },
    { label: 'Action', value: ACTION_LABELS[normalizedAction] || normalizedAction },
    { label: 'Market price', value: formatPrice(price) },
    { label: '24h move', value: formatChange(changePct) },
    { label: 'Confidence', value: formatConfidence(confidence) },
    { label: 'Trigger', value: trigger ? String(trigger).replaceAll('_', ' ') : null },
  ].filter((item) => item.value);

  const safeTitle = escapeHtml(title || 'Quantora AI notification');
  const safeBody = escapeHtml(body || 'A Quantora AI notification was generated for your account.');
  const safeAction = escapeHtml(ACTION_LABELS[normalizedAction] || normalizedAction);

  return {
    text: buildPlainText({ title: title || 'Quantora AI notification', body: body || '', metaItems }),
    html: `
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safeBody}</div>
      <div style="margin:0;padding:0;background:#050706;color:#f8fafc;font-family:Inter,Arial,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050706;padding:28px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid rgba(0,245,140,0.28);border-radius:22px;overflow:hidden;background:#090d0f;box-shadow:0 20px 60px rgba(0,245,140,0.12);">
                <tr>
                  <td style="padding:28px 30px 18px 30px;background:linear-gradient(135deg,#07110d 0%,#101618 60%,#06120d 100%);">
                    <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#00f58c;font-weight:800;">Quantora AI</div>
                    <h1 style="margin:12px 0 8px 0;color:#f8fafc;font-size:28px;line-height:1.18;font-weight:800;">${safeTitle}</h1>
                    <div style="margin-top:12px;">
                      <span style="display:inline-block;margin:0 8px 8px 0;padding:8px 12px;border-radius:999px;background:${accent}1f;border:1px solid ${accent};color:${accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;">${escapeHtml(typeLabel)}</span>
                      <span style="display:inline-block;margin:0 0 8px 0;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);color:#e8eef7;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;">${safeAction}</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:26px 30px 8px 30px;">
                    <p style="margin:0;color:#d8e4f0;font-size:16px;line-height:1.75;">${safeBody}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 30px 8px 30px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      ${metaItems
                        .map(
                          (item) => `
                            <tr>
                              <td style="padding:13px 0;border-top:1px solid rgba(148,163,184,0.16);color:#8ea0b8;font-size:12px;text-transform:uppercase;letter-spacing:1.6px;">${escapeHtml(item.label)}</td>
                              <td align="right" style="padding:13px 0;border-top:1px solid rgba(148,163,184,0.16);color:#ffffff;font-size:15px;font-weight:800;">${escapeHtml(item.value)}</td>
                            </tr>
                          `
                        )
                        .join('')}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 30px 28px 30px;">
                    <div style="border-left:3px solid ${accent};background:rgba(255,255,255,0.035);padding:14px 16px;border-radius:12px;color:#9fb0c4;font-size:13px;line-height:1.6;">
                      This platform provides AI-generated market insights and not financial advice. Review your risk settings before acting.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
};

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
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseNumber(process.env.SMTP_PORT, 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    requireTLS: !parseBoolean(process.env.SMTP_SECURE, false),
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 25000,
  });

  return transporter;
};

export const sendAlertEmail = async ({ to, coinId, coinName, action, confidence, price, reason }) => {
  if (!to) {
    throw new HttpError(400, 'Recipient email missing');
  }
  touchCounter('email');

  const rendered = renderNotificationHtml({
    title: `Quantora AI alert: ${action} ${String(coinId).toUpperCase()}`,
    body: reason,
    type: 'AI_SIGNAL',
    coinId,
    coinName,
    action,
    confidence,
    price,
  });

  const mail = {
    from: `Quantora AI <${process.env.SMTP_USER}>`,
    to,
    subject: `Quantora AI Alert - ${action} ${String(coinId).toUpperCase()}`,
    html: rendered.html,
    text: rendered.text,
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

export const sendCustomNotificationEmail = async ({
  to,
  subject,
  title,
  body,
  type,
  coinId,
  displayName,
  action,
  confidence,
  price,
  changePct,
  trigger,
}) => {
  if (!to) {
    throw new HttpError(400, 'Recipient email missing');
  }
  touchCounter('email');

  const rendered = renderNotificationHtml({
    title,
    body,
    type,
    coinId,
    displayName,
    action,
    confidence,
    price,
    changePct,
    trigger,
  });

  const mail = {
    from: `Quantora AI <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: rendered.html,
    text: rendered.text,
  };

  try {
    const result = await getTransporter().sendMail(mail);
    logger.info({ to, messageId: result.messageId }, 'Custom notification email dispatched');
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Failed to send custom notification email');
    throw new HttpError(502, 'Notification email dispatch failed', { cause: error.message });
  }
};
