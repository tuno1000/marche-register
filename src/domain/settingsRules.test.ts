import { describe, expect, it } from 'vitest';
import {
  cleanLinks,
  invoiceNoError,
  linkError,
  normalizeInvoiceNo,
  presetAutoLabel,
  presetError,
} from './settingsRules';

describe('設定の入力チェック', () => {
  it('登録番号は空か「T＋13 桁」', () => {
    expect(invoiceNoError('')).toBeNull();
    expect(invoiceNoError('T1234567890123')).toBeNull();
    expect(invoiceNoError('T123456789012')).not.toBeNull();
    expect(invoiceNoError('1234567890123')).not.toBeNull();
    expect(invoiceNoError('T12345678901234')).not.toBeNull();
  });

  it('登録番号の全角・小文字・区切りをそろえる', () => {
    expect(normalizeInvoiceNo(' ｔ１２３４-５６７８-９０１２３ ')).toBe('T1234567890123');
  });

  it('SNS・URL は https:// か http:// で始まる。空の行は保存しない', () => {
    expect(linkError({ label: '', url: '' })).toBeNull();
    expect(linkError({ label: 'Instagram', url: 'https://instagram.com/x' })).toBeNull();
    expect(linkError({ label: 'Instagram', url: '' })).toBe('URL を入力してください');
    expect(linkError({ label: '', url: 'instagram.com/x' })).toBe(
      'URL は https:// から入力してください',
    );
    expect(
      cleanLinks([
        { label: ' A ', url: ' https://a ' },
        { label: '', url: '' },
        { label: '', url: 'https://b' },
      ]),
    ).toEqual([
      { label: 'A', url: 'https://a' },
      { label: '', url: 'https://b' },
    ]);
  });

  it('定型ボタン：円は 1 円以上、% は 1〜100、表示名は 12 文字まで', () => {
    expect(presetError({ label: '', kind: 'yen', value: 100 })).toBeNull();
    expect(presetError({ label: '', kind: 'yen', value: 0 })).not.toBeNull();
    expect(presetError({ label: '', kind: 'percent', value: 101 })).not.toBeNull();
    expect(presetError({ label: 'あ'.repeat(13), kind: 'yen', value: 1 })).not.toBeNull();
    expect(presetAutoLabel('yen', 100)).toBe('100円引き');
    expect(presetAutoLabel('percent', 15)).toBe('15%引き');
  });
});
