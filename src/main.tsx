import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for App Shell Asset Caching
// Note: Private conversations and communication data are strictly NEVER cached in SW.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version of Shield P2P is available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('P2P Shield Chat is ready for offline app shell execution.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
