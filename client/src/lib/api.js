import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (['get', undefined].includes(config.method)) {
    config.params = {
      ...(config.params || {}),
      _live: Date.now(),
    };
    config.headers = {
      ...(config.headers || {}),
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const canRetry =
      !config.__retried &&
      (!status || status === 429 || status >= 500) &&
      ['get', undefined].includes(config.method);

    if (canRetry) {
      config.__retried = true;
      await new Promise((resolve) => setTimeout(resolve, status === 429 ? 1200 : 500));
      return api(config);
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Unexpected error';
    return Promise.reject(new Error(message));
  }
);

export const fetchMarkets = async () => {
  const { data } = await api.get('/markets');
  return data;
};

export const fetchCoinHistory = async (coinId, period = '7') => {
  const { data } = await api.get(`/history/${coinId}`, { params: { period } });
  return data;
};

export const fetchPrediction = async (coinId, options = {}) => {
  const { data } = await api.get(`/predict/${coinId}`, {
    params: { force: options.force ? 'true' : undefined },
  });
  return data;
};

export const fetchPredictions = async (options = {}) => {
  const { data } = await api.get('/predict', {
    params: { refresh: options.refresh === false ? 'false' : 'true' },
  });
  return data;
};

export const fetchPredictionHistory = async (coinId, limit = 50) => {
  const { data } = await api.get(`/predict/${coinId}/history`, { params: { limit } });
  return data;
};

export const fetchAlertPreferences = async ({ clerkId, email }) => {
  const { data } = await api.get('/alerts/preferences', {
    headers: {
      'x-clerk-user-id': clerkId,
      'x-user-email': email,
    },
  });
  return data;
};

export const updateAlertPreferences = async ({ clerkId, email, preferences }) => {
  const { data } = await api.put(
    '/alerts/preferences',
    { preferences },
    {
      headers: {
        'x-clerk-user-id': clerkId,
        'x-user-email': email,
      },
    }
  );
  return data;
};

export const fetchAlertHistory = async (params = {}) => {
  const { data } = await api.get('/alerts/history', { params });
  return data;
};

export const fetchEmailNotificationSettings = async ({ clerkId, email }) => {
  const { data } = await api.get('/alerts/email-settings', {
    headers: {
      'x-clerk-user-id': clerkId,
      'x-user-email': email,
    },
  });
  return data;
};

export const updateEmailNotificationSettings = async ({ clerkId, email, settings }) => {
  const { data } = await api.put(
    '/alerts/email-settings',
    { settings },
    {
      headers: {
        'x-clerk-user-id': clerkId,
        'x-user-email': email,
      },
    }
  );
  return data;
};

export const sendCustomNotificationEmail = async ({ clerkId, email, ...payload }) => {
  const { data } = await api.post('/alerts/custom-email', payload, {
    headers: {
      'x-clerk-user-id': clerkId,
      'x-user-email': email,
    },
  });
  return data;
};

export const fetchSnapshot = async (coinId) => {
  const { data } = await api.get(`/snapshot/${coinId}`);
  return data;
};

export const searchCoins = async (query) => {
  const { data } = await api.get('/search', { params: { query } });
  return data;
};

export const fetchFxRates = async () => {
  const { data } = await api.get('/fx');
  return data;
};

export const fetchChatThreads = async ({ sessionId, portfolioSessionId, displayCurrency, fxRate, scope, coinId }) => {
  const { data } = await api.get('/chat/threads', {
    params: { sessionId, portfolioSessionId, displayCurrency, fxRate, scope, coinId },
  });
  return data;
};

export const fetchChat = async ({ sessionId, portfolioSessionId, displayCurrency, fxRate, threadId, scope, coinId }) => {
  const { data } = await api.get('/chat', {
    params: { sessionId, portfolioSessionId, displayCurrency, fxRate, threadId, scope, coinId },
  });
  return data;
};

export const sendChat = async ({ sessionId, portfolioSessionId, displayCurrency, fxRate, threadId, scope, coinId, message }) => {
  const { data } = await api.post('/chat', {
    sessionId,
    portfolioSessionId,
    displayCurrency,
    fxRate,
    threadId,
    scope,
    coinId,
    message,
  });
  return data;
};

export const clearChat = async ({ sessionId, portfolioSessionId, displayCurrency, fxRate, threadId, scope, coinId }) => {
  const { data } = await api.delete('/chat', {
    data: { sessionId, portfolioSessionId, displayCurrency, fxRate, threadId, scope, coinId },
  });
  return data;
};

export const deleteChatThread = async ({ sessionId, threadId, scope, coinId }) => {
  const { data } = await api.delete('/chat/thread', { data: { sessionId, threadId, scope, coinId } });
  return data;
};

export const deleteChatMessage = async ({ sessionId, threadId, scope, coinId, messageId }) => {
  const { data } = await api.delete('/chat/message', {
    data: { sessionId, threadId, scope, coinId, messageId },
  });
  return data;
};

export const fetchInvestmentPlans = async (sessionId) => {
  const { data } = await api.get('/investments', { params: { sessionId } });
  return data;
};

export const migrateInvestmentPlans = async ({ fromSessionId, fromSessionIds, toSessionId }) => {
  const { data } = await api.post('/investments/migrate', { fromSessionId, fromSessionIds, toSessionId });
  return data;
};

export const createInvestmentPlan = async (payload) => {
  const { data } = await api.post('/investments', payload);
  return data;
};

export const updateInvestmentPlan = async ({ id, ...payload }) => {
  const { data } = await api.put(`/investments/${id}`, payload);
  return data;
};

export const deleteInvestmentPlan = async ({ id, sessionId }) => {
  const { data } = await api.delete(`/investments/${id}`, { data: { sessionId } });
  return data;
};

export default api;
