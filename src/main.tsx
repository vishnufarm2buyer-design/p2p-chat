import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for seamless background caching & automatic updates
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Auto-updating service worker to latest deployment...');
  },
  onOfflineReady() {
    console.log('[PWA] Application shell ready for offline use.');
  }
});

// Auto-recover if an outdated cached chunk hash is requested after a new Vercel deployment
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[PWA] Outdated chunk requested after deployment, auto-refreshing...', event);
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
