import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getKv, getSettings, setCurrentEventId, updateSettings } from '../../db/kv';
import { createBackup } from '../../db/repositories/backup';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { seedBasic } from '../../test/fixtures';
import { renderApp } from '../../test/render';

const saved: { name: string; text: string }[] = [];
vi.mock('../../lib/file', () => ({
  saveFile: async (blob: Blob, name: string) => {
    saved.push({ name, text: await blob.text() });
    return true;
  },
}));

beforeEach(async () => {
  await resetDb();
  saved.length = 0;
  document.documentElement.dataset.theme = 'light';
});

describe('S-07 設定（表示）', () => {
  it('ダークを選ぶと保存され、画面の色が切り替わる', async () => {
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'ダーク' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect((await getSettings()).theme).toBe('dark');
    await user.click(screen.getByRole('radio', { name: 'ライト' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });
});

describe('S-07 設定（レシート）', () => {
  it('入力し終えたら（フォーカスが外れたら）自動で保存する', async () => {
    const { user } = renderApp('/settings');
    await user.type(await screen.findByLabelText('店名'), '○○焼き菓子店');
    expect((await getSettings()).shopName).toBe('');
    await user.tab();
    await waitFor(async () => expect((await getSettings()).shopName).toBe('○○焼き菓子店'));
  });

  it('登録番号は「T＋13 桁」でなければエラーを出して保存しない。全角や小文字はそろえる', async () => {
    const { user } = renderApp('/settings');
    const input = await screen.findByLabelText('登録番号（インボイス）');
    await user.type(input, 'T123');
    await user.tab();
    expect(screen.getByText(/T」と 13 桁の数字/)).toBeInTheDocument();
    expect((await getSettings()).invoiceNo).toBe('');

    await user.clear(input);
    await user.type(input, 'ｔ１２３４５６７８９０１２３');
    await user.tab();
    expect(input).toHaveValue('T1234567890123');
    await waitFor(async () => expect((await getSettings()).invoiceNo).toBe('T1234567890123'));
    expect(screen.queryByText(/T」と 13 桁の数字/)).not.toBeInTheDocument();
  });

  it('SNS・URL は https:// から。正しければ保存し、プレビューに QR コードが出る', async () => {
    const { user } = renderApp('/settings');
    await user.type(await screen.findByLabelText('SNS・URL 1 のラベル'), 'Instagram');
    await user.type(screen.getByLabelText('SNS・URL 1 の URL'), 'instagram.com/shop');
    await user.tab();
    expect(screen.getByText('URL は https:// から入力してください')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('SNS・URL 1 の URL'));
    await user.type(screen.getByLabelText('SNS・URL 1 の URL'), 'https://instagram.com/shop');
    await user.tab();
    await waitFor(async () =>
      expect((await getSettings()).links).toEqual([
        { label: 'Instagram', url: 'https://instagram.com/shop' },
      ]),
    );

    await user.click(screen.getByRole('button', { name: 'レシートのプレビュー' }));
    const sheet = screen.getByRole('dialog', { name: 'レシートのプレビュー' });
    expect(within(sheet).getByRole('img', { name: 'Instagramの QR コード' })).toBeInTheDocument();
    expect(within(sheet).getByRole('article')).toHaveTextContent('合計¥890');
  });

  it('端数処理の初期選択を変えられる', async () => {
    const { user } = renderApp('/settings');
    await user.selectOptions(await screen.findByLabelText('端数処理の初期選択'), '10円単位');
    await waitFor(async () => expect((await getSettings()).defaultRounding).toBe('round10'));
  });
});

describe('S-07 設定（データ）', () => {
  it('バックアップを書き出し、前回のバックアップの日時を残す', async () => {
    await seedBasic();
    const { user } = renderApp('/settings');
    expect(await screen.findByText(/前回のバックアップ まだありません/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /バックアップ（JSON）/ }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toMatch(/^marche-register-backup-\d{8}-\d{4}\.json$/);
    expect(JSON.parse(saved[0]!.text).counts.products).toBe(2);
    await waitFor(async () => expect(await getKv('lastBackupAt')).toBeTypeOf('number'));
    expect(screen.queryByText(/まだありません/)).not.toBeInTheDocument();
  });

  it('CSV はイベントを選んで書き出す', async () => {
    await seedBasic();
    const { user } = renderApp('/settings');
    // イベントを読み終えるまでは押せない
    const csvButton = await screen.findByRole('button', { name: /CSV 書き出し/ });
    await waitFor(() => expect(csvButton).toBeEnabled());
    await user.click(csvButton);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /○○マルシェ/ }),
    );
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('marche-register-○○マルシェ-20261103.csv');
  });

  it('復元：ファイルの概要を見せて、確認してから置き換える', async () => {
    const { event } = await seedBasic();
    await setCurrentEventId(event.id);
    await updateSettings({ shopName: '前の店名' });
    const backup = await createBackup('0.5.0');
    await db.categories.clear();
    await updateSettings({ shopName: '今の店名' });

    const { user } = renderApp('/settings');
    await screen.findByLabelText('店名');
    const file = new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('復元するファイル'), file);
    const dialog = await screen.findByRole('alertdialog', {
      name: 'このバックアップで復元しますか？',
    });
    expect(dialog).toHaveTextContent('商品2 件');
    expect(dialog).toHaveTextContent('今のデータはすべて置き換わります');
    await user.click(within(dialog).getByRole('button', { name: '復元する' }));
    await waitFor(async () => expect(await db.categories.count()).toBe(1));
    // 入力欄も復元した設定で作り直す
    await waitFor(() => expect(screen.getByLabelText('店名')).toHaveValue('前の店名'));
  });

  it('このアプリのバックアップでないファイルは、何も変えずに知らせる', async () => {
    await seedBasic();
    const { user } = renderApp('/settings');
    await screen.findByLabelText('店名');
    await user.upload(
      screen.getByLabelText('復元するファイル'),
      new File(['{"hello":1}'], 'x.json', { type: 'application/json' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'このアプリのバックアップファイルではありません',
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.products.count()).toBe(2);
  });

  it('全データの削除は「削除」と入力するまで押せない', async () => {
    await seedBasic();
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: '全データを削除' }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: '削除する' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/「削除」と入力/), 'さくじょ');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/「削除」と入力/));
    await user.type(within(dialog).getByLabelText(/「削除」と入力/), '削除');
    await user.click(confirm);
    await waitFor(async () => expect(await db.products.count()).toBe(0));
  });
});
