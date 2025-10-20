import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAlertPreferences, fetchAlertHistory, updateAlertPreferences } from '@/lib/api';

export const useAlertPreferences = (identity) => {
  const queryClient = useQueryClient();
  const enabled = Boolean(identity?.clerkId && identity?.email);

  const preferencesQuery = useQuery({
    queryKey: ['alertPreferences', identity?.clerkId],
    queryFn: async () => {
      const response = await fetchAlertPreferences(identity);
      return {
        data: response.data?.data || [],
        meta: response.data?.meta || {},
      };
    },
    enabled,
  });

  const historyQuery = useQuery({
    queryKey: ['alertHistory'],
    queryFn: async () => {
      const response = await fetchAlertHistory({ limit: 100 });
      return response.data?.data || [];
    },
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
