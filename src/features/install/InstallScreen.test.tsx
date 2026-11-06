import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startUpdateChecks, usePwaStore, type BeforeInstallPromptEvent } from '../../app/pwaStore';
import { getKv, setCurrentEventId, setKv } from '../../db/kv';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { useCartStore } from '../checkout/cartStore';

const realUserAgent = navigator.userAgent;

function setDevice({ standalone, userAgent }: { standalone: boolean; userAgent?: string }) {
  Object.defineProperty(navigator, 'standalone', { value: standalone, configurable: true });
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent ?? realUserAgent,
    configurable: true,
  });
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

beforeEach(resetDb);
afterEach(() => {
  setDevice({ standalone: true });
  usePwaStore.setState({ applyUpdate: null, installPrompt: null, installed: false });
});

describe('S-08 インストール案内', () => {
  it('ホーム画面から起動していなければ、起動時に案内を出す（iPhone は共有ボタンの手順）', async () => {
    setDevice({ standalone: false, userAgent: IPHONE });
    const { path } = renderApp('/');
    await waitFor(() => expect(path()).toBe('/install'));
    expect(
      screen.getByRole('heading', { name: 'ホーム画面に追加して使ってください' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'iPhone での手順' })).toHaveTextContent('共有');
    expect(screen.getByText(/データが別になります/)).toBeInTheDocument();
  });

  it('ホーム画面から起動していれば、案内を出さない', async () => {
    setDevice({ standalone: true, userAgent: IPHONE });
    const { path } = renderApp('/');
    expect(await screen.findByRole('heading', { name: /イベント未選択/ })).toBeInTheDocument();
    expect(path()).toBe('/');
  });

  it('［このまま使う］で会計画面へ進み、次からは案内を出さず「ブラウザで開いています」と出す', async () => {
    setDevice({ standalone: false, userAgent: IPHONE });
    const { user, path } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'このまま使う' }));
    await waitFor(() => expect(path()).toBe('/'));
    expect(await getKv('installWarningDismissed')).toBe(true);
    expect(await screen.findByText('ブラウザで開いています')).toBeInTheDocument();
  });

  it('次に開いたときは、案内を出さない', async () => {
    setDevice({ standalone: false, userAgent: IPHONE });
    await setKv('installWarningDismissed', true);
    const { path } = renderApp('/');
    expect(await screen.findByText('ブラウザで開いています')).toBeInTheDocument();
    expect(path()).toBe('/');
  });

  it('Android でインストールの案内が使えれば、［インストール］ボタンを大きく出す', async () => {
    setDevice({ standalone: false, userAgent: ANDROID });
    const prompt = vi.fn(async () => {});
    usePwaStore.setState({
      installPrompt: {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      } as unknown as BeforeInstallPromptEvent,
    });
    const { user } = renderApp('/install');
    await user.click(await screen.findByRole('button', { name: 'インストール' }));
    expect(prompt).toHaveBeenCalled();
    expect(await screen.findByText(/ホーム画面に追加しました/)).toBeInTheDocument();
  });

  it('Android でインストールの案内が使えなければ、メニューからの手順を出す', async () => {
    setDevice({ standalone: false, userAgent: ANDROID });
    renderApp('/install');
    expect(await screen.findByRole('list', { name: 'Android での手順' })).toHaveTextContent(
      'ホーム画面に追加',
    );
  });
});

describe('更新のお知らせ', () => {
  async function setup() {
    const { event, cookie } = await seedBasic();
    await setCurrentEventId(event.id);
    const applyUpdate = vi.fn(async () => {});
    usePwaStore.setState({ applyUpdate });
    return { event, cookie, applyUpdate };
  }

  it('新しい版があれば出し、［更新］で切り替える', async () => {
    const { applyUpdate } = await setup();
    const { user } = renderApp('/');
    expect(await screen.findByText('新しいバージョンがあります')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '更新' }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('カートに商品が入っている間と、お預かり画面では出さない', async () => {
    const { event, cookie } = await setup();
    useCartStore.getState().add(event.id, cookie.id);
    useCartStore.setState({ loaded: true });
    renderApp('/');
    await screen.findByRole('tab', { name: '焼き菓子' });
    expect(screen.queryByText('新しいバージョンがあります')).not.toBeInTheDocument();

    renderApp('/', '/tender');
    await screen.findAllByText('¥300');
    expect(screen.queryByText('新しいバージョンがあります')).not.toBeInTheDocument();
  });

  it('更新の確認は、アプリに戻ってきたときに 1 時間に 1 回まで', () => {
    let now = 0;
    const update = vi.fn(async () => {});
    const stop = startUpdateChecks({ update }, () => now);
    const comeBack = () => document.dispatchEvent(new Event('visibilitychange'));

    now = 30 * 60 * 1000;
    comeBack();
    expect(update).not.toHaveBeenCalled();
    now = 61 * 60 * 1000;
    comeBack();
    expect(update).toHaveBeenCalledTimes(1);
    now = 90 * 60 * 1000;
    comeBack();
    expect(update).toHaveBeenCalledTimes(1);
    stop();
  });
});
