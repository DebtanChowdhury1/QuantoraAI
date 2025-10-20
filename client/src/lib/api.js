import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
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

export const fetchPrediction = async (coinId) => {
  const { data } = await api.get(`/predict/${coinId}`);
  return data;
};

export const fetchPredictions = async () => {
  const { data } = await api.get('/predict');
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

export const fetchSnapshot = async (coinId) => {
  const { data } = await api.get(`/snapshot/${coinId}`);
  return data;
};

export default api;
