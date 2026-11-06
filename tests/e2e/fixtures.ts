import { test as base } from '@playwright/test';

/**
 * ふだんのテストは「ホーム画面から起動している」ことにする（インストール案内を出さない）。
 * インストール案内そのもののテストは、@playwright/test の test を使う
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
