import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** 横 800 × 縦 600 の PNG（縮小されて 400 × 300 になるはず）をブラウザの中で作る */
async function makePng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d35400';
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(200, 150, 400, 300);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return btoa(String.fromCharCode(...bytes));
  });
  return Buffer.from(base64, 'base64');
}

test('E-1 カテゴリ → 商品 → イベント → 持ち込み在庫を登録する', async ({ page }) => {
  await page.goto('./#/more');

  // カテゴリ
  await page.getByRole('link', { name: /カテゴリ/ }).click();
  await page.getByRole('button', { name: '＋ カテゴリを追加' }).click();
  await page.getByLabel('カテゴリ名').fill('焼き菓子');
  await page.getByRole('radio', { name: '色 2' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: '焼き菓子を編集' })).toBeVisible();
  await page.getByRole('button', { name: '◀ 戻る' }).click();

  // 商品（画像つき）
  await page.getByRole('link', { name: /商品/ }).click();
  await page.getByRole('link', { name: '＋ 商品を追加' }).click();
  await page.getByLabel('商品名').fill('クッキー');
  await page.getByLabel('価格（税込）').fill('300');
  await page.getByLabel('画像を選択').setInputFiles({
    name: 'cookie.png',
    mimeType: 'image/png',
    buffer: await makePng(page),
  });
  const preview = page.getByRole('img', { name: '商品画像' });
  await expect(preview).toBeVisible();
  expect(
    await preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([400, 300]);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/#\/products$/);
  await expect(page.getByRole('link', { name: /クッキー.*¥300・8%/ })).toBeVisible();

  // イベントと持ち込み在庫
  await page.getByRole('button', { name: '◀ 戻る' }).click();
  await page.getByRole('link', { name: /イベント・持ち込み在庫/ }).click();
  await page.getByRole('link', { name: '＋ イベントを追加' }).click();
  await page.getByLabel('イベント名').fill('○○マルシェ');
  await page.getByLabel('開催日').fill('2026-11-03');
  await page.getByLabel('クッキーの持ち込み数').fill('20');
  await page.getByRole('button', { name: 'クッキーを 1 増やす' }).click();
  await expect(page.getByText('販売 0・残 21')).toBeVisible();
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page).toHaveURL(/#\/events$/);
  const row = page.getByRole('button', { name: /○○マルシェ/ });
  await expect(row).toContainText('2026/11/03（火）');
  await expect(row).toContainText('現在');

  // 再読み込みしても残っている
  await page.reload();
  await page.getByRole('button', { name: /○○マルシェ/ }).click();
  await page.getByRole('button', { name: '編集・持ち込み在庫' }).click();
  await expect(page.getByLabel('クッキーの持ち込み数')).toHaveValue('21');
});

test('Android の戻るボタン：シートは閉じるだけ。入力途中なら破棄するか確かめる', async ({
  page,
}) => {
  await page.goto('./#/more');
  await page.getByRole('link', { name: /カテゴリ/ }).click();
  await page.getByRole('button', { name: '＋ カテゴリを追加' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/#\/categories$/);

  await page.goBack();
  await expect(page).toHaveURL(/#\/more$/);
  await page.getByRole('link', { name: /イベント・持ち込み在庫/ }).click();
  await page.getByRole('link', { name: '＋ イベントを追加' }).click();
  await page.getByLabel('イベント名').fill('途中');
  await page.goBack();
  const dialog = page.getByRole('alertdialog', { name: '変更を破棄しますか？' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#\/events\/new$/);
  await dialog.getByRole('button', { name: '破棄する' }).click();
  await expect(page).toHaveURL(/#\/events$/);
});

test('テーマをダークにすると、再読み込みしてもダークのまま', async ({ page }) => {
  await page.goto('./#/settings');
  await page.getByRole('radio', { name: 'ダーク' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
