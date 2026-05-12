import ChatPanel from '@/components/ChatPanel';

const CoinExpert = () => (
  <div className="space-y-8">
    <section className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">AI Coin Expert</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-100">Ask Quantora</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">
            A market-aware AI expert that reads tracked coin prices, volatility, signal history,
            confidence, and trend state before answering.
          </p>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          Live market context loaded
        </div>
      </div>
    </section>

    <ChatPanel
      scope="expert"
      title="Quantora Market Desk"
      subtitle="Ask what looks strongest, compare coins, plan watchlists, or get risk-aware guidance from all tracked market data."
      expert
    />
  </div>
);

export default CoinExpert;
