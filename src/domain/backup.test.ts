import { describe, expect, it } from 'vitest';
import {
  arrayBufferToBase64,
  backupFileName,
  base64ToArrayBuffer,
  BACKUP_FORMAT_VERSION,
  buildBackup,
  localIsoString,
  MESSAGES,
  parseBackup,
  type BackupData,
} from './backup';

const settings = {
  shopName: '店',
  invoiceNo: '',
  contact: '',
  links: [],
  footer: '',
  defaultRounding: 'floor' as const,
  theme: 'light' as const,
  discountPresets: [],
};

const empty: BackupData = {
  categories: [],
  products: [],
  productImages: [],
  events: [],
  eventStocks: [],
  transactions: [],
  settings,
  currentEventId: null,
};

describe('JSON バックアップ', () => {
  it('書き出した内容は、そのまま読み戻せる', () => {
    const backup = buildBackup(
      {
        ...empty,
        categories: [{ id: 'c', name: 'A', color: 'c1', sortOrder: 1, createdAt: 1, updatedAt: 1 }],
        productImages: [
          { productId: 'p', mime: 'image/jpeg', width: 1, height: 1, base64: 'AQID' },
        ],
      },
      '0.5.0',
    );
    const result = parseBackup(JSON.stringify(backup));
    expect(result).toEqual({ ok: true, backup });
    expect(backup.counts).toEqual({ categories: 1, products: 0, events: 0, transactions: 0 });
  });

  it('JSON でない、形式が違う、中身が欠けている →「このアプリのバックアップファイルではありません」', () => {
    const bad = { ok: false, message: MESSAGES.notBackup };
    expect(parseBackup('こわれた{')).toEqual(bad);
    expect(parseBackup(JSON.stringify({ format: 'other', formatVersion: 1 }))).toEqual(bad);
    const backup = buildBackup(empty, '0.5.0');
    const broken = { ...backup, data: { ...backup.data, products: [{ id: 'x' }] } };
    expect(parseBackup(JSON.stringify(broken))).toEqual(bad);
  });

  it('今より新しい形式 →「アプリを最新にしてから復元してください」', () => {
    const backup = { ...buildBackup(empty, '9.0.0'), formatVersion: BACKUP_FORMAT_VERSION + 1 };
    expect(parseBackup(JSON.stringify(backup))).toEqual({ ok: false, message: MESSAGES.tooNew });
  });

  it('画像は Base64 にして、元に戻せる', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    const back = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(bytes.buffer)));
    expect(back).toEqual(bytes);
  });

  it('日時は端末の時差つき、ファイル名は日付と時刻', () => {
    const d = new Date(2026, 10, 3, 18, 20, 0);
    expect(localIsoString(d)).toMatch(/^2026-11-03T18:20:00[+-]\d{2}:\d{2}$/);
    expect(backupFileName(d)).toBe('marche-register-backup-20261103-1820.json');
  });
});
