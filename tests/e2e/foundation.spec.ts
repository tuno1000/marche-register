import { expect, test } from '@playwright/test';

test('起動すると会計画面と下のタブが表示される', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '会計' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'メイン' });
  for (const label of ['会計', '履歴', '集計', 'その他']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible();
  }
});

test('タブと「戻る」で画面を行き来できる', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'その他' }).click();
  await page.getByRole('link', { name: /設定/ }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('navigation', { name: 'メイン' })).toBeHidden();
  await page.getByRole('button', { name: '◀ 戻る' }).click();
  await expect(page).toHaveURL(/#\/more$/);
});

test('ホーム画面に追加するための情報（マニフェスト）がある', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href!);
  const manifest = await res.json();
  expect(manifest.name).toBe('マルシェレジ');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('portrait');
});

test('一度開いたあとは、通信を切っても起動できる（E-6）', async ({ page, context }) => {
  await page.goto('./');
  // Service Worker がファイルをキャッシュし終えるのを待つ
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      if ((await cache.keys()).some((r) => r.url.endsWith('index.html'))) return true;
    }
    return false;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '会計' })).toBeVisible();
  await page.getByRole('link', { name: '集計' }).click();
  await expect(page.getByRole('heading', { name: '集計' })).toBeVisible();
});
