const ErrorState = ({ message = 'Something went wrong', onRetry }) => (
  <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-neutral-100">
    <p>{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-neutral-100/20 bg-neutral-100/10 px-4 py-2 text-xs uppercase tracking-wide text-neutral-100 transition hover:border-neutral-100/40"
      >
        Retry
      </button>
    )}
  </div>
);

export default ErrorState;
