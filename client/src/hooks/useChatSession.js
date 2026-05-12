import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearChat,
  deleteChatMessage,
  deleteChatThread,
  fetchChat,
  fetchChatThreads,
  sendChat,
} from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/lib/authClient';

const getSessionId = () => {
  const key = 'quantora_chat_session_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next =
    window.crypto?.randomUUID?.() ||
    `quantora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
};

const getPortfolioSessionId = () => {
  const key = 'quantora-investment-session';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next =
    window.crypto?.randomUUID?.() ||
    `quantora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
};

const getUserEmail = (user) =>
  user?.primaryEmailAddress?.emailAddress ||
  user?.emailAddresses?.[0]?.emailAddress ||
  user?.externalAccounts?.[0]?.emailAddress ||
  '';

const accountSessionId = (email) => `account:${String(email || '').trim().toLowerCase()}`;

const newThreadId = () =>
  window.crypto?.randomUUID?.() || `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const useChatSession = ({ scope, coinId }) => {
  const queryClient = useQueryClient();
  const { currency, rate } = useCurrency();
  const { isSignedIn, user } = useUser();
  const email = useMemo(() => getUserEmail(user), [user]);
  const sessionId = useMemo(() => getSessionId(), []);
  const portfolioSessionId = useMemo(
    () => (isSignedIn && email ? accountSessionId(email) : getPortfolioSessionId()),
    [email, isSignedIn]
  );
  const storageKey = `quantora_active_thread:${scope}:${coinId || 'global'}`;
  const [threadId, setThreadId] = useState(() => {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;
    const next = newThreadId();
    window.localStorage.setItem(storageKey, next);
    return next;
  });

  const threadsKey = ['chatThreads', sessionId, scope, coinId || 'global', currency];
  const queryKey = ['chat', sessionId, threadId, scope, coinId || 'global', currency];

  const threadsQuery = useQuery({
    queryKey: threadsKey,
    queryFn: () =>
      fetchChatThreads({
        sessionId,
        portfolioSessionId,
        displayCurrency: currency,
        fxRate: rate,
        scope,
        coinId,
      }),
    enabled: Boolean(scope && (scope === 'expert' || coinId)),
    staleTime: 5 * 1000,
  });

  const chatQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchChat({
        sessionId,
        portfolioSessionId,
        displayCurrency: currency,
        fxRate: rate,
        threadId,
        scope,
        coinId,
      }),
    enabled: Boolean(scope && threadId && (scope === 'expert' || coinId)),
    staleTime: 5 * 1000,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });

  const selectThread = (nextThreadId) => {
    setThreadId(nextThreadId);
    window.localStorage.setItem(storageKey, nextThreadId);
  };

  const createThread = () => {
    selectThread(newThreadId());
  };

  const sendMutation = useMutation({
    mutationFn: (message) =>
      sendChat({
        sessionId,
        portfolioSessionId,
        displayCurrency: currency,
        fxRate: rate,
        threadId,
        scope,
        coinId,
        message,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
      queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      clearChat({
        sessionId,
        portfolioSessionId,
        displayCurrency: currency,
        fxRate: rate,
        threadId,
        scope,
        coinId,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
      queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: (targetThreadId = threadId) =>
      deleteChatThread({ sessionId, threadId: targetThreadId, scope, coinId }),
    onSuccess: (_response, targetThreadId = threadId) => {
      queryClient.removeQueries({ queryKey: ['chat', sessionId, targetThreadId, scope, coinId || 'global'] });
      queryClient.invalidateQueries({ queryKey: threadsKey });
      if (targetThreadId === threadId) createThread();
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) =>
      deleteChatMessage({ sessionId, threadId, scope, coinId, messageId }),
    onSuccess: (response) => {
      queryClient.setQueryData(queryKey, response);
      queryClient.invalidateQueries({ queryKey: threadsKey });
    },
  });

  return {
    sessionId,
    threadId,
    threads: threadsQuery.data?.data || [],
    threadsQuery,
    chatQuery,
    selectThread,
    createThread,
    sendMessage: sendMutation.mutateAsync,
    sending: sendMutation.isPending,
    clearChat: clearMutation.mutateAsync,
    clearing: clearMutation.isPending,
    deleteThread: deleteThreadMutation.mutateAsync,
    deletingThread: deleteThreadMutation.isPending,
    deleteMessage: deleteMessageMutation.mutateAsync,
    deletingMessage: deleteMessageMutation.isPending,
  };
};

export default useChatSession;
