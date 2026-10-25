import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const Anuncie = lazy(() => import('./pages/Anuncie.tsx'));
const path = window.location.pathname.replace(/\/+$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/anuncie' ? (
      <Suspense fallback={null}>
        <Anuncie />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
