import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentEventId } from '../../db/kv';
import { createEvent, setBroughtQty } from '../../db/repositories/events';
import { checkout, voidTransaction } from '../../db/repositories/transactions';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(resetDb);

async function setup() {
  const seed = await seedBasic();
  await setCurrentEventId(seed.event.id);
  // 03 の 4.3：クッキー ×2（10% 引き）＋ マフィン ×1、全体 100 円引き → ¥890
  await checkout({
    eventId: seed.event.id,
    lines: [
      {
        productId: seed.cookie.id,
        qty: 2,
        discount: { kind: 'percent', value: 10, rounding: 'floor' },
      },
      { productId: seed.muffin.id, qty: 1, discount: null },
    ],
    orderDiscount: { kind: 'yen', value: 100 },
    tendered: 1000,
  });
  // マフィン ×1 → ¥450
  await checkout({
    eventId: seed.event.id,
    lines: [{ productId: seed.muffin.id, qty: 1, discount: null }],
    orderDiscount: null,
    tendered: 450,
  });
  // 取り消す取引（集計に入らない）
  const voided = await checkout({
    eventId: seed.event.id,
    lines: [{ productId: seed.cookie.id, qty: 1, discount: null }],
    orderDiscount: null,
    tendered: 300,
  });
  await voidTransaction(voided.id);
  return seed;
}

const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

describe('S-04 集計', () => {
  it('イベント別：売上・件数・客単価・値引き・取消・税率別（取消は含めない）', async () => {
    await setup();
    renderApp('/summary');
    await screen.findByText('売上合計');
    expect(stat('売上合計')).toHaveTextContent('¥1,340');
    expect(stat('取引件数')).toHaveTextContent('2 件');
    expect(stat('客単価')).toHaveTextContent('¥670');
    expect(stat('値引き合計')).toHaveTextContent('-¥160');
    expect(stat('取消')).toHaveTextContent('1 件');
    // 内税は取引ごとに出した額の合計（10%：36 ＋ 40 ＝ 76。合計 855 円から計算し直すと 77 になるが、そうしない）
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual(['税率対象内税', '8%¥485¥35', '10%¥855¥76']);
  });

  it('取引がなければ客単価は「—」', async () => {
    const event = await createEvent({ name: 'A', date: '2026-11-03', location: '', memo: '' });
    await setCurrentEventId(event.id);
    renderApp('/summary');
    await screen.findByText('売上合計');
    expect(stat('客単価')).toHaveTextContent('—');
  });

  it('商品別：全体値引きの按分を反映した金額。数量順と金額順で並べ替える', async () => {
    await setup();
    const { user } = renderApp('/summary');
    await user.click(await screen.findByRole('radio', { name: '商品別' }));
    const table = await screen.findByRole('table', { name: '商品別' });
    const rowsText = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent);
    // 数量順（同じ数量なら金額の大きい順）：マフィン 2 個 ¥855、クッキー 2 個 ¥485
    expect(rowsText()).toEqual(['マフィン2¥855', 'クッキー2¥485']);
    await user.click(screen.getByRole('radio', { name: '金額順' }));
    expect(rowsText()).toEqual(['マフィン2¥855', 'クッキー2¥485']);
  });

  it('商品別では「全イベント」を選べ、すべてのイベントの取引を合計する', async () => {
    const { cookie } = await setup();
    const other = await createEvent({
      name: '別のマルシェ',
      date: '2026-12-01',
      location: '',
      memo: '',
    });
    await setBroughtQty(other.id, cookie.id, 10);
    await checkout({
      eventId: other.id,
      lines: [{ productId: cookie.id, qty: 5, discount: null }],
      orderDiscount: null,
      tendered: 1500,
    });
    const { user } = renderApp('/summary');
    await user.click(await screen.findByRole('radio', { name: '商品別' }));
    await user.click(screen.getByRole('button', { name: /表示するイベント/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '全イベント' }),
    );
    const table = await screen.findByRole('table', { name: '商品別' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('クッキー7¥1,985');

    // イベント別に戻ると「全イベント」は選べないので、イベントを表示する
    await user.click(screen.getByRole('radio', { name: 'イベント別' }));
    expect(
      screen.getByRole('button', { name: /表示するイベント：○○マルシェ/ }),
    ).toBeInTheDocument();
  });
});
