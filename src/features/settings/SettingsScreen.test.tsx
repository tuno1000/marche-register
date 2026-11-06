import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getSettings } from '../../db/kv';
import { resetDb } from '../../test/db';
import { renderApp } from '../../test/render';

beforeEach(async () => {
  await resetDb();
  document.documentElement.dataset.theme = 'light';
});

describe('S-07 設定（テーマ）', () => {
  it('ダークを選ぶと保存され、画面の色が切り替わる', async () => {
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'ダーク' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect((await getSettings()).theme).toBe('dark');
    await user.click(screen.getByRole('radio', { name: 'ライト' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });
});
