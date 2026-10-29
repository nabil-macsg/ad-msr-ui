import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import { App } from './app/App';
import { installMockApi } from './mock/install';
import { applyTheme, loadChoice } from './app/theme/theme-choice';

// Demo build: every API call is answered in the browser from src/mock; no backend is used.
installMockApi();
// The saved theme is applied before the first paint, so the page never flashes another theme.
applyTheme(loadChoice());

const root = document.getElementById('root');
if (!root) throw new Error('The page has no #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
