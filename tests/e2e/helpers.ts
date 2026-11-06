import { expect, type Page } from '@playwright/test';

/**
 * 画面から、カテゴリ「焼き菓子」、クッキー（¥300・8%）、マフィン（¥450・10%）、
 * イベント「○○マルシェ」（2026-11-03）と持ち込み数を登録する
 */
export async function setupShop(page: Page, stock = { cookie: 5, muffin: 3 }) {
  await page.goto('./#/categories');
  await page.getByRole('button', { name: '＋ カテゴリを追加' }).click();
  await page.getByLabel('カテゴリ名').fill('焼き菓子');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: '焼き菓子を編集' })).toBeVisible();

  for (const [name, price, rate] of [
    ['クッキー', '300', '8%'],
    ['マフィン', '450', '10%'],
  ] as const) {
    await page.goto('./#/products/new');
    await page.getByLabel('商品名').fill(name);
    await page.getByLabel('価格（税込）').fill(price);
    await page.getByRole('radio', { name: rate }).click();
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page).toHaveURL(/#\/products$/);
  }

  await page.goto('./#/events/new');
  await page.getByLabel('イベント名').fill('○○マルシェ');
  await page.getByLabel('開催日').fill('2026-11-03');
  await page.getByLabel('クッキーの持ち込み数').fill(String(stock.cookie));
  await page.getByLabel('マフィンの持ち込み数').fill(String(stock.muffin));
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/#\/events$/);
  await page.goto('./#/');
  await expect(page.getByRole('heading', { name: /○○マルシェ 11\/3/ })).toBeVisible();
}

export function productButton(page: Page, name: string) {
  return page.getByRole('tabpanel').getByRole('button').filter({ hasText: name });
}

export function cart(page: Page) {
  return page.getByRole('region', { name: 'カート' });
}
