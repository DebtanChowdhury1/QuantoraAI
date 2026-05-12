import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import useChatSession from '@/hooks/useChatSession';

const quickPrompts = [
  'Give me the honest read right now.',
  'What would make this a better entry?',
  'I already bought. What should I watch?',
];

const threadTitle = (thread) => {
  const firstUser = thread.messages?.find((message) => message.role === 'user');
  if (firstUser?.content) return firstUser.content.slice(0, 54);
  return thread.title || 'New conversation';
};

const formatTime = (value) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value || Date.now()));

const ChatPanel = ({ scope, coinId, title, subtitle, expert = false }) => {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const {
    threadId,
    threads,
    chatQuery,
    selectThread,
    createThread,
    sendMessage,
    sending,
    clearChat,
    clearing,
    deleteThread,
    deletingThread,
    deleteMessage,
    deletingMessage,
  } = useChatSession({ scope, coinId });
  const messages = chatQuery.data?.data?.messages || [];

  useEffect(() => {
    const messageList = messagesRef.current;
    if (!messageList) return;
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  const submit = async (message = draft) => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setDraft('');
    await sendMessage(trimmed);
  };

  if (chatQuery.isLoading) return <Loader label="Loading Quantora chat" />;
  if (chatQuery.isError) {
    return (
      <ErrorState
        message={chatQuery.error?.message || 'Unable to load Quantora chat'}
        onRetry={() => chatQuery.refetch()}
      />
    );
  }

  return (
    <section
      className={clsx(
        'overflow-hidden rounded-2xl border border-neutral-600/30 bg-neutral-900/80 shadow-glow backdrop-blur',
        expert && 'min-h-[700px]'
      )}
    >
      <div className="grid min-h-[620px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-neutral-700/60 bg-neutral-950/70 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Conversations</p>
            <button
              type="button"
              onClick={createThread}
              className="rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
            >
              New chat
            </button>
          </div>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
            {threads.map((thread) => (
              <div key={thread.threadId} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectThread(thread.threadId)}
                  className={clsx(
                    'min-w-0 flex-1 rounded-xl border px-3 py-2 text-left text-xs transition',
                    thread.threadId === threadId
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                  )}
                >
                  <span className="block truncate font-semibold">{threadTitle(thread)}</span>
                  <span className="mt-1 block text-[10px] text-neutral-500">
                    {new Date(thread.updatedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteThread(thread.threadId)}
                  disabled={deletingThread}
                  className="rounded-full border border-red-400/30 px-2 py-1 text-[10px] font-semibold text-red-300 opacity-80 transition hover:bg-red-500/10"
                  title="Delete this conversation"
                >
                  Del
                </button>
              </div>
            ))}
            {!threads.length && (
              <p className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-4 text-xs text-neutral-500">
                No saved conversations yet.
              </p>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-neutral-700/60 bg-neutral-950/60 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-accent">Live Market Conversation</p>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-50">{title}</h2>
                <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => clearChat()}
                disabled={clearing}
                className="self-start rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                Clear current thread
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submit(prompt)}
                  className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-accent/50 hover:text-accent"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={messagesRef}
            className={clsx('space-y-5 overflow-y-auto p-5', expert ? 'h-[520px]' : 'max-h-[560px]')}
          >
            {messages.map((message) => (
              <div
                key={message._id || `${message.role}-${message.createdAt}`}
                className={clsx('group flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {message.role !== 'user' && (
                  <div className="mt-6 flex h-8 w-8 flex-none items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-xs font-bold text-accent">
                    Q
                  </div>
                )}
                <div className={clsx('max-w-[78%]', message.role === 'user' && 'order-1')}>
                  <div
                    className={clsx(
                      'mb-1 flex items-center gap-2 text-[11px]',
                      message.role === 'user' ? 'justify-end text-accent/80' : 'text-neutral-500'
                    )}
                  >
                    <span>{message.role === 'user' ? 'You' : 'Quantora Expert'}</span>
                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                <div
                  className={clsx(
                    'whitespace-pre-line rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-lg',
                    message.role === 'user'
                      ? 'rounded-tr-md border-accent/40 bg-accent/20 text-accent'
                      : 'rounded-tl-md border-neutral-700 bg-neutral-950/90 text-neutral-100'
                  )}
                >
                  {message.content}
                </div>
                </div>
                {message._id && (
                  <button
                    type="button"
                    disabled={deletingMessage}
                    onClick={() => deleteMessage(message._id)}
                    className={clsx(
                      'mt-6 self-start rounded-full border border-neutral-700 px-2 py-1 text-[10px] text-neutral-500 opacity-0 transition hover:border-red-400/50 hover:text-red-300 group-hover:opacity-100',
                      message.role === 'user' && 'order-0'
                    )}
                    title="Delete this message"
                  >
                    Del
                  </button>
                )}
              </div>
            ))}
            {sending && (
              <div className="inline-flex items-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm text-neutral-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent shadow-glow" />
                Reading the live market context and your thread...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="border-t border-neutral-700/60 bg-neutral-950/60 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask naturally: I bought at 80k, should I hold? What price would confirm a better entry?"
                className="min-h-14 flex-1 resize-none rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ask
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              This platform provides AI-generated market insights and not financial advice.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ChatPanel;
