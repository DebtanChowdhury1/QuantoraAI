import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlertPreferences, fetchAlertHistory, updateAlertPreferences } from '@/lib/api';
import { ALERT_REFRESH_MS } from '@/lib/refreshIntervals';

export const useAlertPreferences = (identity) => {
  const queryClient = useQueryClient();
  const enabled = Boolean(identity?.clerkId && identity?.email);

  const preferencesQuery = useQuery({
    queryKey: ['alertPreferences', identity?.clerkId],
    queryFn: async () => {
      const response = await fetchAlertPreferences(identity);
      return {
        data: response.data || [],
        meta: response.meta || {},
      };
    },
    enabled,
    refetchInterval: ALERT_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const historyQuery = useQuery({
    queryKey: ['alertHistory'],
    queryFn: async () => {
      const response = await fetchAlertHistory({ limit: 100 });
      return response.data || [];
    },
    refetchInterval: ALERT_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: (preferences) => updateAlertPreferences({ ...identity, preferences }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertPreferences', identity?.clerkId] });
    },
  });

  return {
    preferencesQuery,
    historyQuery,
    updatePreferences: mutation.mutateAsync,
    updating: mutation.isPending,
  };
};

export default useAlertPreferences;
