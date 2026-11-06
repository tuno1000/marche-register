import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('画面の切り替え', () => {
  it('起動時は会計画面で、下のタブが 4 つある', () => {
    renderAt('/');
    // 会計画面のヘッダーには、現在のイベント（まだ選んでいない）を表示する
    expect(screen.getByRole('heading', { name: /イベント未選択/ })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'メイン' });
    expect(nav.querySelectorAll('a')).toHaveLength(4);
  });

  it('タブで画面を切り替えられる', async () => {
    const user = userEvent.setup();
    const router = renderAt('/');
    await user.click(screen.getByRole('link', { name: '履歴' }));
    expect(router.state.location.pathname).toBe('/history');
    await user.click(screen.getByRole('link', { name: 'その他' }));
    expect(screen.getByRole('heading', { name: 'その他' })).toBeInTheDocument();
  });

  it('全画面の画面ではタブを隠し、戻るで前の画面に戻る', async () => {
    const user = userEvent.setup();
    const router = renderAt('/more');
    await user.click(screen.getByRole('link', { name: /設定/ }));
    expect(screen.queryByRole('navigation', { name: 'メイン' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '◀ 戻る' }));
    expect(router.state.location.pathname).toBe('/more');
  });

  it('URL を直接開いた全画面の画面で戻ると、決められた画面へ移る', async () => {
    const user = userEvent.setup();
    const router = renderAt('/settings');
    await user.click(screen.getByRole('button', { name: '◀ 戻る' }));
    expect(router.state.location.pathname).toBe('/more');
  });

  it('知らない URL は会計画面へ移る', () => {
    const router = renderAt('/no-such-page');
    expect(router.state.location.pathname).toBe('/');
  });
});
