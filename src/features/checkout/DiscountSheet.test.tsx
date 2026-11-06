import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { BackGuardProvider } from '../../app/BackGuard';
import type { Discount, DiscountPreset } from '../../domain/types';
import { DiscountSheet, type DiscountTarget } from './DiscountSheet';

const presets: DiscountPreset[] = [
  { id: '1', label: '50円引き', kind: 'yen', value: 50, scope: 'both' },
  { id: '2', label: '15%引き', kind: 'percent', value: 15, scope: 'line' },
  { id: '3', label: '全体100円', kind: 'yen', value: 100, scope: 'order' },
];

function open(target: Partial<DiscountTarget> = {}, defaultRounding: 'floor' | 'ceil' = 'floor') {
  const onApply = vi.fn<(d: Discount | null) => void>();
  const full: DiscountTarget = {
    label: 'ハーブティー ×1',
    scope: 'line',
    base: 555,
    current: null,
    ...target,
  };
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <BackGuardProvider>
          <DiscountSheet
            target={full}
            presets={presets}
            defaultRounding={defaultRounding}
            onApply={onApply}
            onClose={() => {}}
          />
        </BackGuardProvider>
      ),
    },
  ]);
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), onApply, sheet: screen.getByRole('dialog') };
}

describe('S-01b 値引き', () => {
  it('定型ボタンは対象で使えるものだけ。押すと自由入力に入り、すぐには適用しない', async () => {
    const { user, onApply, sheet } = open();
    expect(within(sheet).getByRole('button', { name: '50円引き' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: '15%引き' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: '全体100円' })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: '15%引き' }));
    expect(within(sheet).getByLabelText('値引き率（%）')).toHaveValue('15');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('% のときだけ端数処理の 3 つを、値引き後の金額つきで出す（555 円の 15% 引き）', async () => {
    const { user, onApply, sheet } = open();
    await user.type(within(sheet).getByLabelText('値引き額（円）'), '15');
    expect(within(sheet).queryByRole('radiogroup', { name: '端数処理' })).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole('radio', { name: '%' }));
    const group = within(sheet).getByRole('radiogroup', { name: '端数処理' });
    const options = within(group).getAllByRole('radio');
    expect(options.map((o) => o.textContent)).toEqual([
      '◉切り捨て-¥83 → ¥472',
      '○切り上げ-¥84 → ¥471',
      '○10円単位-¥85 → ¥470',
    ]);
    await user.click(options[2]!);
    await user.click(within(sheet).getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ kind: 'percent', value: 15, rounding: 'round10' });
  });

  it('端数処理の初期選択は、設定に従う', async () => {
    const { user, sheet } = open({}, 'ceil');
    await user.click(within(sheet).getByRole('button', { name: '15%引き' }));
    expect(within(sheet).getByRole('radio', { name: /切り上げ/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('値引き後がマイナスになる額や、100% を超える率は適用できない', async () => {
    const { user, sheet } = open();
    const input = within(sheet).getByLabelText('値引き額（円）');
    await user.type(input, '556');
    expect(within(sheet).getByRole('alert')).toHaveTextContent('対象金額（¥555）より大きい');
    expect(within(sheet).getByRole('button', { name: '適用' })).toBeDisabled();
    await user.clear(input);
    await user.type(input, '555');
    expect(within(sheet).getByRole('button', { name: '適用' })).toBeEnabled();

    await user.click(within(sheet).getByRole('radio', { name: '%' }));
    await user.clear(within(sheet).getByLabelText('値引き率（%）'));
    await user.type(within(sheet).getByLabelText('値引き率（%）'), '101');
    expect(within(sheet).getByRole('button', { name: '適用' })).toBeDisabled();
  });

  it('値引きがある対象を開くと、今の値引きが入っていて［値引きを外す］で外せる', async () => {
    const { user, onApply, sheet } = open({
      current: { kind: 'percent', value: 20, rounding: 'ceil' },
    });
    expect(within(sheet).getByLabelText('値引き率（%）')).toHaveValue('20');
    expect(within(sheet).getByRole('radio', { name: /切り上げ/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(sheet).getByRole('button', { name: '値引きを外す' }));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('値引きがないときは［値引きを外す］を押せない', () => {
    const { sheet } = open();
    expect(within(sheet).getByRole('button', { name: '値引きを外す' })).toBeDisabled();
  });
});
