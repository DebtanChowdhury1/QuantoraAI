import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[Quantora AI] UI boundary captured error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-red-100">
          <p className="font-semibold">Quantora AI could not render this view.</p>
          <p className="mt-2 text-sm text-red-200">
            Refresh the page or retry after the market data stream reconnects.
          </p>
          <button
            type="button"
            className="mt-4 rounded-full border border-red-300/50 px-4 py-2 text-xs font-semibold"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry view
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
