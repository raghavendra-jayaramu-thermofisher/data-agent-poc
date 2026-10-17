import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './analytics/components/artifact-ui.css';
import './layouts/app-shell.css';
import App from './App';
import { AppProviders } from './app/providers';
import { ErrorBoundary } from './app/ErrorBoundary';
import { applyDesignTokens } from './theme/tokens';
applyDesignTokens(document.documentElement);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
