import { expect, test } from './fixtures';
import { cart, productButton, setupShop } from './helpers';

test('E-2 会計：明細と全体の値引き → お預かり → レシートの金額が 03 の 4.3 と同じ', async ({
  page,
}) => {
  await setupShop(page);
  await productButton(page, 'クッキー').click();
  await productButton(page, 'クッキー').click();
  await productButton(page, 'マフィン').click();

  // クッキーに 10% 引き（切り捨て）
  await cart(page).getByRole('button', { name: 'クッキーのメニュー' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '値引き' }).click();
  const lineSheet = page.getByRole('dialog', { name: '値引き：クッキー ×2' });
  await lineSheet.getByRole('button', { name: '10%引き' }).click();
  await expect(lineSheet.getByRole('radio', { name: /切り捨て.*-¥60 → ¥540/ })).toBeVisible();
  await lineSheet.getByRole('button', { name: '適用' }).click();

  // 会計全体に 100 円引き
  await cart(page).getByRole('button', { name: '値引き', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '100円引き' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '適用' }).click();
  await expect(cart(page)).toContainText('合計 ¥890');

  await cart(page).getByRole('button', { name: 'お預かりへ ▶' }).click();
  await page.getByRole('button', { name: '＋1,000' }).click();
  await expect(page.getByLabel('お釣り')).toHaveText('¥110');
  await page.getByRole('button', { name: '確定' }).click();

  await expect(page).toHaveURL(/#\/receipt\//);
  await expect(page.getByLabel('お釣り')).toHaveText('¥110');
  const receipt = page.getByRole('article', { name: 'レシート' });
  await expect(receipt).toContainText('No. 1103-001');
  await expect(receipt).toContainText('（8%対象¥485 内税 ¥35）');
  await expect(receipt).toContainText('（10%対象¥405 内税 ¥36）');
  await expect(receipt).toContainText('合計¥890');

  // 次の会計へ：カートは空、残りが減っている
  await page.getByRole('button', { name: '次の会計へ' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(cart(page)).toContainText('商品をタップして追加');
  await expect(productButton(page, 'クッキー')).toContainText('残 3');
  await expect(productButton(page, 'マフィン')).toContainText('残 2');
});

test('E-3 売り切れ：残りが 0 になると押せなくなる', async ({ page }) => {
  await setupShop(page, { cookie: 2, muffin: 3 });
  await productButton(page, 'クッキー').click();
  await productButton(page, 'クッキー').click();
  await expect(productButton(page, 'クッキー')).toContainText('残 0');
  await productButton(page, 'クッキー').click();
  await expect(page.getByRole('status')).toContainText('「クッキー」はこれ以上ありません');
  await expect(cart(page).getByLabel('クッキーの数量')).toHaveText('2');

  await cart(page).getByRole('button', { name: 'お預かりへ ▶' }).click();
  await page.getByRole('button', { name: 'ぴったり' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  await page.getByRole('button', { name: '次の会計へ' }).click();
  await expect(productButton(page, 'クッキー')).toBeDisabled();
  await expect(productButton(page, 'クッキー')).toContainText('売切');
});

test('E-5 カートの復元：カートに入れたまま再読み込みしても残る', async ({ page }) => {
  await setupShop(page);
  await productButton(page, 'マフィン').click();
  await productButton(page, 'マフィン').click();
  await cart(page).getByRole('button', { name: '値引き', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '50円引き' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '適用' }).click();
  await expect(cart(page)).toContainText('合計 ¥850');

  await page.reload();
  await expect(cart(page).getByLabel('マフィンの数量')).toHaveText('2');
  await expect(cart(page)).toContainText('合計 ¥850');
});

test('E-6 オフライン：通信を切っても起動して会計できる', async ({ page, context }) => {
  await setupShop(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(async () => {
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      if ((await cache.keys()).some((r) => r.url.endsWith('index.html'))) return true;
    }
    return false;
  });

  await context.setOffline(true);
  await page.reload();
  await productButton(page, 'クッキー').click();
  await cart(page).getByRole('button', { name: 'お預かりへ ▶' }).click();
  await page.getByRole('button', { name: '＋500' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  await expect(page.getByLabel('お釣り')).toHaveText('¥200');
});
