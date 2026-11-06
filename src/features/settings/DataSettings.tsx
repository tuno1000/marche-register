import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { getKv } from '../../db/kv';
import {
  createBackup,
  deleteAllData,
  markBackedUp,
  restoreBackup,
} from '../../db/repositories/backup';
import { listEvents } from '../../db/repositories/events';
import { listAllTransactions, listTransactions } from '../../db/repositories/transactions';
import { backupFileName, parseBackup, type BackupFile } from '../../domain/backup';
import { buildCsv, csvFileName } from '../../domain/csv';
import type { MarketEvent } from '../../domain/types';
import { errorMessage } from '../../lib/errorMessage';
import { saveFile } from '../../lib/file';
import { formatDateTime, formatEventDate } from '../../lib/format';
import { useCartStore } from '../checkout/cartStore';
import styles from './SettingsScreen.module.css';

/** 全データを削除するときに入力してもらう言葉（02-画面設計 S-07） */
const DELETE_WORD = '削除';

/** S-07 設定：データ（CSV、バックアップと復元、データの保護、全データ削除） */
export function DataSettings({ onReplaced }: { onReplaced: () => void }) {
  const data = useLiveQuery(async () => ({
    events: await listEvents(),
    lastBackupAt: (await getKv('lastBackupAt')) ?? null,
  }));
  const [csvOpen, setCsvOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const persisted = usePersisted();

  const run = async (task: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      showToast(errorMessage(e, failure));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (target: MarketEvent | 'all') =>
    run(async () => {
      setCsvOpen(false);
      const transactions =
        target === 'all' ? await listAllTransactions() : await listTransactions(target.id);
      const blob = new Blob([buildCsv(transactions)], { type: 'text/csv' });
      const name = csvFileName(
        target === 'all' ? 'all' : { eventName: target.name, eventDate: target.date },
      );
      if (await saveFile(blob, name)) showToast('CSV を書き出しました');
    }, '書き出せませんでした');

  const exportBackup = () =>
    run(async () => {
      const backup = await createBackup(__APP_VERSION__);
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      if (await saveFile(blob, backupFileName())) {
        await markBackedUp();
        showToast('バックアップしました');
      }
    }, 'バックアップできませんでした');

  const pickRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (result.ok) setRestoreTarget(result.backup);
    else showToast(result.message);
  };

  const restore = (backup: BackupFile) =>
    run(async () => {
      setRestoreTarget(null);
      await restoreBackup(backup);
      useCartStore.setState({ cart: null });
      onReplaced();
      showToast('復元しました');
    }, '復元できませんでした。今のデータはそのままです');

  const removeAll = () =>
    run(async () => {
      setDeleteOpen(false);
      setDeleteWord('');
      await deleteAllData();
      useCartStore.setState({ cart: null });
      onReplaced();
      showToast('全データを削除しました');
    }, '削除できませんでした');

  return (
    <section className={ui.section} aria-labelledby="settings-data">
      <h2 id="settings-data" className={ui.sectionTitle}>
        データ
      </h2>
      <ul className={ui.list}>
        <li>
          <button
            type="button"
            className={ui.row}
            onClick={() => setCsvOpen(true)}
            disabled={busy || !data || data.events.length === 0}
          >
            <span className={ui.rowMain}>CSV 書き出し</span>
            <span aria-hidden="true">▶</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={ui.row}
            onClick={() => void exportBackup()}
            disabled={busy}
          >
            <span className={ui.rowMain}>
              <span className={ui.rowTitle}>バックアップ（JSON）</span>
              <span className={ui.rowSub}>
                前回のバックアップ{' '}
                {data?.lastBackupAt ? formatDateTime(data.lastBackupAt) : 'まだありません'}
              </span>
            </span>
            <span aria-hidden="true">▶</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className={ui.row}
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <span className={ui.rowMain}>復元（JSON）</span>
            <span aria-hidden="true">▶</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="復元するファイル"
            onChange={(e) => {
              void pickRestoreFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </li>
      </ul>

      <div className={styles.row}>
        <span>データの保護</span>
        {persisted.state === 'on' && <span className={styles.ok}>有効 ✓</span>}
        {persisted.state === 'unsupported' && (
          <span className={ui.hint}>この端末では使えません</span>
        )}
        {persisted.state === 'off' && (
          <button type="button" className={ui.button} onClick={() => void persisted.request()}>
            有効にする
          </button>
        )}
      </div>
      <p className={styles.warning}>
        ⚠ ホーム画面のアイコンを削除すると、データも消えます。削除する前に JSON
        バックアップを取ってください。
      </p>
      <button
        type="button"
        className={`${ui.button} ${ui.danger} ${ui.block}`}
        onClick={() => setDeleteOpen(true)}
        disabled={busy}
      >
        全データを削除
      </button>

      <BottomSheet open={csvOpen} title="CSV に書き出すイベント" onClose={() => setCsvOpen(false)}>
        <ul className={ui.list}>
          <li>
            <button type="button" className={ui.row} onClick={() => void exportCsv('all')}>
              <span className={ui.rowMain}>
                <span className={ui.rowTitle}>全イベント</span>
              </span>
            </button>
          </li>
          {data?.events.map((e) => (
            <li key={e.id}>
              <button type="button" className={ui.row} onClick={() => void exportCsv(e)}>
                <span className={ui.rowMain}>
                  <span className={ui.rowTitle}>{e.name}</span>
                  <span className={ui.rowSub}>{formatEventDate(e.date)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <ConfirmDialog
        open={restoreTarget !== null}
        title="このバックアップで復元しますか？"
        message={
          restoreTarget && (
            <>
              <dl className={styles.summary}>
                <div>
                  <dt>バックアップした日時</dt>
                  <dd>{formatDateTime(Date.parse(restoreTarget.exportedAt))}</dd>
                </div>
                <div>
                  <dt>商品</dt>
                  <dd>{restoreTarget.counts.products} 件</dd>
                </div>
                <div>
                  <dt>イベント</dt>
                  <dd>{restoreTarget.counts.events} 件</dd>
                </div>
                <div>
                  <dt>取引</dt>
                  <dd>{restoreTarget.counts.transactions} 件</dd>
                </div>
              </dl>
              <p className={styles.danger}>今のデータはすべて置き換わります。</p>
            </>
          )
        }
        confirmLabel="復元する"
        danger
        onConfirm={() => restoreTarget && void restore(restoreTarget)}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="全データを削除しますか？"
        message={
          <>
            <p>商品、イベント、取引、設定がすべて消えます。元に戻せません。</p>
            <label className={ui.label} htmlFor="delete-word">
              確認のため「{DELETE_WORD}」と入力してください
            </label>
            <input
              id="delete-word"
              className={ui.input}
              value={deleteWord}
              autoComplete="off"
              onChange={(e) => setDeleteWord(e.target.value)}
            />
          </>
        }
        confirmLabel="削除する"
        danger
        confirmDisabled={deleteWord.trim() !== DELETE_WORD}
        onConfirm={() => void removeAll()}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteWord('');
        }}
      />
    </section>
  );
}

/** データの保護（navigator.storage.persist）の状態（04-技術設計 5.4） */
function usePersisted() {
  const [state, setState] = useState<'checking' | 'on' | 'off' | 'unsupported'>('checking');

  useEffect(() => {
    let cancelled = false;
    const storage = navigator.storage;
    if (!storage?.persisted) {
      Promise.resolve().then(() => !cancelled && setState('unsupported'));
    } else {
      void storage
        .persisted()
        .then((on) => !cancelled && setState(on ? 'on' : 'off'))
        .catch(() => !cancelled && setState('unsupported'));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const request = async () => {
    try {
      const on = await navigator.storage.persist();
      setState(on ? 'on' : 'off');
      if (!on) {
        showToast('ブラウザが許可しませんでした。ホーム画面から起動して、もう一度お試しください');
      }
    } catch {
      setState('unsupported');
    }
  };

  return { state, request };
}
