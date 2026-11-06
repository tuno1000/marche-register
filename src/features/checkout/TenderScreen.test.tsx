import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentEventId } from '../../db/kv';
import { getCart } from '../../db/repositories/cart';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { useCartStore } from './cartStore';

beforeEach(resetDb);

/** クッキー ×2（10% 切り捨て）、マフィン ×1、全体 100 円引き → 合計 890 円（03 の 4.3） */
async function setup() {
  const { cookie, muffin, event } = await seedBasic();
  await setCurrentEventId(event.id);
  const store = useCartStore.getState();
  store.add(event.id, cookie.id);
  store.add(event.id, cookie.id);
  store.add(event.id, muffin.id);
  store.setLineDiscount(cookie.id, { kind: 'percent', value: 10, rounding: 'floor' });
  store.setOrderDiscount({ kind: 'yen', value: 100 });
  useCartStore.setState({ loaded: true });
  const app = renderApp('/', '/tender');
  await screen.findByText('¥890');
  return { ...app, event };
}

const tendered = () => screen.getByLabelText('お預かり額');
const change = () => screen.getByLabelText('お釣り');

describe('S-01c お預かり', () => {
  it('金額ボタンは押すたびに足していく（＋1,000 ＋500 → 1,500 円）', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '＋1,000' }));
    await user.click(screen.getByRole('button', { name: '＋500' }));
    expect(tendered()).toHaveTextContent('¥1,500');
    expect(change()).toHaveTextContent('¥610');
  });

  it('金額ボタンのあとのテンキーは、右に数字を付け足す（1,000 →「5」→ 10,005 円）。C で 0 に戻す', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '＋1,000' }));
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(tendered()).toHaveTextContent('¥10,005');
    await user.click(screen.getByRole('button', { name: 'クリア' }));
    expect(tendered()).toHaveTextContent('¥0');
    for (const k of ['1', '5', '00']) await user.click(screen.getByRole('button', { name: k }));
    expect(tendered()).toHaveTextContent('¥1,500');
  });

  it('不足のときは「あと ¥◯」と出して［確定］を押せない。［ぴったり］で合計と同じ額になる', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: '＋500' }));
    expect(change()).toHaveTextContent('あと ¥390');
    expect(screen.getByRole('button', { name: '確定' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'ぴったり' }));
    expect(tendered()).toHaveTextContent('¥890');
    expect(change()).toHaveTextContent('¥0');
    expect(screen.getByRole('button', { name: '確定' })).toBeEnabled();
  });

  it('［確定］で取引を保存してレシートへ進み、戻ると会計画面になる。カートは空になる', async () => {
    const { user, path, router } = await setup();
    await user.click(screen.getByRole('button', { name: '＋1,000' }));
    await user.click(screen.getByRole('button', { name: '確定' }));
    await waitFor(() => expect(path()).toMatch(/^\/receipt\//));

    const [tx] = await db.transactions.toArray();
    expect(tx).toMatchObject({ total: 890, tendered: 1000, change: 110, receiptNo: '1103-001' });
    expect(tx!.taxes).toEqual([
      { rate: 8, taxableAmount: 485, taxAmount: 35 },
      { rate: 10, taxableAmount: 405, taxAmount: 36 },
    ]);
    expect(useCartStore.getState().cart).toBeNull();
    expect(await getCart()).toBeNull();

    // レシート：お釣りを大きく
    expect(await screen.findByLabelText('お釣り')).toHaveTextContent('¥110');
    const receipt = screen.getByRole('article', { name: 'レシート' });
    expect(receipt).toHaveTextContent('No. 1103-001');
    expect(receipt).toHaveTextContent('値引き 10%-¥60');
    expect(receipt).toHaveTextContent('全体値引き-¥100');
    expect(receipt).toHaveTextContent('（8%対象¥485 内税 ¥35）');
    expect(receipt).toHaveTextContent('（10%対象¥405 内税 ¥36）');
    expect(receipt).toHaveTextContent('※は軽減税率対象');

    // 戻るとお預かりではなく会計画面
    await router.navigate(-1);
    await waitFor(() => expect(path()).toBe('/'));
  });

  it('［確定］を連打しても、取引は 1 件だけ', async () => {
    const { user, path } = await setup();
    await user.click(screen.getByRole('button', { name: 'ぴったり' }));
    const button = screen.getByRole('button', { name: '確定' });
    await Promise.all([user.click(button), user.click(button), user.click(button)]);
    await waitFor(() => expect(path()).toMatch(/^\/receipt\//));
    expect(await db.transactions.count()).toBe(1);
  });

  it('在庫が足りなくなっていたら、確定せずに理由を出す。カートとお預かり額はそのまま', async () => {
    const { user, event } = await setup();
    // ほかの会計でクッキーが 4 個売れたことにする（残り 1）
    const cookie = (await db.products.toArray()).find((p) => p.name === 'クッキー')!;
    await db.eventStocks.put({
      eventId: event.id,
      productId: cookie.id,
      broughtQty: 1,
      updatedAt: 0,
    });
    await user.click(screen.getByRole('button', { name: '＋1,000' }));
    await user.click(screen.getByRole('button', { name: '確定' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('「クッキー」の在庫が足りません');
    expect(tendered()).toHaveTextContent('¥1,000');
    expect(useCartStore.getState().cart?.lines).toHaveLength(2);
    expect(await db.transactions.count()).toBe(0);
  });

  it('カートが空なら会計画面へ移る', async () => {
    useCartStore.setState({ loaded: true });
    const { path } = renderApp('/', '/tender');
    await waitFor(() => expect(path()).toBe('/'));
  });
});
