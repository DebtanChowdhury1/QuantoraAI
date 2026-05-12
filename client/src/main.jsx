import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { CurrencyProvider } from './context/CurrencyContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import './index.css';
import { ClerkProvider, clerkPublishableKey, isAuthEnabled } from './lib/authClient.jsx';

if (!isAuthEnabled) {
  console.warn('Clerk disabled: set VITE_CLERK_PUBLISHABLE_KEY to enable authentication.');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: 'always',
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <CurrencyProvider>
              <NotificationProvider>
                <ScrollToTop />
                <App />
              </NotificationProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
);
