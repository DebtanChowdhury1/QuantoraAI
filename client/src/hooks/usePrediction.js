import { useQuery } from '@tanstack/react-query';
import { fetchPrediction, fetchPredictionHistory, fetchCoinHistory, fetchSnapshot } from '@/lib/api';

export const usePrediction = (coinId) => {
  const predictionQuery = useQuery({
    queryKey: ['prediction', coinId],
    queryFn: async () => {
      const response = await fetchPrediction(coinId);
      return response;
    },
    enabled: Boolean(coinId),
    refetchInterval: 10 * 60 * 1000,
  });

  const historyQuery = useQuery({
    queryKey: ['predictionHistory', coinId],
    queryFn: async () => {
      const response = await fetchPredictionHistory(coinId, 50);
      return response;
    },
    enabled: Boolean(coinId),
  });

  const chartQuery = useQuery({
    queryKey: ['coinHistory', coinId],
    queryFn: async () => {
      const response = await fetchCoinHistory(coinId, '7');
      return response;
    },
    enabled: Boolean(coinId),
  });

  const snapshotQuery = useQuery({
    queryKey: ['coinSnapshot', coinId],
    queryFn: async () => {
      const response = await fetchSnapshot(coinId);
      return response;
    },
    enabled: Boolean(coinId),
    staleTime: 5 * 60 * 1000,
  });

  return {
     prediction: predictionQuery.data?.data,
     predictionMeta: predictionQuery.data?.meta,
     history: historyQuery.data?.data,
     historyMeta: historyQuery.data?.meta,
     chart: chartQuery.data?.data,
     chartFallback: Boolean(chartQuery.data?.fallback),
     chartSource: chartQuery.data?.data?.source || 'CoinGecko',
     snapshot: snapshotQuery.data?.data,
     snapshotFallback: Boolean(snapshotQuery.data?.fallback),
     snapshotSource: snapshotQuery.data?.data?.source || 'CoinGecko',
     predictionQuery,
     historyQuery,
     chartQuery,
     snapshotQuery,
   };
};

export default usePrediction;
