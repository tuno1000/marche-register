import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getCurrentEventId, setCurrentEventId, updateSettings } from '../../db/kv';
import { getCart } from '../../db/repositories/cart';
import { createEvent } from '../../db/repositories/events';
import { updateProduct } from '../../db/repositories/products';
import { checkout } from '../../db/repositories/transactions';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';
import { cartSaved, useCartStore } from './cartStore';

beforeEach(resetDb);

async function setup() {
  const seed = await seedBasic(); // クッキー ¥300 8% 持込 5、マフィン ¥450 10% 持込 3
  await setCurrentEventId(seed.event.id);
  const app = renderApp('/');
  await screen.findByRole('tab', { name: '焼き菓子' });
  return { ...seed, ...app };
}

/** 商品エリアの、その商品のボタン */
const productButton = (name: string) =>
  [...screen.getByRole('tabpanel').querySelectorAll('button')].find((b) =>
    b.textContent?.includes(name),
  )!;

const cart = () => screen.getByRole('region', { name: 'カート' });

describe('S-01 会計', () => {
  it('イベントを選んでいなければ、イベントを選ぶよう案内する', async () => {
    await seedBasic();
    renderApp('/');
    expect(await screen.findByText('イベントを選んでください')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'イベントを選ぶ' })).toHaveAttribute('href', '/events');
  });

  it('商品がなければ、商品を登録するよう案内する', async () => {
    const event = await createEvent({ name: 'A', date: '2026-11-03', location: '', memo: '' });
    await setCurrentEventId(event.id);
    renderApp('/');
    expect(await screen.findByText('商品を登録してください')).toBeInTheDocument();
  });

  it('ヘッダーに現在のイベント名と日付を出す', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: /○○マルシェ 11\/3/ })).toBeInTheDocument();
  });

  it('商品をタップするとカートに 1 個ずつ入り、残りと合計が変わる', async () => {
    const { user } = await setup();
    expect(productButton('クッキー')).toHaveTextContent('残 5');
    await user.click(productButton('クッキー'));
    await user.click(productButton('クッキー'));
    await user.click(productButton('マフィン'));
    expect(productButton('クッキー')).toHaveTextContent('残 3');
    expect(within(cart()).getByLabelText('クッキーの数量')).toHaveTextContent('2');
    expect(cart()).toHaveTextContent('3点');
    expect(cart()).toHaveTextContent('¥1,050');
    // 8% の商品には ※
    expect(within(cart()).getByRole('button', { name: 'クッキーのメニュー' })).toHaveTextContent(
      'クッキー※',
    );
    await cartSaved();
    expect((await getCart())?.lines).toHaveLength(2);
  });

  it('残りを超えては追加できない。売り切れの商品は押せない', async () => {
    const { user, cookie, event } = await setup();
    for (let i = 0; i < 6; i++) await user.click(productButton('クッキー'));
    expect(within(cart()).getByLabelText('クッキーの数量')).toHaveTextContent('5');
    expect(await screen.findByRole('status')).toHaveTextContent('「クッキー」はこれ以上ありません');

    // 全部売れたら「売切」で押せない
    await checkout({
      eventId: event.id,
      lines: [{ productId: cookie.id, qty: 5, discount: null }],
      orderDiscount: null,
      tendered: 1500,
    });
    useCartStore.getState().clear();
    await waitFor(() => expect(productButton('クッキー')).toBeDisabled());
    expect(productButton('クッキー')).toHaveTextContent('売切');
  });

  it('数量を 0 にすると行が消え、カートが空なら［値引き］［お預かりへ］を押せない', async () => {
    const { user } = await setup();
    expect(within(cart()).getByText('商品をタップして追加')).toBeInTheDocument();
    expect(within(cart()).getByRole('button', { name: 'お預かりへ ▶' })).toBeDisabled();
    expect(within(cart()).getByRole('button', { name: '値引き' })).toBeDisabled();

    await user.click(productButton('クッキー'));
    expect(within(cart()).getByRole('button', { name: 'お預かりへ ▶' })).toBeEnabled();
    await user.click(within(cart()).getByRole('button', { name: 'クッキーを 1 減らす' }));
    expect(within(cart()).queryByLabelText('クッキーの数量')).not.toBeInTheDocument();
    expect(within(cart()).getByRole('button', { name: 'お預かりへ ▶' })).toBeDisabled();
  });

  it('［全クリア］は確認してから空にする', async () => {
    const { user } = await setup();
    await user.click(productButton('クッキー'));
    await user.click(within(cart()).getByRole('button', { name: '全クリア' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '空にする' }),
    );
    expect(within(cart()).getByText('商品をタップして追加')).toBeInTheDocument();
  });

  it('商品名のメニューから明細の値引き、会計全体の値引きをして 03 の 4.3 の金額になる', async () => {
    const { user } = await setup();
    await user.click(productButton('クッキー'));
    await user.click(productButton('クッキー'));
    await user.click(productButton('マフィン'));

    await user.click(within(cart()).getByRole('button', { name: 'クッキーのメニュー' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '値引き' }));
    let sheet = screen.getByRole('dialog', { name: '値引き：クッキー ×2' });
    await user.click(within(sheet).getByRole('button', { name: '10%引き' }));
    await user.click(within(sheet).getByRole('button', { name: '適用' }));
    expect(cart()).toHaveTextContent('値引き 10%-¥60');

    await user.click(within(cart()).getByRole('button', { name: '値引き' }));
    sheet = screen.getByRole('dialog', { name: '値引き：会計全体' });
    await user.type(within(sheet).getByLabelText('値引き額（円）'), '100');
    await user.click(within(sheet).getByRole('button', { name: '適用' }));
    expect(cart()).toHaveTextContent('全体値引き-¥100');
    expect(cart()).toHaveTextContent('¥890');
  });

  it('価格が空の商品は、金額を入力してからカートに入れる。単価ごとに別の行になる', async () => {
    const { user, cookie } = await setup();
    await updateProduct(cookie.id, { price: null });
    await waitFor(() => expect(productButton('クッキー')).toHaveTextContent('金額入力'));

    await user.click(productButton('クッキー'));
    let sheet = screen.getByRole('dialog', { name: '金額：クッキー' });
    expect(within(sheet).getByRole('button', { name: 'カートに追加' })).toBeDisabled();
    await user.type(within(sheet).getByLabelText('金額（税込）'), '500{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(productButton('クッキー'));
    sheet = screen.getByRole('dialog', { name: '金額：クッキー' });
    await user.type(within(sheet).getByLabelText('金額（税込）'), '200');
    await user.click(within(sheet).getByRole('button', { name: 'カートに追加' }));

    // ＋ は同じ単価でもう 1 個
    await user.click(within(cart()).getByRole('button', { name: 'クッキー（¥500）を 1 増やす' }));
    expect(within(cart()).getByLabelText('クッキー（¥500）の数量')).toHaveTextContent('2');
    expect(within(cart()).getByLabelText('クッキー（¥200）の数量')).toHaveTextContent('1');
    expect(cart()).toHaveTextContent('¥1,200');
    expect(productButton('クッキー')).toHaveTextContent('残 2');
  });

  it('メニューの［金額を変える］で、カートの行の単価を変えられる。登録した価格に戻すと元の行になる', async () => {
    const { user } = await setup();
    await user.click(productButton('クッキー'));
    await user.click(productButton('クッキー'));

    await user.click(within(cart()).getByRole('button', { name: 'クッキーのメニュー' }));
    await user.click(screen.getByRole('button', { name: '金額を変える' }));
    let sheet = screen.getByRole('dialog', { name: '金額：クッキー' });
    expect(sheet).toHaveTextContent('登録した価格 ¥300');
    const input = within(sheet).getByLabelText('金額（税込）');
    expect(input).toHaveValue('300');
    await user.clear(input);
    await user.type(input, '250');
    await user.click(within(sheet).getByRole('button', { name: '金額を変える' }));

    expect(within(cart()).getByLabelText('クッキー（¥250）の数量')).toHaveTextContent('2');
    expect(cart()).toHaveTextContent('¥500');

    // 登録した価格に戻す
    await user.click(within(cart()).getByRole('button', { name: 'クッキー（¥250）のメニュー' }));
    await user.click(screen.getByRole('button', { name: '金額を変える' }));
    sheet = screen.getByRole('dialog', { name: '金額：クッキー' });
    await user.clear(within(sheet).getByLabelText('金額（税込）'));
    await user.type(within(sheet).getByLabelText('金額（税込）'), '300{Enter}');
    expect(within(cart()).getByLabelText('クッキーの数量')).toHaveTextContent('2');
    expect(cart()).toHaveTextContent('¥600');
  });

  it('メニューの［カートから削除］で行を消す', async () => {
    const { user } = await setup();
    await user.click(productButton('クッキー'));
    await user.click(within(cart()).getByRole('button', { name: 'クッキーのメニュー' }));
    await user.click(screen.getByRole('button', { name: 'カートから削除' }));
    expect(within(cart()).getByText('商品をタップして追加')).toBeInTheDocument();
  });

  it('カートに商品があるときにイベントを切り替えると、空にしてよいか確かめる', async () => {
    const { user, event } = await setup();
    const other = await createEvent({
      name: '別のマルシェ',
      date: '2026-12-01',
      location: '',
      memo: '',
    });
    await user.click(productButton('クッキー'));
    await user.click(screen.getByRole('link', { name: /○○マルシェ/ }));
    await user.click(await screen.findByRole('button', { name: /別のマルシェ/ }));
    await user.click(screen.getByRole('button', { name: '現在のイベントにする' }));
    const dialog = screen.getByRole('alertdialog', { name: 'カートを空にして切り替えますか？' });
    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(await getCurrentEventId()).toBe(event.id);

    await user.click(screen.getByRole('button', { name: /別のマルシェ/ }));
    await user.click(screen.getByRole('button', { name: '現在のイベントにする' }));
    await user.click(screen.getByRole('button', { name: '空にして切り替える' }));
    await waitFor(async () => expect(await getCurrentEventId()).toBe(other.id));
    expect(useCartStore.getState().cart).toBeNull();
  });

  it('販売中でない商品は出さない', async () => {
    const { cookie } = await seedBasic();
    await db.products.update(cookie.id, { isOnSale: false });
    await setCurrentEventId((await db.events.toArray())[0]!.id);
    renderApp('/');
    await screen.findByRole('tab', { name: '焼き菓子' });
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent('クッキー');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('マフィン');
  });

  it('値引きの定型ボタンは設定のものを使う', async () => {
    await updateSettings({
      discountPresets: [
        { id: 'a', label: '明細だけ', kind: 'yen', value: 30, scope: 'line' },
        { id: 'b', label: '全体だけ', kind: 'yen', value: 40, scope: 'order' },
      ],
    });
    const { user } = await setup();
    await user.click(productButton('クッキー'));
    await user.click(within(cart()).getByRole('button', { name: '値引き' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('button', { name: '全体だけ' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: '明細だけ' })).not.toBeInTheDocument();
  });
});
