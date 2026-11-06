import { QrCode } from '../../components/QrCode';
import type { Transaction } from '../../domain/types';
import { discountLabel, formatDateTime, formatYen } from '../../lib/format';
import styles from './ReceiptView.module.css';

/**
 * レシートの中身（02-画面設計 S-02、要件定義 F-06）
 * 店名などは、会計したときに取引へ保存した内容を使う（03-データ設計 DD-2）。
 * 空欄の項目は表示しない。SNS・URL は QR コードを付ける。
 */
export function ReceiptView({ tx }: { tx: Transaction }) {
  const { receipt } = tx;
  const hasReduced = tx.lines.some((l) => l.taxRate === 8);
  const voided = tx.status === 'voided';

  return (
    <article className={styles.receipt} aria-label="レシート">
      {voided && (
        <div className={styles.voidStamp} aria-label="取消">
          取消
        </div>
      )}
      <header className={styles.head}>
        {receipt.shopName && <p className={styles.shop}>{receipt.shopName}</p>}
        {receipt.invoiceNo && <p>登録番号 {receipt.invoiceNo}</p>}
      </header>
      <div className={styles.meta}>
        <p>{tx.eventName}</p>
        <p>{formatDateTime(tx.createdAt)}</p>
        <p>No. {tx.receiptNo}</p>
      </div>

      <hr className={styles.rule} />
      <ul className={styles.lines}>
        {tx.lines.map((l) => (
          <li key={l.lineNo}>
            <div className={styles.row}>
              <span className={styles.name}>
                {l.productName}
                {l.taxRate === 8 && '※'} ×{l.qty}
              </span>
              <span>{formatYen(l.grossAmount)}</span>
            </div>
            {l.lineDiscount && l.lineDiscountAmount > 0 && (
              <div className={`${styles.row} ${styles.sub}`}>
                <span>{discountLabel(l.lineDiscount)}</span>
                <span>-{formatYen(l.lineDiscountAmount)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {tx.orderDiscount && tx.orderDiscountAmount > 0 && (
        <div className={styles.row}>
          <span>{discountLabel(tx.orderDiscount, '全体値引き')}</span>
          <span>-{formatYen(tx.orderDiscountAmount)}</span>
        </div>
      )}

      <hr className={styles.rule} />
      <div className={`${styles.row} ${styles.totalRow}`}>
        <span>合計</span>
        <span>{formatYen(tx.total)}</span>
      </div>
      {tx.taxes.map((t) => (
        <div key={t.rate} className={`${styles.row} ${styles.sub}`}>
          <span>（{t.rate}%対象</span>
          <span>
            {formatYen(t.taxableAmount)} 内税 {formatYen(t.taxAmount)}）
          </span>
        </div>
      ))}
      <div className={styles.row}>
        <span>お預かり</span>
        <span>{formatYen(tx.tendered)}</span>
      </div>
      <div className={styles.row}>
        <span>お釣り</span>
        <span>{formatYen(tx.change)}</span>
      </div>
      {hasReduced && <p className={styles.note}>※は軽減税率対象</p>}

      {(receipt.contact || receipt.footer || receipt.links.length > 0) && (
        <hr className={styles.rule} />
      )}
      {receipt.contact && <p className={styles.contact}>{receipt.contact}</p>}
      {receipt.links.length > 0 && (
        <ul className={styles.links}>
          {receipt.links.map((link, i) => (
            <li key={i} className={styles.link}>
              <QrCode text={link.url} label={`${link.label || link.url}の QR コード`} size={96} />
              <span className={styles.linkText}>
                {link.label && <strong>{link.label}</strong>}
                <span className={styles.url}>{link.url}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {receipt.footer && <p className={styles.footer}>{receipt.footer}</p>}
    </article>
  );
}
