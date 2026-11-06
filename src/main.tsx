import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './styles/global.css';

// Service Worker を登録して、オフラインで起動できるようにする。
// 新しい版があっても自動では切り替えない（更新のお知らせは M6 で作る）。
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('#root がありません');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
