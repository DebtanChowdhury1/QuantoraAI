import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CoinTable from '@/components/CoinTable';
import Loader from '@/components/Loader';
import ErrorState from '@/components/ErrorState';
import StatCards from '@/components/StatCards';
import AccuracyCard from '@/components/AccuracyCard';
import MarketControls from '@/components/MarketControls';
import MarketMovers from '@/components/MarketMovers';
import CurrencyRatesStrip from '@/components/CurrencyRatesStrip';
import useMarkets from '@/hooks/useMarkets';
import { searchCoins } from '@/lib/api';
import { SignedOut, SignInButton } from '@/lib/authClient';

const Dashboard = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const {
    markets,
    marketMeta,
    fallbackUsed,
    isLoading,
    isError,
    marketsQuery,
    predictionsQuery,
    predictionError,
  } = useMarkets();
  const errorMessage = marketsQuery.error?.message || "Unable to load markets. Please retry.";
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchCoins(trimmed);
        if (!cancelled) {
          setSearchResults(response.data?.coins || response.data || []);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return markets.filter((coin) => {
      const matchesQuery =
        !normalizedQuery ||
        coin.name?.toLowerCase().includes(normalizedQuery) ||
        coin.symbol?.toLowerCase().includes(normalizedQuery) ||
        coin.id?.toLowerCase().includes(normalizedQuery);
      const matchesAction = actionFilter === 'ALL' || coin.aiAction === actionFilter;
      const matchesRisk = riskFilter === 'ALL' || coin.aiRiskLevel === riskFilter;
      return matchesQuery && matchesAction && matchesRisk;
    });
  }, [markets, query, actionFilter, riskFilter]);

  const handleSelectCoin = (coinId) => {
    if (!coinId) return;
    setSearchResults([]);
    navigate(`/coin/${coinId}`);
  };

  const handleResetFilters = () => {
    setQuery('');
    setActionFilter('ALL');
    setRiskFilter('ALL');
    setSearchResults([]);
  };

  if (isLoading) {
    return <Loader label="Loading market data" />;
  }

  if (isError && !markets.length) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => {
          marketsQuery.refetch();
          predictionsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section
        className="rounded-2xl border border-neutral-600/30 bg-neutral-900/70 p-6 shadow-glow backdrop-blur"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-neutral-100">Market Dashboard</h1>
            <p className="text-sm text-neutral-400">
              Real-time market data blended with structured Quantora AI signals.
            </p>
            {fallbackUsed && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gold">
                Provider fallback active. Cached and secondary market feeds are protecting uptime.
              </p>
            )}
          </div>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-background"
              >
                Sign in to manage alerts
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </section>

      <StatCards markets={markets} meta={marketMeta} />
      <CurrencyRatesStrip />
      <MarketMovers markets={markets} />
      <AccuracyCard predictions={predictionsQuery.data?.data || []} />

      <MarketControls
        query={query}
        onQueryChange={setQuery}
        actionFilter={actionFilter}
        onActionFilterChange={setActionFilter}
        riskFilter={riskFilter}
        onRiskFilterChange={setRiskFilter}
        searchResults={searchResults}
        searching={searching}
        onSelectCoin={handleSelectCoin}
      />

      
      {predictionError && (
        <p className="text-xs text-red-400">AI signals temporarily unavailable: {predictionError.message}</p>
      )}

      <CoinTable
        markets={filteredMarkets}
        totalMarkets={markets.length}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};

export default Dashboard;
