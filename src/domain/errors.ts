/** 画面に伝えるための、決まったエラー */
export type AppErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'EMPTY_CART'
  | 'PRODUCT_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_TENDER'
  | 'ALREADY_VOIDED'
  | 'CATEGORY_IN_USE'
  | 'EVENT_HAS_TRANSACTIONS'
  | 'BELOW_SOLD_QTY';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isAppError(e: unknown, code?: AppErrorCode): e is AppError {
  return e instanceof AppError && (code === undefined || e.code === code);
}
