import { AppError } from '../domain/errors';
import { CATEGORY_COLORS, TAX_RATES, type CategoryColor, type TaxRate } from '../domain/types';

/** 名前：前後の空白を除いて 1〜max 文字 */
export function validName(value: string, max: number, label: string): string {
  const name = value.trim();
  if (name.length === 0 || [...name].length > max) {
    throw new AppError('INVALID_INPUT', `${label}は 1〜${max} 文字で入力してください`);
  }
  return name;
}

export function validNonNegativeInt(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AppError('INVALID_INPUT', `${label}は 0 以上の整数で入力してください`);
  }
  return value;
}

export function validTaxRate(value: number): TaxRate {
  if (!(TAX_RATES as readonly number[]).includes(value)) {
    throw new AppError('INVALID_INPUT', '税率は 8% か 10% を選んでください');
  }
  return value as TaxRate;
}

export function validColor(value: string): CategoryColor {
  if (!(CATEGORY_COLORS as readonly string[]).includes(value)) {
    throw new AppError('INVALID_INPUT', '色を選んでください');
  }
  return value as CategoryColor;
}

export function validDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  if (!m || !d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    throw new AppError('INVALID_INPUT', '開催日を正しく入力してください');
  }
  return value;
}
