import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { cart, productButton, setupShop } from './helpers';

/** クッキー ×2（10% 引き）＋ マフィン ×1、全体 100 円引き → ¥890（03 の 4.3） */
async function sellSample(page: Page) {
  await productButton(page, 'クッキー').click();
  await productButton(page, 'クッキー').click();
  await productButton(page, 'マフィン').click();
  await cart(page).getByRole('button', { name: 'クッキーのメニュー' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '値引き' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '10%引き' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '適用' }).click();
  await cart(page).getByRole('button', { name: '値引き', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '100円引き' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '適用' }).click();
  await cart(page).getByRole('button', { name: 'お預かりへ ▶' }).click();
  await page.getByRole('button', { name: '＋1,000' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  await page.getByRole('button', { name: '次の会計へ' }).click();
}

test('E-7 バックアップ → 全データ削除 → 復元で、元のデータに戻る', async ({ page }) => {
  await setupShop(page);
  await sellSample(page);
  await page.goto('./#/settings');
  await page.getByLabel('店名').fill('○○焼き菓子店');
  await page.getByLabel('登録番号（インボイス）').click(); // 店名の入力を終える

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /バックアップ（JSON）/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^marche-register-backup-\d{8}-\d{4}\.json$/);
  const path = await download.path();
  await expect(page.getByText(/前回のバックアップ \d{4}\//)).toBeVisible();

  await page.getByRole('button', { name: '全データを削除' }).click();
  await page.getByLabel(/「削除」と入力/).fill('削除');
  await page.getByRole('alertdialog').getByRole('button', { name: '削除する' }).click();
  await expect(page.getByLabel('店名')).toHaveValue('');
  await page.goto('./#/');
  await expect(page.getByText('イベントを選んでください')).toBeVisible();

  await page.goto('./#/settings');
  await page.getByLabel('復元するファイル').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: await readFile(path),
  });
  const dialog = page.getByRole('alertdialog', { name: 'このバックアップで復元しますか？' });
  await expect(dialog).toContainText('取引1 件');
  await dialog.getByRole('button', { name: '復元する' }).click();
  await expect(page.getByLabel('店名')).toHaveValue('○○焼き菓子店');

  await page.goto('./#/');
  await expect(productButton(page, 'クッキー')).toContainText('残 3');
  await page.getByRole('link', { name: '履歴' }).click();
  await page.getByRole('link', { name: /1103-001/ }).click();
  const receipt = page.getByRole('article', { name: 'レシート' });
  await expect(receipt).toContainText('合計¥890');
});

test('E-8 CSV の中身が、会計した内容と合っている', async ({ page }) => {
  await setupShop(page);
  await sellSample(page);
  await page.goto('./#/settings');
  await page.getByRole('button', { name: /CSV 書き出し/ }).click();
  const downloading = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /○○マルシェ/ })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('marche-register-○○マルシェ-20261103.csv');

  const csv = await readFile(await download.path(), 'utf8');
  expect(csv.startsWith('﻿')).toBe(true);
  const rows = csv.slice(1).split('\r\n');
  expect(rows[0]).toBe(
    'イベント名,開催日,取引番号,取引日時,状態,明細番号,商品名,カテゴリ,税率,単価,数量,小計,明細値引き,全体値引き按分,値引き後金額',
  );
  const cols = rows.slice(1, 3).map((r) => r.split(','));
  expect(cols.map((c) => [c[2], c[4], ...c.slice(5)])).toEqual([
    ['1103-001', '有効', '1', 'クッキー', '焼き菓子', '8%', '300', '2', '600', '60', '55', '485'],
    ['1103-001', '有効', '2', 'マフィン', '焼き菓子', '10%', '450', '1', '450', '0', '45', '405'],
  ]);
});
