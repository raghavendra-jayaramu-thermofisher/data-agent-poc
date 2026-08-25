import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AppProviders } from './app/providers';
import { ErrorBoundary } from './app/ErrorBoundary';
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><AppProviders><App /></AppProviders></ErrorBoundary></StrictMode>);
