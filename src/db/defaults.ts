import type { DiscountPreset, Settings } from '../domain/types';

/** 設定の初期値（03-データ設計 3.8） */
export function defaultSettings(): Settings {
  return {
    shopName: '',
    invoiceNo: '',
    contact: '',
    links: [],
    footer: '',
    defaultRounding: 'floor',
    theme: 'light',
    discountPresets: defaultDiscountPresets(),
  };
}

/**
 * 値引きの定型ボタンの初期値。設定を保存する前に何度読んでも同じになるよう、ID は固定にする
 */
function defaultDiscountPresets(): DiscountPreset[] {
  return [
    { id: 'preset-50yen', label: '50円引き', kind: 'yen', value: 50, scope: 'both' },
    { id: 'preset-100yen', label: '100円引き', kind: 'yen', value: 100, scope: 'both' },
    { id: 'preset-10pct', label: '10%引き', kind: 'percent', value: 10, scope: 'both' },
    { id: 'preset-20pct', label: '20%引き', kind: 'percent', value: 20, scope: 'both' },
  ];
}
