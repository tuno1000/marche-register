// IndexedDB の代わり（テスト用）。Dexie より先に読み込む
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { hideToast } from '../components/Toast';

afterEach(() => {
  cleanup();
  hideToast();
});

// jsdom には画像の表示用 URL を作る関数がないので、代わりを用意する
if (!URL.createObjectURL) {
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => {};
}
