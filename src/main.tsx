import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { listenInstallEvents, startUpdateChecks, usePwaStore } from './app/pwaStore';
import './styles/global.css';

listenInstallEvents();

// Service Worker を登録して、オフラインで起動できるようにする。
// 新しい版があっても自動では切り替えず、［更新］を押してもらう（04-技術設計 5.3）
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    usePwaStore.setState({ applyUpdate: () => updateSW(true) });
  },
  onRegisteredSW(_url, registration) {
    if (registration) startUpdateChecks(registration);
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root がありません');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
