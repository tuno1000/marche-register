import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Header } from '../../components/Header';
import { Segmented } from '../../components/Segmented';
import ui from '../../components/ui.module.css';
import { listAllTransactions, listTransactions } from '../../db/repositories/transactions';
import { summarizeEvent, summarizeProducts, type ProductSortKey } from '../../domain/summary';
import { formatYen } from '../../lib/format';
import { EventSelectBar, useViewingEvent } from '../events/EventSelect';
import styles from './SummaryScreen.module.css';

type Tab = 'event' | 'product';
const TAB_OPTIONS = [
  { value: 'event', label: 'イベント別' },
  { value: 'product', label: '商品別' },
] as const;
const SORT_OPTIONS = [
  { value: 'qty', label: '数量順' },
  { value: 'amount', label: '金額順' },
] as const;

/** ほかの画面から戻っても、同じタブと並べ替えにする */
let lastTab: Tab = 'event';
let lastSort: ProductSortKey = 'qty';

/** S-04 集計 */
export function SummaryScreen() {
  const [tab, setTabState] = useState<Tab>(lastTab);
  const [sort, setSortState] = useState<ProductSortKey>(lastSort);
  // 「全イベント」は商品別のときだけ選べる
  const viewing = useViewingEvent(tab === 'product');
  const eventId = viewing.event?.id;
  const all = viewing.allEvents;

  // 選び直した直後に前のイベントの結果を出さないよう、どのイベントの結果かを一緒に持つ
  const key = all ? 'all' : (eventId ?? null);
  const result = useLiveQuery(
    async () =>
      key === null
        ? null
        : { key, list: await (key === 'all' ? listAllTransactions() : listTransactions(key)) },
    [key],
  );
  const transactions = result && result.key === key ? result.list : undefined;

  const setTab = (t: Tab) => {
    lastTab = t;
    setTabState(t);
  };
  const setSort = (s: ProductSortKey) => {
    lastSort = s;
    setSortState(s);
  };

  return (
    <>
      <Header title="集計" />
      <EventSelectBar viewing={viewing} allowAll={tab === 'product'} />
      <div className={ui.body}>
        <Segmented label="集計の種類" options={TAB_OPTIONS} value={tab} onChange={setTab} />
        {viewing.events?.length === 0 && <p className={ui.empty}>イベントがまだありません。</p>}
        {transactions && viewing.event && (
          <div className={styles.content}>
            {tab === 'event' ? (
              <EventTab transactions={transactions} />
            ) : (
              <>
                <Segmented
                  label="並べ替え"
                  options={SORT_OPTIONS}
                  value={sort}
                  onChange={setSort}
                />
                <ProductTab transactions={transactions} sort={sort} />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function EventTab({ transactions }: { transactions: Parameters<typeof summarizeEvent>[0] }) {
  const s = summarizeEvent(transactions);
  return (
    <>
      <dl className={styles.stats}>
        <Stat label="売上合計" value={formatYen(s.salesTotal)} strong />
        <Stat label="取引件数" value={`${s.transactionCount} 件`} />
        <Stat
          label="客単価"
          value={s.averagePerCustomer === null ? '—' : formatYen(s.averagePerCustomer)}
        />
        <Stat
          label="値引き合計"
          value={s.discountTotal > 0 ? `-${formatYen(s.discountTotal)}` : formatYen(0)}
        />
        <Stat label="取消" value={`${s.voidedCount} 件`} />
      </dl>
      {s.taxes.length > 0 && (
        <table className={styles.table}>
          <caption className={ui.sectionTitle}>税率別</caption>
          <thead>
            <tr>
              <th scope="col">税率</th>
              <th scope="col">対象</th>
              <th scope="col">内税</th>
            </tr>
          </thead>
          <tbody>
            {s.taxes.map((t) => (
              <tr key={t.rate}>
                <th scope="row">{t.rate}%</th>
                <td>{formatYen(t.taxableAmount)}</td>
                <td>{formatYen(t.taxAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd className={strong ? styles.strong : undefined}>{value}</dd>
    </div>
  );
}

function ProductTab({
  transactions,
  sort,
}: {
  transactions: Parameters<typeof summarizeProducts>[0];
  sort: ProductSortKey;
}) {
  const rows = summarizeProducts(transactions, sort);
  if (rows.length === 0) return <p className={ui.empty}>まだ売れた商品がありません。</p>;
  return (
    <table className={styles.table} aria-label="商品別">
      <thead>
        <tr>
          <th scope="col">商品</th>
          <th scope="col">数量</th>
          <th scope="col">金額</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.productId}>
            <th scope="row">{r.productName}</th>
            <td>{r.qty}</td>
            <td>{formatYen(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
