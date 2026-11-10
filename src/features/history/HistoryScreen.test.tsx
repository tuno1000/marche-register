import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentEventId } from '../../db/kv';
import { createEvent, soldQtyByProduct } from '../../db/repositories/events';
import { checkout, voidTransaction } from '../../db/repositories/transactions';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(resetDb);

/** クッキー ×1（¥300）、クッキー ×2 ＋ マフィン ×1（¥1,050）の 2 件 */
async function setup() {
  const seed = await seedBasic();
  await setCurrentEventId(seed.event.id);
  const sale = (lines: [string, number][]) =>
    checkout({
      eventId: seed.event.id,
      lines: lines.map(([productId, qty]) => ({ productId, qty, discount: null })),
      orderDiscount: null,
      tendered: 5000,
    });
  const tx1 = await sale([[seed.cookie.id, 1]]);
  const tx2 = await sale([
    [seed.cookie.id, 2],
    [seed.muffin.id, 1],
  ]);
  return { ...seed, tx1, tx2 };
}

describe('S-03 取引履歴', () => {
  it('現在のイベントの取引を新しい順に、番号・点数・合計で並べる。取消には印を付ける', async () => {
    const { tx1 } = await setup();
    await voidTransaction(tx1.id);
    renderApp('/history');
    const rows = await screen.findAllByRole('link', { name: /1103-/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^1103-002.*3点¥1,050$/),
      expect.stringMatching(/^1103-001.*1点¥300取消$/),
    ]);
  });

  it('ほかのイベントに切り替えて見られる。現在のイベントは変わらない', async () => {
    const { event } = await setup();
    await createEvent({ name: '別のマルシェ', date: '2026-12-01', location: '', memo: '' });
    const { user } = renderApp('/history');
    await screen.findAllByRole('link', { name: /1103-/ });
    await user.click(screen.getByRole('button', { name: /表示するイベント：○○マルシェ/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /別のマルシェ/ }),
    );
    expect(await screen.findByText('まだ取引がありません。')).toBeInTheDocument();
    expect((await db.kv.get('currentEventId'))?.value).toBe(event.id);
  });

  it('イベントがなければ、その旨を出す', async () => {
    renderApp('/history');
    expect(await screen.findByText('イベントがまだありません。')).toBeInTheDocument();
  });
});

describe('S-03a 取引詳細', () => {
  it('レシートを表示し、確認してから取り消すと在庫が戻り、履歴に戻る', async () => {
    const { tx2, event, cookie } = await setup();
    const { user, path } = renderApp('/history', `/history/${tx2.id}`);
    expect(await screen.findByRole('article', { name: 'レシート' })).toHaveTextContent(
      'No. 1103-002',
    );
    await user.click(screen.getByRole('button', { name: 'この取引を取り消す' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      '取引 1103-002（¥1,050）を取り消します。在庫は戻ります。元に戻せません。',
    );
    await user.click(within(dialog).getByRole('button', { name: '取り消す' }));
    await waitFor(() => expect(path()).toBe('/history'));
    expect((await db.transactions.get(tx2.id))?.status).toBe('voided');
    expect((await soldQtyByProduct(event.id)).get(cookie.id)).toBe(1);
  });

  it('取り消した取引には「取消」の印を出し、［取消］ボタンは出さない', async () => {
    const { tx1 } = await setup();
    await voidTransaction(tx1.id);
    renderApp(`/history/${tx1.id}`);
    expect(await screen.findByLabelText('取消')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'この取引を取り消す' })).not.toBeInTheDocument();
  });

  it('［印刷］でブラウザの印刷を開く（取り消した取引も印刷できる）。印刷するのはレシートだけ', async () => {
    const { tx1 } = await setup();
    await voidTransaction(tx1.id);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user } = renderApp(`/history/${tx1.id}`);
    const receipt = await screen.findByRole('article', { name: 'レシート' });
    expect(receipt).toHaveAttribute('data-print-area');
    await user.click(screen.getByRole('button', { name: '印刷' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
