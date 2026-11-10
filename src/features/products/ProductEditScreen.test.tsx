import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCategory } from '../../db/repositories/categories';
import { createProduct, getProduct, listProducts } from '../../db/repositories/products';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(resetDb);

describe('S-05b 商品編集', () => {
  it('商品名・価格・税率・カテゴリを入れて保存すると、一覧に戻って表示される', async () => {
    await createCategory({ name: '焼き菓子', color: 'c1' });
    const { user, path } = renderApp('/products', '/products/new');
    await user.type(await screen.findByLabelText('商品名'), 'クッキー');
    await user.type(screen.getByLabelText('価格（税込）'), '300');
    await user.click(screen.getByRole('radio', { name: '10%' }));
    await user.click(screen.getByRole('switch', { name: '在庫を管理する' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(path()).toBe('/products'));
    expect(await screen.findByText('クッキー')).toBeInTheDocument();
    expect(await listProducts()).toMatchObject([
      { name: 'クッキー', price: 300, taxRate: 10, tracksStock: false, isOnSale: true },
    ]);
  });

  it('商品名は必須', async () => {
    await createCategory({ name: '焼き菓子', color: 'c1' });
    const { user, path } = renderApp('/products', '/products/new');
    await user.click(await screen.findByRole('button', { name: '保存' }));
    expect(screen.getByText('商品名を入力してください')).toBeInTheDocument();
    expect(path()).toBe('/products/new');
  });

  it('価格を空にして保存すると「会計時に入力」の商品になる。編集では空のまま開く', async () => {
    await createCategory({ name: 'その他', color: 'c1' });
    const { user, path } = renderApp('/products', '/products/new');
    await user.type(await screen.findByLabelText('商品名'), 'その他');
    expect(screen.getByText('空にすると、会計のときに金額を入力します')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(path()).toBe('/products'));
    expect(await screen.findByText('金額は会計時に入力')).toBeInTheDocument();
    const [product] = await listProducts();
    expect(product).toMatchObject({ name: 'その他', price: null });

    await user.click(screen.getByText('その他', { selector: 'span' }));
    await waitFor(() => expect(path()).toBe(`/products/${product!.id}`));
    expect(await screen.findByLabelText('価格（税込）')).toHaveValue('');
  });

  it('価格の欄には数字だけが入る（0 円も可）', async () => {
    await createCategory({ name: '焼き菓子', color: 'c1' });
    const { user } = renderApp('/products/new');
    const price = await screen.findByLabelText('価格（税込）');
    await user.type(price, '１,2a0');
    expect(price).toHaveValue('120');
    await user.clear(price);
    await user.type(price, '00');
    expect(price).toHaveValue('0');
  });

  it('税率の初期値は、同じカテゴリの直前の商品に合わせる', async () => {
    const a = await createCategory({ name: '焼き菓子', color: 'c1' });
    const b = await createCategory({ name: '雑貨', color: 'c2' });
    const base = { price: 100, tracksStock: false, isOnSale: true };
    await createProduct({ ...base, name: 'X', taxRate: 8, categoryId: a.id });
    await new Promise((r) => setTimeout(r, 2));
    await createProduct({ ...base, name: 'Y', taxRate: 10, categoryId: b.id });

    const { user } = renderApp('/products/new');
    const category = await screen.findByLabelText('カテゴリ');
    expect(category).toHaveValue(b.id);
    expect(screen.getByRole('radio', { name: '10%' })).toBeChecked();
    await user.selectOptions(category, a.id);
    await waitFor(() => expect(screen.getByRole('radio', { name: '8%' })).toBeChecked());
  });

  it('入力途中で戻ると確認する。［編集を続ける］なら残り、［破棄する］なら戻る', async () => {
    const { cookie } = await seedBasic();
    const { user, path } = renderApp('/products', `/products/${cookie.id}`);
    const name = await screen.findByLabelText('商品名');
    await user.type(name, '（大）');

    await user.click(screen.getByRole('button', { name: '◀ 戻る' }));
    const dialog = await screen.findByRole('alertdialog', { name: '変更を破棄しますか？' });
    await user.click(within(dialog).getByRole('button', { name: '編集を続ける' }));
    expect(path()).toBe(`/products/${cookie.id}`);
    expect(name).toHaveValue('クッキー（大）');

    await user.click(screen.getByRole('button', { name: '◀ 戻る' }));
    await user.click(await screen.findByRole('button', { name: '破棄する' }));
    await waitFor(() => expect(path()).toBe('/products'));
    expect((await getProduct(cookie.id))?.name).toBe('クッキー');
  });

  it('変更していなければ、確認せずに戻る', async () => {
    const { cookie } = await seedBasic();
    const { user, path } = renderApp('/products', `/products/${cookie.id}`);
    await screen.findByLabelText('商品名');
    await user.click(screen.getByRole('button', { name: '◀ 戻る' }));
    await waitFor(() => expect(path()).toBe('/products'));
  });

  it('［この商品を削除する］は確認してから。一覧から消える', async () => {
    const { cookie } = await seedBasic();
    const { user, path } = renderApp('/products', `/products/${cookie.id}`);
    await user.click(await screen.findByRole('button', { name: 'この商品を削除する' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('過去の取引の記録は残ります');
    await user.click(within(dialog).getByRole('button', { name: '削除する' }));
    await waitFor(() => expect(path()).toBe('/products'));
    expect((await listProducts()).map((p) => p.name)).toEqual(['マフィン']);
  });

  it('新規作成のときは［この商品を削除する］を出さない', async () => {
    await createCategory({ name: '焼き菓子', color: 'c1' });
    renderApp('/products/new');
    await screen.findByLabelText('商品名');
    expect(screen.queryByRole('button', { name: 'この商品を削除する' })).not.toBeInTheDocument();
  });

  it('カテゴリがなければ、先にカテゴリを登録するよう案内する', async () => {
    renderApp('/products/new');
    expect(await screen.findByText(/先にカテゴリ|カテゴリを追加してください/)).toBeInTheDocument();
  });
});

describe('S-05a 商品一覧', () => {
  it('販売中でない商品には「販売休止」と付ける', async () => {
    const { cookie } = await seedBasic();
    const { updateProduct } = await import('../../db/repositories/products');
    await updateProduct(cookie.id, { isOnSale: false });
    renderApp('/products');
    const row = (await screen.findByText('クッキー')).closest('a')!;
    expect(row).toHaveTextContent('販売休止');
    expect(screen.getByText('マフィン').closest('a')).not.toHaveTextContent('販売休止');
  });

  it('［並べ替え］で［↑］［↓］が出て、カテゴリの中で順番を変えられる', async () => {
    await seedBasic();
    const { user } = renderApp('/products');
    await user.click(await screen.findByRole('button', { name: '並べ替え' }));
    expect(screen.getByRole('button', { name: 'クッキーを上へ' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'マフィンを上へ' }));
    await waitFor(async () =>
      expect((await listProducts()).map((p) => p.name)).toEqual(['マフィン', 'クッキー']),
    );
  });
});
