import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { Header } from '../../components/Header';
import ui from '../../components/ui.module.css';
import { listTransactions } from '../../db/repositories/transactions';
import { formatYen } from '../../lib/format';
import { EventSelectBar, useViewingEvent } from '../events/EventSelect';
import styles from './HistoryScreen.module.css';

const timeFormat = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' });

/** S-03 取引履歴 */
export function HistoryScreen() {
  const viewing = useViewingEvent();
  const eventId = viewing.event?.id;
  // 選び直した直後に前のイベントの結果を出さないよう、どのイベントの結果かを一緒に持つ
  const result = useLiveQuery(
    async () => (eventId ? { eventId, list: await listTransactions(eventId) } : null),
    [eventId],
  );
  const transactions = result && result.eventId === eventId ? result.list : undefined;

  return (
    <>
      <Header title="履歴" />
      <EventSelectBar viewing={viewing} />
      <div className={ui.body}>
        {viewing.events?.length === 0 && <p className={ui.empty}>イベントがまだありません。</p>}
        {transactions?.length === 0 && viewing.event && (
          <p className={ui.empty}>まだ取引がありません。</p>
        )}
        {transactions && transactions.length > 0 && (
          <ul className={ui.list}>
            {transactions.map((t) => {
              const voided = t.status === 'voided';
              const qty = t.lines.reduce((s, l) => s + l.qty, 0);
              return (
                <li key={t.id}>
                  <Link
                    to={`/history/${t.id}`}
                    className={`${ui.row} ${voided ? styles.voided : ''}`}
                  >
                    <span className={styles.no}>{t.receiptNo}</span>
                    <span className={styles.time}>{timeFormat.format(t.createdAt)}</span>
                    <span className={styles.qty}>{qty}点</span>
                    <span className={styles.total}>{formatYen(t.total)}</span>
                    {voided && <span className={ui.badge}>取消</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
