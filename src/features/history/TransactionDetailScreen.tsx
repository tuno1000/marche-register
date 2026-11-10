import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Header } from '../../components/Header';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { getTransaction, voidTransaction } from '../../db/repositories/transactions';
import { useGoBack } from '../../hooks/useGoBack';
import { errorMessage } from '../../lib/errorMessage';
import { formatYen } from '../../lib/format';
import { PrintButton } from '../receipt/PrintButton';
import { ReceiptView } from '../receipt/ReceiptView';

/** S-03a 取引詳細（S-02 と同じレシートに［取消］を加える） */
export function TransactionDetailScreen() {
  const { txId } = useParams();
  const tx = useLiveQuery(
    async () => (txId ? ((await getTransaction(txId)) ?? null) : null),
    [txId],
  );
  const [confirm, setConfirm] = useState(false);
  const goBack = useGoBack('/history');

  const doVoid = async () => {
    setConfirm(false);
    if (!tx) return;
    try {
      await voidTransaction(tx.id);
      showToast('取り消しました');
      goBack();
    } catch (e) {
      showToast(errorMessage(e, '取り消せませんでした'));
    }
  };

  return (
    <>
      <Header title="取引詳細" backTo="/history" />
      {tx === null && <p className={ui.empty}>取引が見つかりません。</p>}
      {tx && (
        <>
          <div className={ui.body}>
            <ReceiptView tx={tx} />
          </div>
          <div className={ui.footer}>
            <PrintButton />
            {/* 取り消した取引には［取消］を出さない */}
            {tx.status === 'valid' && (
              <button
                type="button"
                className={`${ui.button} ${ui.danger} ${ui.large}`}
                onClick={() => setConfirm(true)}
              >
                この取引を取り消す
              </button>
            )}
          </div>
          <ConfirmDialog
            open={confirm}
            title="取引を取り消しますか？"
            message={`取引 ${tx.receiptNo}（${formatYen(tx.total)}）を取り消します。在庫は戻ります。元に戻せません。`}
            confirmLabel="取り消す"
            danger
            onConfirm={() => void doVoid()}
            onCancel={() => setConfirm(false)}
          />
        </>
      )}
    </>
  );
}
