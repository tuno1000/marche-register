import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getCurrentEventId } from '../../db/kv';
import { listEventStocks, listEvents } from '../../db/repositories/events';
import { checkout } from '../../db/repositories/transactions';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(resetDb);

describe('S-06a イベント編集・持ち込み在庫', () => {
  it('新しいイベントを作ると、未選択なら現在のイベントになる。持ち込み数も保存する', async () => {
    const { cookie } = await seedBasic();
    const { user, path } = renderApp('/events', '/events/new');
    await user.type(await screen.findByLabelText('イベント名'), '駅前マルシェ');
    const date = screen.getByLabelText('開催日');
    await user.clear(date);
    await user.type(date, '2026-12-01');
    await user.click(await screen.findByRole('button', { name: 'クッキーを 1 増やす' }));
    await user.click(screen.getByRole('button', { name: 'クッキーを 1 増やす' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(path()).toBe('/events'));
    const created = (await listEvents()).find((e) => e.name === '駅前マルシェ')!;
    expect(created.date).toBe('2026-12-01');
    expect(await getCurrentEventId()).toBe(created.id);
    expect(await listEventStocks(created.id)).toMatchObject([
      { productId: cookie.id, broughtQty: 2 },
    ]);
  });

  it('持ち込み数は販売数より減らせない', async () => {
    const { cookie, event } = await seedBasic(); // クッキーの持ち込み 5
    await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 4, discount: null }],
      orderDiscount: null,
      tendered: 1200,
    });
    const { user } = renderApp('/events', `/events/${event.id}`);
    const minus = await screen.findByRole('button', { name: 'クッキーを 1 減らす' });
    await waitFor(() => expect(screen.getByText('販売 4・残 1')).toBeInTheDocument());
    await user.click(minus);
    expect(minus).toBeDisabled(); // 4 になったら押せない
    expect(screen.getByText('販売 4・残 0')).toBeInTheDocument();

    // 直接入力で少なくすると、エラーを出して保存しない
    const input = screen.getByLabelText('クッキーの持ち込み数');
    await user.clear(input);
    await user.type(input, '2');
    expect(screen.getByText('販売数（4）より少なくできません')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(
      (await listEventStocks(event.id)).find((s) => s.productId === cookie.id)?.broughtQty,
    ).toBe(5);
  });

  it('「在庫を管理する」が ON の販売中の商品だけを並べる', async () => {
    const { muffin, event } = await seedBasic();
    const { updateProduct } = await import('../../db/repositories/products');
    await updateProduct(muffin.id, { isOnSale: false });
    renderApp(`/events/${event.id}`);
    expect(await screen.findByLabelText('クッキーの持ち込み数')).toHaveValue('5');
    expect(screen.queryByLabelText('マフィンの持ち込み数')).not.toBeInTheDocument();
  });

  it('会計したことのないイベントは、確認してから削除できる', async () => {
    const { event } = await seedBasic();
    const { user, path } = renderApp('/events', `/events/${event.id}`);
    await user.click(await screen.findByRole('button', { name: 'このイベントを削除する' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('イベント「○○マルシェ」を削除します。元に戻せません。');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(path()).toBe('/events'));
    expect(await listEvents()).toEqual([]);
  });

  it('取引があるイベントには［このイベントを削除する］を出さない', async () => {
    const { cookie, event } = await seedBasic();
    await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 1, discount: null }],
      orderDiscount: null,
      tendered: 300,
    });
    renderApp(`/events/${event.id}`);
    await screen.findByRole('button', { name: '現在のイベントにする' });
    expect(
      screen.queryByRole('button', { name: 'このイベントを削除する' }),
    ).not.toBeInTheDocument();
  });
});

describe('S-06 イベント一覧', () => {
  it('行のメニューから現在のイベントにすると「現在」が付く', async () => {
    await seedBasic();
    const { user } = renderApp('/events');
    await user.click(await screen.findByRole('button', { name: /○○マルシェ/ }));
    await user.click(screen.getByRole('button', { name: '現在のイベントにする' }));
    expect(await screen.findByText('現在')).toBeInTheDocument();
  });

  it('行のメニューの［編集・持ち込み在庫］で編集画面を開き、戻ると一覧に戻る', async () => {
    const { event } = await seedBasic();
    const { user, path } = renderApp('/more', '/events');
    await user.click(await screen.findByRole('button', { name: /○○マルシェ/ }));
    await user.click(screen.getByRole('button', { name: '編集・持ち込み在庫' }));
    await waitFor(() => expect(path()).toBe(`/events/${event.id}`));
    await screen.findByLabelText('イベント名');
    await user.click(screen.getByRole('button', { name: '◀ 戻る' }));
    await waitFor(() => expect(path()).toBe('/events'));
  });
});
