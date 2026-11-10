import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { cart, productButton, setupShop } from './helpers';

async function sell(page: Page, items: string[]) {
  for (const name of items) await productButton(page, name).click();
  await cart(page).getByRole('button', { name: 'お預かりへ ▶' }).click();
  await page.getByRole('button', { name: 'ぴったり' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  await page.getByRole('button', { name: '次の会計へ' }).click();
}

const stat = (page: Page, label: string) =>
  page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd');

test('E-4 取消：在庫が戻り、集計から外れる', async ({ page }) => {
  await setupShop(page);
  await sell(page, ['クッキー', 'クッキー']); // ¥600
  await sell(page, ['マフィン']); // ¥450
  await expect(productButton(page, 'クッキー')).toContainText('残 3');

  // 集計（取消前）
  await page.getByRole('link', { name: '集計' }).click();
  await expect(stat(page, '売上合計')).toHaveText('¥1,050');
  await expect(stat(page, '取引件数')).toHaveText('2 件');

  // 履歴から 1 件目を取り消す
  await page.getByRole('link', { name: '履歴' }).click();
  const rows = page.getByRole('link', { name: /1103-/ });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('1103-002');
  await page.getByRole('link', { name: /1103-001/ }).click();
  await page.getByRole('button', { name: 'この取引を取り消す' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '取り消す' }).click();
  await expect(page).toHaveURL(/#\/history$/);
  await expect(page.getByRole('link', { name: /1103-001/ })).toContainText('取消');

  // 在庫が戻る
  await page.getByRole('link', { name: '会計' }).click();
  await expect(productButton(page, 'クッキー')).toContainText('残 5');

  // 集計から外れる
  await page.getByRole('link', { name: '集計' }).click();
  await expect(stat(page, '売上合計')).toHaveText('¥450');
  await expect(stat(page, '取引件数')).toHaveText('1 件');
  await expect(stat(page, '取消')).toHaveText('1 件');
  await page.getByRole('radio', { name: '商品別' }).click();
  const table = page.getByRole('table', { name: '商品別' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('マフィン1¥450');
});

test('印刷するときは、レシートだけが紙に流れる（ヘッダー・お釣り・ボタン・タブは出ない）', async ({
  page,
}) => {
  await setupShop(page);
  for (const name of ['クッキー', 'マフィン']) await productButton(page, name).click();
  await cart(page).getByRole('button', { name: 'お預かりへ ▶' }).click();
  await page.getByRole('button', { name: 'ぴったり' }).click();
  await page.getByRole('button', { name: '確定' }).click();
  const receipt = page.getByRole('article', { name: 'レシート' });
  await expect(receipt).toBeVisible();
  await expect(page.getByRole('button', { name: '印刷' })).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('合計');
  await expect(page.getByRole('heading', { name: 'レシート' })).toBeHidden();
  await expect(page.getByLabel('お釣り')).toBeHidden();
  await expect(page.getByRole('button', { name: '印刷' })).toBeHidden();
  await expect(page.getByRole('button', { name: '次の会計へ' })).toBeHidden();
  // 文字は黒、背景は白
  expect(await receipt.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
  await page.screenshot({ path: test.info().outputPath('print.png'), fullPage: true });
});
