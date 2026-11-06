import { expect, test } from '@playwright/test';

test('ブラウザで開くと、まずインストール案内を出す。［このまま使う］で次からは出さない', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await expect(page).toHaveURL(/#\/install$/);
  await expect(
    page.getByRole('heading', { name: 'ホーム画面に追加して使ってください' }),
  ).toBeVisible();
  // iPhone は共有ボタンの手順、Android はメニューの手順（またはインストールボタン）
  if (testInfo.project.name === 'iphone') {
    await expect(page.getByRole('list', { name: 'iPhone での手順' })).toBeVisible();
  } else {
    await expect(
      page
        .getByRole('list', { name: 'Android での手順' })
        .or(page.getByRole('button', { name: 'インストール' })),
    ).toBeVisible();
  }

  await page.getByRole('button', { name: 'このまま使う' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('ブラウザで開いています')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /イベント未選択/ })).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);

  // 警告から手順を見て、戻れる
  await page.getByRole('link', { name: 'ホーム画面に追加するには' }).click();
  await expect(page).toHaveURL(/#\/install$/);
  await page.getByRole('button', { name: 'このまま使う' }).click();
  await expect(page).toHaveURL(/#\/$/);
});
