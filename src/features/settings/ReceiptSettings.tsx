import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { updateSettings } from '../../db/kv';
import {
  cleanLinks,
  invoiceNoError,
  linkError,
  MAX_LINKS,
  normalizeInvoiceNo,
} from '../../domain/settingsRules';
import type { ReceiptLink, Settings } from '../../domain/types';
import { errorMessage } from '../../lib/errorMessage';
import { ReceiptView } from '../receipt/ReceiptView';
import { sampleTransaction } from './sampleReceipt';
import styles from './SettingsScreen.module.css';

type TextKey = 'shopName' | 'contact' | 'footer';

/**
 * S-07 設定：レシートの項目。入力し終えたとき（フォーカスが外れたとき）に自動で保存する
 */
export function ReceiptSettings({
  settings,
  initial,
}: {
  /** 保存されている設定（変わったかどうかの比較とプレビューに使う） */
  settings: Settings;
  /** 入力欄の最初の値 */
  initial: Settings;
}) {
  const [text, setText] = useState({
    shopName: initial.shopName,
    contact: initial.contact,
    footer: initial.footer,
  });
  const [invoiceNo, setInvoiceNo] = useState(initial.invoiceNo);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [links, setLinks] = useState<ReceiptLink[]>(() =>
    Array.from({ length: MAX_LINKS }, (_, i) => initial.links[i] ?? { label: '', url: '' }),
  );
  const [linkErrors, setLinkErrors] = useState<(string | null)[]>([]);
  const [preview, setPreview] = useState(false);

  const save = async (patch: Partial<Settings>) => {
    try {
      await updateSettings(patch);
      showToast('保存しました');
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const saveText = (key: TextKey) => {
    const value = key === 'contact' ? text[key].trim() : text[key].trim().replace(/\s+/g, ' ');
    if (value !== text[key]) setText((t) => ({ ...t, [key]: value }));
    if (value !== settings[key]) void save({ [key]: value });
  };

  const saveInvoiceNo = () => {
    const value = normalizeInvoiceNo(invoiceNo);
    setInvoiceNo(value);
    const error = invoiceNoError(value);
    setInvoiceError(error);
    if (!error && value !== settings.invoiceNo) void save({ invoiceNo: value });
  };

  const saveLinks = () => {
    const errors = links.map(linkError);
    setLinkErrors(errors);
    if (errors.some((e) => e !== null)) return;
    const cleaned = cleanLinks(links);
    if (JSON.stringify(cleaned) !== JSON.stringify(settings.links)) void save({ links: cleaned });
  };

  const setLink = (i: number, patch: Partial<ReceiptLink>) =>
    setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const textField = (key: TextKey, label: string, multiline = false) => {
    const id = `settings-${key}`;
    const props = {
      id,
      value: text[key],
      onChange: (e: { target: { value: string } }) =>
        setText((t) => ({ ...t, [key]: e.target.value })),
      onBlur: () => saveText(key),
    };
    return (
      <div className={ui.field}>
        <label className={ui.label} htmlFor={id}>
          {label}
        </label>
        {multiline ? (
          <textarea className={ui.textarea} {...props} />
        ) : (
          <input className={ui.input} autoComplete="off" maxLength={60} {...props} />
        )}
      </div>
    );
  };

  return (
    <section className={ui.section} aria-labelledby="settings-receipt">
      <h2 id="settings-receipt" className={ui.sectionTitle}>
        レシート
      </h2>
      {textField('shopName', '店名')}
      <div className={ui.field}>
        <label className={ui.label} htmlFor="settings-invoice">
          登録番号（インボイス）
        </label>
        <input
          id="settings-invoice"
          className={ui.input}
          value={invoiceNo}
          placeholder="T1234567890123"
          autoComplete="off"
          inputMode="text"
          aria-invalid={invoiceError !== null}
          aria-describedby={invoiceError ? 'settings-invoice-error' : undefined}
          onChange={(e) => setInvoiceNo(e.target.value)}
          onBlur={saveInvoiceNo}
        />
        {invoiceError && (
          <p id="settings-invoice-error" className={ui.error}>
            {invoiceError}
          </p>
        )}
      </div>
      {textField('contact', '連絡先', true)}
      {links.map((link, i) => (
        <div key={i} className={ui.field}>
          <span className={ui.label}>SNS・URL {i + 1}</span>
          <div className={styles.linkRow}>
            <input
              className={`${ui.input} ${styles.linkLabel}`}
              value={link.label}
              placeholder="Instagram"
              aria-label={`SNS・URL ${i + 1} のラベル`}
              autoComplete="off"
              maxLength={20}
              onChange={(e) => setLink(i, { label: e.target.value })}
              onBlur={saveLinks}
            />
            <input
              className={ui.input}
              value={link.url}
              type="url"
              inputMode="url"
              placeholder="https://"
              aria-label={`SNS・URL ${i + 1} の URL`}
              aria-invalid={!!linkErrors[i]}
              autoComplete="off"
              autoCapitalize="none"
              onChange={(e) => setLink(i, { url: e.target.value })}
              onBlur={saveLinks}
            />
          </div>
          {linkErrors[i] && <p className={ui.error}>{linkErrors[i]}</p>}
        </div>
      ))}
      {textField('footer', 'フッター（例：ありがとうございました）')}
      <div className={ui.field}>
        <button type="button" className={ui.button} onClick={() => setPreview(true)}>
          レシートのプレビュー
        </button>
      </div>

      <BottomSheet open={preview} title="レシートのプレビュー" onClose={() => setPreview(false)}>
        <p className={ui.hint} style={{ marginBottom: 'var(--space-3)' }}>
          保存した内容で表示します（金額は見本です）。
        </p>
        <ReceiptView tx={sampleTransaction(settings)} />
      </BottomSheet>
    </section>
  );
}
