import { useQuery } from '@tanstack/react-query';
import { fetchMarkets, fetchPredictions } from '@/lib/api';
import { MARKET_REFRESH_MS, SIGNAL_REFRESH_MS } from '@/lib/refreshIntervals';

const MARKET_CACHE_KEY = 'quantora-last-market-snapshot';

const readCachedMarkets = () => {
  try {
    const cached = JSON.parse(window.localStorage.getItem(MARKET_CACHE_KEY) || 'null');
    return cached?.data?.length ? cached : undefined;
  } catch {
    return undefined;
  }
};

const writeCachedMarkets = (payload) => {
  if (!payload?.data?.length) return;
  window.localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(payload));
};

const combineMarketsWithPredictions = (markets = [], predictions = []) => {
  const byCoin = new Map();
  predictions.forEach((item) => {
    if (!byCoin.has(item.coinId)) {
      byCoin.set(item.coinId, item);
    }
  });
  return markets.map((market) => {
    const ai = byCoin.get(market.id);
    return {
      ...market,
      aiAction: ai?.action || 'HOLD',
      aiConfidence: ai?.confidence || 0,
      aiReason: ai?.reason || 'Awaiting prediction',
      aiRiskLevel: ai?.riskLevel || 'MEDIUM',
      aiTrendDirection: ai?.trendDirection || 'SIDEWAYS',
      aiPredictionHorizon: ai?.predictionHorizon || '24-72H',
      aiProviderStatus: ai?.providerStatus || 'PENDING',
      aiUpdatedAt: ai?.createdAt,
    };
  });
};

export const useMarkets = () => {
  const marketsQuery = useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const response = await fetchMarkets();
      writeCachedMarkets(response);
      return response;
    },
    refetchInterval: MARKET_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
    initialData: readCachedMarkets,
  });

  const predictionsQuery = useQuery({
    queryKey: ['predictions'],
    queryFn: async () => {
      const response = await fetchPredictions();
      return response;
    },
    refetchInterval: SIGNAL_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
  });

  const combined = combineMarketsWithPredictions(
    marketsQuery.data?.data || [],
    predictionsQuery.data?.data || []
  );

  return {
    markets: combined,
    marketMeta: marketsQuery.data?.meta || {},
    fallbackUsed: marketsQuery.data?.fallback ?? false,
    trackedCoins: marketsQuery.data?.coins || [],
    marketsQuery,
    predictionsQuery,
    isLoading: marketsQuery.isLoading,
    isError: marketsQuery.isError,
    predictionError: predictionsQuery.isError ? predictionsQuery.error : null,
  };
};

export default useMarkets;
