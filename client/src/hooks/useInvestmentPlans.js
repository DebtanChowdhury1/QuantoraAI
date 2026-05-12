import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInvestmentPlan,
  deleteInvestmentPlan,
  fetchInvestmentPlans,
  migrateInvestmentPlans,
  updateInvestmentPlan,
} from '@/lib/api';
import { MARKET_REFRESH_MS } from '@/lib/refreshIntervals';
import { useUser } from '@/lib/authClient';

const getSessionId = () => {
  const key = 'quantora-investment-session';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next =
    window.crypto?.randomUUID?.() || `quantora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
};

const getUserEmail = (user) =>
  user?.primaryEmailAddress?.emailAddress ||
  user?.emailAddresses?.[0]?.emailAddress ||
  user?.externalAccounts?.[0]?.emailAddress ||
  '';

const accountSessionId = (email) => `account:${String(email || '').trim().toLowerCase()}`;

const useInvestmentPlans = () => {
  const { isSignedIn, user } = useUser();
  const queryClient = useQueryClient();
  const migrationStartedRef = useRef(new Set());
  const legacySessionId = useMemo(getSessionId, []);
  const email = useMemo(() => getUserEmail(user), [user]);
  const oldClerkSessionId = useMemo(
    () => (user?.id ? `user:${user.id}` : ''),
    [user?.id]
  );
  const sessionId = useMemo(
    () => (isSignedIn && email ? accountSessionId(email) : legacySessionId),
    [email, isSignedIn, legacySessionId]
  );
  const queryKey = ['investment-plans', sessionId];

  const plansQuery = useQuery({
    queryKey,
    queryFn: () => fetchInvestmentPlans(sessionId),
    refetchInterval: MARKET_REFRESH_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    placeholderData: (previousData) => previousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const sources = Array.from(new Set([legacySessionId, oldClerkSessionId].filter(Boolean)));
      return migrateInvestmentPlans({
        fromSessionIds: sources.filter((fromSessionId) => fromSessionId !== sessionId),
        toSessionId: sessionId,
      });
    },
    onSuccess: () => {
      invalidate();
    },
  });

  useEffect(() => {
    if (!isSignedIn || !email || legacySessionId === sessionId) return;
    const migrationKey = `${sessionId}:${legacySessionId}:${oldClerkSessionId}`;
    if (migrationStartedRef.current.has(migrationKey)) return;
    migrationStartedRef.current.add(migrationKey);
    migrateMutation.mutate();
  }, [email, isSignedIn, legacySessionId, oldClerkSessionId, migrateMutation, sessionId]);

  const createMutation = useMutation({
    mutationFn: (payload) => createInvestmentPlan({ ...payload, sessionId }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => updateInvestmentPlan({ id, ...payload, sessionId }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteInvestmentPlan({ id, sessionId }),
    onSuccess: invalidate,
  });

  return {
    sessionId,
    plans: plansQuery.data?.data || [],
    plansQuery,
    createPlan: createMutation.mutateAsync,
    updatePlan: updateMutation.mutateAsync,
    deletePlan: deleteMutation.mutateAsync,
    saving:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
    migrating: migrateMutation.isPending,
  };
};

export default useInvestmentPlans;
