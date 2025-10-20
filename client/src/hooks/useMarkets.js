import { useQuery } from '@tanstack/react-query';
import { fetchMarkets, fetchPredictions } from '@/lib/api';

const combineMarketsWithPredictions = (markets = [], predictions = []) => {
  const byCoin = new Map(
    predictions.map((item) => [item.coinId, item])
  );
  return markets.map((market) => {
    const ai = byCoin.get(market.id);
    return {
      ...market,
      aiAction: ai?.action || 'HOLD',
      aiConfidence: ai?.confidence || 0,
      aiReason: ai?.reason || 'Awaiting prediction',
      aiUpdatedAt: ai?.createdAt,
    };
  });
};

export const useMarkets = () => {
  const marketsQuery = useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const response = await fetchMarkets();
      return response;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const predictionsQuery = useQuery({
    queryKey: ['predictions'],
    queryFn: async () => {
      const response = await fetchPredictions();
      return response;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const combined = combineMarketsWithPredictions(
    marketsQuery.data?.data || [],
    predictionsQuery.data?.data || []
  );

  return {
    markets: combined,
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
