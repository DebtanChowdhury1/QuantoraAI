import { useQuery } from '@tanstack/react-query';
import { fetchPrediction, fetchPredictionHistory, fetchCoinHistory, fetchSnapshot } from '@/lib/api';
import {
  CHART_REFRESH_MS,
  HISTORY_REFRESH_MS,
  LIVE_PRICE_REFRESH_MS,
  SIGNAL_REFRESH_MS,
} from '@/lib/refreshIntervals';

export const usePrediction = (coinId) => {
  const predictionQuery = useQuery({
    queryKey: ['prediction', coinId],
    queryFn: async () => {
      const response = await fetchPrediction(coinId, { force: true });
      return response;
    },
    enabled: Boolean(coinId),
    refetchInterval: SIGNAL_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
  });

  const historyQuery = useQuery({
    queryKey: ['predictionHistory', coinId],
    queryFn: async () => {
      const response = await fetchPredictionHistory(coinId, 50);
      return response;
    },
    enabled: Boolean(coinId),
    refetchInterval: HISTORY_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
  });

  const chartQuery = useQuery({
    queryKey: ['coinHistory', coinId],
    queryFn: async () => {
      const response = await fetchCoinHistory(coinId, '7');
      return response;
    },
    enabled: Boolean(coinId),
    refetchInterval: CHART_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
  });

  const snapshotQuery = useQuery({
    queryKey: ['coinSnapshot', coinId],
    queryFn: async () => {
      const response = await fetchSnapshot(coinId);
      return response;
    },
    enabled: Boolean(coinId),
    refetchInterval: LIVE_PRICE_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
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
