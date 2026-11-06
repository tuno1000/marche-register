import { calculateCheckout } from '../../domain/checkout';
import type { Settings, Transaction } from '../../domain/types';

/**
 * レシートのプレビュー用の取引（03-データ設計 4.3 の計算例）。保存はしない
 */
export function sampleTransaction(settings: Settings, now: number = Date.now()): Transaction {
  const calc = calculateCheckout(
    [
      {
        productId: 'sample-1',
        productName: 'クッキー',
        categoryName: '焼き菓子',
        unitPrice: 300,
        taxRate: 8,
        qty: 2,
        discount: { kind: 'percent', value: 10, rounding: 'floor' },
      },
      {
        productId: 'sample-2',
        productName: 'マフィン',
        categoryName: '焼き菓子',
        unitPrice: 450,
        taxRate: 10,
        qty: 1,
        discount: null,
      },
    ],
    { kind: 'yen', value: 100 },
  );
  return {
    id: 'sample',
    eventId: 'sample',
    seq: 12,
    receiptNo: '1103-012',
    createdAt: now,
    status: 'valid',
    voidedAt: null,
    eventName: '○○マルシェ（見本）',
    eventDate: '2026-11-03',
    receipt: {
      shopName: settings.shopName,
      invoiceNo: settings.invoiceNo,
      contact: settings.contact,
      links: settings.links,
      footer: settings.footer,
    },
    ...calc,
    orderDiscount: { kind: 'yen', value: 100 },
    tendered: 1000,
    change: 1000 - calc.total,
  };
}
