import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { listCategories } from '../../db/repositories/categories';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';

beforeEach(resetDb);

describe('S-05c カテゴリ', () => {
  it('シートで名前と色を選んで追加すると、一覧に出る', async () => {
    const { user } = renderApp('/more', '/categories');
    await user.click(await screen.findByRole('button', { name: '＋ カテゴリを追加' }));
    const sheet = screen.getByRole('dialog', { name: 'カテゴリを追加' });
    await user.type(within(sheet).getByLabelText('カテゴリ名'), '焼き菓子');
    await user.click(within(sheet).getByRole('radio', { name: '色 5' }));
    await user.click(within(sheet).getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('button', { name: '焼き菓子を編集' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await listCategories())[0]).toMatchObject({ name: '焼き菓子', color: 'c5' });
  });

  it('名前が空なら保存しない', async () => {
    const { user } = renderApp('/categories');
    await user.click(await screen.findByRole('button', { name: '＋ カテゴリを追加' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('alert')).toHaveTextContent('カテゴリ名を入力してください');
    expect(await listCategories()).toEqual([]);
  });

  it('商品があるカテゴリは削除できず、移すように案内する', async () => {
    await seedBasic();
    const { user } = renderApp('/categories');
    await user.click(await screen.findByRole('button', { name: '焼き菓子を編集' }));
    await user.click(screen.getByRole('button', { name: 'このカテゴリを削除する' }));
    expect(screen.getByRole('alert')).toHaveTextContent('先に商品を別のカテゴリへ移してください');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('商品がないカテゴリは、確認してから削除する', async () => {
    await seedBasic();
    const { user } = renderApp('/categories');
    await user.click(await screen.findByRole('button', { name: '＋ カテゴリを追加' }));
    await user.type(screen.getByLabelText('カテゴリ名'), '雑貨');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(await screen.findByRole('button', { name: '雑貨を編集' }));
    await user.click(screen.getByRole('button', { name: 'このカテゴリを削除する' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }),
    );
    await waitFor(async () =>
      expect((await listCategories()).map((c) => c.name)).toEqual(['焼き菓子']),
    );
  });

  it('［↑］で並べ替える。先頭の［↑］は押せない', async () => {
    await seedBasic();
    const { user } = renderApp('/categories');
    await user.click(await screen.findByRole('button', { name: '＋ カテゴリを追加' }));
    await user.type(screen.getByLabelText('カテゴリ名'), 'パン');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await user.click(await screen.findByRole('button', { name: 'パンを上へ' }));
    await waitFor(async () =>
      expect((await listCategories()).map((c) => c.name)).toEqual(['パン', '焼き菓子']),
    );
    expect(await screen.findByRole('button', { name: 'パンを上へ' })).toBeDisabled();
  });

  it('Android の戻るボタンでは、シートだけ閉じて画面は移らない', async () => {
    const { user, router, path } = renderApp('/more', '/categories');
    await user.click(await screen.findByRole('button', { name: '＋ カテゴリを追加' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await router.navigate(-1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(path()).toBe('/categories');
    // もう一度押すと、前の画面に戻る
    await router.navigate(-1);
    await waitFor(() => expect(path()).toBe('/more'));
  });
});
