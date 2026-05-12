import { config } from '../utils/limits.js';
import logger from '../utils/logger.js';
import ChatSession from '../models/ChatSession.js';
import Prediction from '../models/Prediction.js';
import { getCryptoData } from './cryptoDataService.js';
import { generateTextAnswer } from './geminiService.js';
import { listInvestmentPlans } from './investmentPlanService.js';

const formatUsd = (value, money = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  const currency = money.displayCurrency || 'USD';
  const rate = Number(money.fxRate) > 0 ? Number(money.fxRate) : 1;
  const converted = numeric * rate;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: numeric >= 1 ? 2 : 4,
    maximumFractionDigits: numeric >= 1 ? 2 : 8,
  }).format(converted);
};

const formatConfidence = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${(numeric * 100).toFixed(3)}%`;
};

const compactSignal = (prediction) => {
  if (!prediction) return 'No stored Quantora signal yet.';
  return `${prediction.action} (${formatConfidence(prediction.confidence)} confidence), ${prediction.riskLevel} risk, ${prediction.trendDirection} trend. Reason: ${prediction.reason}`;
};

const buildCoinContext = async (coinId, money = {}) => {
  const [snapshot, latest, history] = await Promise.all([
    getCryptoData(coinId),
    Prediction.findOne({ coinId, sourceType: 'raw' }).sort({ createdAt: -1 }),
    Prediction.find({ coinId, sourceType: 'raw' }).sort({ createdAt: -1 }).limit(8),
  ]);

  const prices = Array.isArray(snapshot.history) ? snapshot.history : [];
  const first = prices[0]?.[1];
  const last = prices[prices.length - 1]?.[1] ?? snapshot.price;
  const sevenDayChange =
    Number.isFinite(Number(first)) && Number(first) > 0
      ? ((Number(last) - Number(first)) / Number(first)) * 100
      : null;

  return {
    scope: 'coin',
    coinId,
    money,
    snapshot,
    latest,
    history,
    summary: [
      `Coin: ${snapshot.name} (${snapshot.symbol})`,
      `Current price: ${formatUsd(snapshot.price, money)}`,
      `24h change: ${Number(snapshot.change_24h ?? 0).toFixed(2)}%`,
      `7d volatility: ${Number(snapshot.volatility_7d ?? 0).toFixed(2)}%`,
      `7d price change: ${Number.isFinite(sevenDayChange) ? `${sevenDayChange.toFixed(2)}%` : 'N/A'}`,
      `Market cap: ${formatUsd(snapshot.market_cap, money)}`,
      `24h volume: ${formatUsd(snapshot.total_volume, money)}`,
      `Latest Quantora signal: ${compactSignal(latest)}`,
      `Recent signal actions: ${history.map((item) => item.action).join(', ') || 'none'}`,
    ].join('\n'),
  };
};

const buildPortfolioSummary = async (portfolioSessionId, money = {}) => {
  if (!portfolioSessionId) {
    return {
      items: [],
      summary: 'No saved portfolio cases are connected to this chat yet.',
    };
  }

  try {
    const items = await listInvestmentPlans(portfolioSessionId);
    if (!items.length) {
      return { items, summary: 'No saved portfolio cases yet.' };
    }
    const open = items.filter((item) => item.plan?.status === 'OPEN');
    const planned = items.filter((item) => item.plan?.status === 'PLANNED');
    const pnl = open.reduce((total, item) => total + Number(item.position?.pnlUsd || 0), 0);
    return {
      items,
      summary: [
        `Portfolio cases: ${items.length} total, ${open.length} already bought, ${planned.length} planned buys.`,
        `Tracked open P/L: ${formatUsd(pnl, money)}.`,
        ...items.slice(0, 8).map((item) =>
          [
            `${item.market?.name || item.plan.coinId} ${item.plan.status}`,
            `entry ${formatUsd(item.plan.entryPrice, money)}`,
            `live ${formatUsd(item.market?.currentPrice, money)}`,
            `P/L ${formatUsd(item.position?.pnlUsd, money)} (${Number(item.position?.pnlPct || 0).toFixed(3)}%)`,
            `signal ${item.signal?.action || 'HOLD'} ${item.signal ? formatConfidence(item.signal.confidence) : ''}`,
            item.exitPlan?.sellReviewAt
              ? `sell review ${new Date(item.exitPlan.sellReviewAt).toLocaleString('en-US')}`
              : null,
          ]
            .filter(Boolean)
            .join(' | ')
        ),
      ].join('\n'),
    };
  } catch (error) {
    logger.warn({ err: error }, 'Unable to load portfolio context for chat');
    return { items: [], summary: 'Portfolio context is temporarily unavailable.' };
  }
};

const buildExpertContext = async ({ portfolioSessionId, displayCurrency = 'USD', fxRate = 1 } = {}) => {
  const money = { displayCurrency, fxRate };
  const rows = await Promise.allSettled(config.coins.slice(0, 20).map((coinId) => getCryptoData(coinId)));
  const snapshots = rows
    .filter((row) => row.status === 'fulfilled')
    .map((row) => row.value);
  const latestSignals = await Prediction.find({
    coinId: { $in: snapshots.map((item) => item.coinId) },
    sourceType: 'raw',
  })
    .sort({ createdAt: -1 })
    .limit(80);
  const byCoin = new Map();
  latestSignals.forEach((signal) => {
    if (!byCoin.has(signal.coinId)) byCoin.set(signal.coinId, signal);
  });
  const ranked = snapshots
    .map((snapshot) => {
      const signal = byCoin.get(snapshot.coinId);
      const score =
        (signal?.action === 'BUY' ? 35 : signal?.action === 'HOLD' ? 12 : -20) +
        Number(snapshot.change_24h ?? 0) * 2 -
        Number(snapshot.volatility_7d ?? 0) +
        Number(signal?.confidence ?? 0) * 25;
      return { snapshot, signal, score };
    })
    .sort((a, b) => b.score - a.score);

  const portfolio = await buildPortfolioSummary(portfolioSessionId, money);

  return {
    scope: 'expert',
    ranked,
    byCoin: new Map(
      ranked.flatMap((entry) => [
        [entry.snapshot.coinId.toLowerCase(), entry],
        [String(entry.snapshot.symbol || '').toLowerCase(), entry],
        [String(entry.snapshot.name || '').toLowerCase(), entry],
      ])
    ),
    portfolio,
    money,
    summary: [
      'MARKET RANKING',
      ranked
        .map(({ snapshot, signal, score }, index) =>
          [
            `${index + 1}. ${snapshot.name} (${snapshot.symbol})`,
            `price ${formatUsd(snapshot.price, money)}`,
            `24h ${Number(snapshot.change_24h ?? 0).toFixed(2)}%`,
            `vol ${Number(snapshot.volatility_7d ?? 0).toFixed(2)}%`,
            `signal ${signal ? `${signal.action} ${formatConfidence(signal.confidence)}` : 'not generated'}`,
            `rank score ${score.toFixed(1)}`,
          ].join(' | ')
        )
        .join('\n'),
      '',
      'USER PORTFOLIO / ACTIONS',
      portfolio.summary,
    ].join('\n'),
  };
};

const findMentionedCoin = (question, context) => {
  if (context.scope !== 'expert') return null;
  const normalized = String(question || '').toLowerCase();
  let match = null;
  context.byCoin.forEach((entry, key) => {
    if (!key || match) return;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = key.length <= 4 ? new RegExp(`\\b${escaped}\\b`) : new RegExp(escaped);
    if (pattern.test(normalized)) {
      match = entry;
    }
  });
  return match;
};

const describeEntry = ({ snapshot, signal, score, money = {} }) => {
  const action = signal?.action || 'HOLD';
  const confidence = signal ? formatConfidence(signal.confidence) : 'not available';
  const trend = signal?.trendDirection || 'SIDEWAYS';
  const risk = signal?.riskLevel || 'MEDIUM';
  return [
    `${snapshot.name} (${snapshot.symbol}) snapshot:`,
    `- Price: ${formatUsd(snapshot.price, money)}`,
    `- 24h move: ${Number(snapshot.change_24h ?? 0).toFixed(2)}%`,
    `- 7d volatility: ${Number(snapshot.volatility_7d ?? 0).toFixed(2)}%`,
    `- Quantora signal: ${action} (${confidence} confidence)`,
    `- Trend/Risk: ${trend} / ${risk}`,
    `- Relative market score: ${Number(score ?? 0).toFixed(1)}`,
    action === 'BUY'
      ? 'Read: this is one of the stronger setups, but still wait for confirmation and control position size.'
      : action === 'SELL'
      ? 'Read: downside risk is elevated, so this is not a clean buy setup right now.'
      : 'Read: the market edge is not strong enough yet; watch for momentum and confidence to improve.',
  ].join('\n');
};

const conversationTone = ({ action, confidence, risk }) => {
  if (action === 'BUY') {
    return `I would call this constructive, not automatic. The signal is BUY with ${confidence} confidence and ${risk} risk, so the setup deserves attention, but I would still want price confirmation before sizing up.`;
  }
  if (action === 'SELL') {
    return `I would be defensive here. The signal is SELL with ${confidence} confidence and ${risk} risk, so the first job is capital protection, not forcing a new entry.`;
  }
  return `I would not chase this right now. HOLD means Quantora sees a mixed or range-bound setup: there is not enough edge for a confident buy, and not enough downside pressure for a clean sell.`;
};

const buildHumanAnswer = ({ question, snapshot, signal, extra = [], money = {} }) => {
  const action = signal?.action || 'HOLD';
  const confidence = signal ? formatConfidence(signal.confidence) : 'not available';
  const risk = signal?.riskLevel || 'MEDIUM';
  const trend = signal?.trendDirection || 'SIDEWAYS';
  const strength = Number(signal?.marketStrength ?? 50).toFixed(1);

  return [
    `Here is my read on ${snapshot.name} right now:`,
    '',
    conversationTone({ action, confidence, risk }),
    '',
    `Price is ${formatUsd(snapshot.price, money)}, the 24h move is ${Number(snapshot.change_24h ?? 0).toFixed(2)}%, and 7d volatility is ${Number(snapshot.volatility_7d ?? 0).toFixed(2)}%. Trend is ${trend}, market strength is ${strength}/100.`,
    ...extra,
    '',
    question.toLowerCase().includes('buy')
      ? action === 'BUY'
        ? 'If you are planning to buy, I would treat the current price as a watch zone and wait for confirmation rather than entering blindly.'
        : 'If you are planning to buy, I would wait. I want either stronger momentum, improving confidence, or a cleaner pullback into your planned entry zone.'
      : 'The practical move is to monitor the signal confidence and price behavior around your risk level instead of reacting to one tick.',
    '',
    'Not financial advice. If you tell me your entry price and whether you already bought, I can review the position more precisely.',
  ].join('\n');
};

const fallbackAnswer = ({ question, context }) => {
  if (context.scope === 'coin') {
    const s = context.snapshot;
    const signal = context.latest;
    return buildHumanAnswer({ question, snapshot: s, signal, money: context.money });
  }
  const mentioned = findMentionedCoin(question, context);
  if (mentioned) {
    return buildHumanAnswer({
      question,
      snapshot: mentioned.snapshot,
      signal: mentioned.signal,
      money: context.money,
      extra: [`Relative market score inside the tracked list is ${Number(mentioned.score ?? 0).toFixed(1)}.`],
    });
  }
  if (context.portfolio?.items?.length) {
    const open = context.portfolio.items.filter((item) => item.plan?.status === 'OPEN');
    const planned = context.portfolio.items.filter((item) => item.plan?.status === 'PLANNED');
    const pnl = open.reduce((total, item) => total + Number(item.position?.pnlUsd || 0), 0);
    const lead = open[0] || planned[0];
    return [
      'Here is the account-level read from what you have saved:',
      '',
      `You have ${open.length} already-bought position${open.length === 1 ? '' : 's'} and ${planned.length} planned buy case${planned.length === 1 ? '' : 's'}. Current tracked open P/L is ${formatUsd(pnl, context.money)}.`,
      lead
        ? `${lead.market?.name || lead.plan.coinId} is the first case I would review: entry ${formatUsd(lead.plan.entryPrice, context.money)}, live ${formatUsd(lead.market?.currentPrice, context.money)}, P/L ${formatUsd(lead.position?.pnlUsd, context.money)} (${Number(lead.position?.pnlPct || 0).toFixed(3)}%), signal ${lead.signal?.action || 'HOLD'} ${lead.signal ? formatConfidence(lead.signal.confidence) : ''}.`
        : '',
      lead?.exitPlan
        ? `For that position, the next sell-review window is ${new Date(lead.exitPlan.sellReviewAt).toLocaleString('en-US')}, and the risk-review window is ${new Date(lead.exitPlan.riskReviewAt).toLocaleString('en-US')}. Profit zone is ${formatUsd(lead.exitPlan.profitTarget, context.money)}; stop zone is ${formatUsd(lead.exitPlan.stopTarget, context.money)}.`
        : '',
      '',
      open.length
        ? 'What I would do next: check whether your live price is respecting the stop zone, then review partial profit only if price approaches the sell-review zone while confidence weakens or upside probability stops improving.'
        : 'What I would do next: keep planned buys on a watchlist and wait for price to approach the planned entry zone with improving confidence.',
      '',
      'Ask me about one saved coin by name and I’ll go deeper into the exact hold/sell/wait decision.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  const top = context.ranked.slice(0, 3);
  return [
    'I scanned the tracked market. I would shortlist these first, then inspect each chart before acting:',
    '',
    top
      .map(
        ({ snapshot, signal }, index) =>
          `${index + 1}. ${snapshot.name}: ${signal?.action || 'HOLD'} signal, ${signal ? formatConfidence(signal.confidence) : '0.000%'} confidence, ${Number(snapshot.change_24h ?? 0).toFixed(2)}% 24h move, ${Number(snapshot.volatility_7d ?? 0).toFixed(2)}% volatility.`
      )
      .join('\n'),
    '',
    'If you want, ask me about one coin by name and I will give you the entry/risk read directly. Not financial advice.',
  ].join('\n');
};

const answerWithContext = async ({ question, context, messages }) => {
  const recent = messages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n');
  const system = [
    'You are Quantora AI Coin Expert, a calm senior crypto market analyst inside a SaaS product.',
    'Reply like a real human expert in a chat, not like a generic bot or a report generator.',
    'Use the supplied market context and chat history only. Do not invent news, prices, exchange actions, or guaranteed outcomes.',
    'Directly answer the user first, then explain the reasoning from price, 24h move, volatility, trend, confidence, and risk.',
    'If portfolio context exists, treat it as the user account state: mention what they already bought, planned, current P/L, and next review windows before giving generic market ideas.',
    'Use the currency shown in the supplied context. Do not switch back to USD if the context uses INR, EUR, GBP, or another selected currency.',
    'Continue the conversation using prior messages. If the user asks "what should I do", answer from their saved portfolio and thread history first.',
    'Be practical: say what you would watch, what would confirm the setup, and what would invalidate it.',
    'Keep responses concise but useful: 2-5 short paragraphs or tight bullets when comparison is needed.',
    'Avoid phrases like "as an AI", "I cannot", "based on the latest data" repeated mechanically, or generic disclaimers in every paragraph.',
    'Never tell the user to buy with certainty. Include one short "not financial advice" note only when trade guidance is requested.',
  ].join(' ');
  const prompt = [
    'MARKET CONTEXT',
    context.summary,
    '',
    'CHAT HISTORY',
    recent || 'No previous chat.',
    '',
    `USER QUESTION: ${question}`,
  ].join('\n');

  try {
    const response = await generateTextAnswer({ system, prompt });
    return { content: response.content, provider: response.provider };
  } catch (error) {
    logger.warn({ err: error }, 'Chat AI provider unavailable; using market fallback answer');
    return { content: fallbackAnswer({ question, context }), provider: 'quantora-fallback' };
  }
};

const createOpeningMessage = (context) => {
  if (context.scope === 'coin') {
    const s = context.snapshot;
    return `I’m watching ${s.name} now: live price, 24h move, volatility, recent signals, and Quantora’s current read are loaded. Ask me like you would ask a market analyst: “should I wait?”, “where is risk?”, or “what would confirm a buy?”`;
  }
  const top = context.ranked.slice(0, 3);
  const portfolioLine = context.portfolio?.items?.length
    ? `I also see your saved portfolio cases: ${context.portfolio.summary.split('\n')[0]} I’ll use those before giving generic market suggestions.`
    : 'I do not see saved portfolio cases yet, so I’ll start from market conditions until you add a planned buy or bought position.';
  return [
    'I scanned the tracked market and ranked the cleanest setups by signal, momentum, volatility, and confidence.',
    portfolioLine,
    top
      .map(
        ({ snapshot, signal }, index) =>
          `${index + 1}. ${snapshot.name} (${snapshot.symbol}) - ${signal?.action || 'HOLD'} / ${signal ? formatConfidence(signal.confidence) : '0.000%'} confidence / ${Number(snapshot.change_24h ?? 0).toFixed(2)}% 24h`
      )
      .join('\n'),
    'Tell me a coin, your risk style, or an entry price and I’ll give you the practical read.',
  ].join('\n');
};

const buildFilter = ({ sessionId, scope, coinId, threadId = 'default' }) => ({
  sessionId,
  scope,
  coinId: coinId || null,
  threadId,
});

export const listChatThreads = async ({ sessionId, scope, coinId }) =>
  ChatSession.find({ sessionId, scope, coinId: coinId || null })
    .sort({ updatedAt: -1 })
    .select('threadId title scope coinId messages createdAt updatedAt')
    .lean();

export const getOrCreateChat = async ({
  sessionId,
  portfolioSessionId,
  displayCurrency = 'USD',
  fxRate = 1,
  scope,
  coinId,
  threadId = 'default',
}) => {
  const filter = buildFilter({ sessionId, scope, coinId, threadId });
  let session = await ChatSession.findOne(filter);
  if (session) return session;

  const money = { displayCurrency, fxRate };
  const context =
    scope === 'coin'
      ? await buildCoinContext(coinId, money)
      : await buildExpertContext({ portfolioSessionId, displayCurrency, fxRate });
  session = await ChatSession.create({
    ...filter,
    title: scope === 'coin' ? `${coinId} expert chat` : 'AI Coin Expert',
    messages: [{ role: 'assistant', content: createOpeningMessage(context), meta: { provider: 'quantora-context' } }],
  });
  return session;
};

export const sendChatMessage = async ({
  sessionId,
  portfolioSessionId,
  displayCurrency = 'USD',
  fxRate = 1,
  scope,
  coinId,
  threadId = 'default',
  question,
}) => {
  const session = await getOrCreateChat({
    sessionId,
    portfolioSessionId,
    displayCurrency,
    fxRate,
    scope,
    coinId,
    threadId,
  });
  const money = { displayCurrency, fxRate };
  const context =
    scope === 'coin'
      ? await buildCoinContext(coinId, money)
      : await buildExpertContext({ portfolioSessionId, displayCurrency, fxRate });
  session.messages.push({ role: 'user', content: question });
  const answer = await answerWithContext({ question, context, messages: session.messages });
  session.messages.push({
    role: 'assistant',
    content: answer.content,
    meta: { provider: answer.provider, contextScope: scope, coinId },
  });
  await session.save();
  return session;
};

export const clearChatThread = async ({
  sessionId,
  portfolioSessionId,
  displayCurrency = 'USD',
  fxRate = 1,
  scope,
  coinId,
  threadId = 'default',
}) => {
  const filter = buildFilter({ sessionId, scope, coinId, threadId });
  const money = { displayCurrency, fxRate };
  const context =
    scope === 'coin'
      ? await buildCoinContext(coinId, money)
      : await buildExpertContext({ portfolioSessionId, displayCurrency, fxRate });
  const session = await ChatSession.findOneAndUpdate(
    filter,
    {
      ...filter,
      title: scope === 'coin' ? `${coinId} expert chat` : 'AI Coin Expert',
      messages: [
        {
          role: 'assistant',
          content: createOpeningMessage(context),
          meta: { provider: 'quantora-context', threadCleared: true },
        },
      ],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return session;
};

export const deleteChatThread = async ({ sessionId, scope, coinId, threadId = 'default' }) =>
  ChatSession.deleteOne(buildFilter({ sessionId, scope, coinId, threadId }));

export const deleteChatMessage = async ({ sessionId, scope, coinId, threadId = 'default', messageId }) => {
  const session = await ChatSession.findOne(buildFilter({ sessionId, scope, coinId, threadId }));
  if (!session) return null;
  session.messages = session.messages.filter((message) => message._id.toString() !== messageId);
  await session.save();
  return session;
};
