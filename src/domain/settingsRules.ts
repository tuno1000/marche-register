import { isValidPercent } from './discount';
import type { DiscountPreset, ReceiptLink } from './types';

/** 設定の入力チェック（02-画面設計 S-07、S-07a）。問題がなければ null */

export const MAX_LINKS = 3;
export const MAX_PRESETS = 8;
export const PRESET_LABEL_MAX = 12;

/** 登録番号：空、または「T＋13 桁」 */
export function invoiceNoError(value: string): string | null {
  if (value === '' || /^T\d{13}$/.test(value)) return null;
  return '登録番号は「T」と 13 桁の数字で入力してください（例：T1234567890123）';
}

/** 入力した登録番号をそろえる：前後の空白を除き、全角を半角に、小文字の t を T に */
export function normalizeInvoiceNo(value: string): string {
  return value
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/^t/, 'T')
    .replace(/[\s-]/g, '');
}

/** SNS・URL：URL は http:// か https:// で始まる */
export function linkError(link: ReceiptLink): string | null {
  if (link.label.trim() === '' && link.url.trim() === '') return null;
  if (link.url.trim() === '') return 'URL を入力してください';
  if (!/^https?:\/\/\S+$/.test(link.url.trim())) {
    return 'URL は https:// から入力してください';
  }
  return null;
}

/** 空の行を除いて、保存する形にする */
export function cleanLinks(links: readonly ReceiptLink[]): ReceiptLink[] {
  return links
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
    .filter((l) => l.label !== '' || l.url !== '')
    .slice(0, MAX_LINKS);
}

/** 値引きの定型ボタンのチェック */
export function presetError(
  preset: Pick<DiscountPreset, 'label' | 'kind' | 'value'>,
): string | null {
  if ([...preset.label.trim()].length > PRESET_LABEL_MAX) {
    return `表示名は ${PRESET_LABEL_MAX} 文字までにしてください`;
  }
  if (preset.kind === 'percent' && !isValidPercent(preset.value)) {
    return '% は 1〜100 で入力してください';
  }
  if (preset.kind === 'yen' && (!Number.isSafeInteger(preset.value) || preset.value < 1)) {
    return '金額は 1 円以上で入力してください';
  }
  return null;
}

/** 表示名を入れなかったときの名前：「100円引き」「10%引き」 */
export function presetAutoLabel(kind: DiscountPreset['kind'], value: number): string {
  return kind === 'yen' ? `${value}円引き` : `${value}%引き`;
}
