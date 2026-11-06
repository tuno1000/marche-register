import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getSettings, updateSettings } from '../../db/kv';
import { resetDb } from '../../test/db';
import { renderApp } from '../../test/render';

beforeEach(resetDb);

const labels = async () => (await getSettings()).discountPresets.map((p) => p.label);

describe('S-07a 値引き定型ボタン編集', () => {
  it('最初は 4 つ。追加すると最後に並ぶ。表示名を空にすると自動で付く', async () => {
    const { user } = renderApp('/settings/discounts');
    await user.click(await screen.findByRole('button', { name: '＋ 追加' }));
    const sheet = screen.getByRole('dialog', { name: '定型ボタンを追加' });
    await user.click(within(sheet).getByRole('radio', { name: '%' }));
    await user.type(within(sheet).getByLabelText('値引き率（%）'), '15');
    await user.click(within(sheet).getByRole('radio', { name: '商品ごと' }));
    await user.click(within(sheet).getByRole('button', { name: '保存' }));
    await waitFor(async () =>
      expect(await labels()).toEqual(['50円引き', '100円引き', '10%引き', '20%引き', '15%引き']),
    );
    expect((await getSettings()).discountPresets[4]).toMatchObject({
      kind: 'percent',
      value: 15,
      scope: 'line',
    });
  });

  it('% は 1〜100、円は 1 円以上', async () => {
    const { user } = renderApp('/settings/discounts');
    await user.click(await screen.findByRole('button', { name: '＋ 追加' }));
    const sheet = screen.getByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: '保存' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('1 円以上');
    await user.click(within(sheet).getByRole('radio', { name: '%' }));
    await user.type(within(sheet).getByLabelText('値引き率（%）'), '150');
    await user.click(within(sheet).getByRole('button', { name: '保存' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('1〜100');
  });

  it('編集・並べ替え・削除（確認あり）', async () => {
    const { user } = renderApp('/settings/discounts');
    await user.click(await screen.findByRole('button', { name: '100円引きを編集' }));
    const sheet = screen.getByRole('dialog', { name: '定型ボタンを編集' });
    await user.clear(within(sheet).getByLabelText('表示名'));
    await user.type(within(sheet).getByLabelText('表示名'), '常連さん');
    await user.click(within(sheet).getByRole('button', { name: '保存' }));
    await waitFor(async () => expect((await labels())[1]).toBe('常連さん'));

    await user.click(await screen.findByRole('button', { name: '常連さんを上へ' }));
    await waitFor(async () => expect((await labels())[0]).toBe('常連さん'));

    await user.click(screen.getByRole('button', { name: '常連さんを編集' }));
    await user.click(screen.getByRole('button', { name: 'この定型ボタンを削除する' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }),
    );
    await waitFor(async () => expect(await labels()).toEqual(['50円引き', '10%引き', '20%引き']));
  });

  it('8 件登録したら［＋ 追加］を押せない', async () => {
    const presets = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      label: `${i + 1}0円引き`,
      kind: 'yen' as const,
      value: (i + 1) * 10,
      scope: 'both' as const,
    }));
    await updateSettings({ discountPresets: presets });
    renderApp('/settings/discounts');
    expect(await screen.findByText('定型ボタンは 8 件までです。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '＋ 追加' })).toBeDisabled();
  });
});
