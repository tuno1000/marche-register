import { useState } from 'react';
import { Link } from 'react-router';
import { Header } from '../../components/Header';
import { Segmented } from '../../components/Segmented';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { getSettings, updateSettings } from '../../db/kv';
import type { Rounding, Settings } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';
import { errorMessage } from '../../lib/errorMessage';
import { ROUNDING_LABELS } from '../../lib/format';
import { DataSettings } from './DataSettings';
import { ReceiptSettings } from './ReceiptSettings';
import styles from './SettingsScreen.module.css';

const THEME_OPTIONS = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
] as const;

/** S-07 設定 */
export function SettingsScreen() {
  const settings = useSettings();
  // 復元・全データ削除のあと、入力欄を新しい設定で作り直す（番号を変えて作り直し、値は読み直したものを使う）
  const [reloaded, setReloaded] = useState<{ revision: number; settings: Settings } | null>(null);
  const reloadForm = async () => {
    const fresh = await getSettings();
    setReloaded((r) => ({ revision: (r?.revision ?? 0) + 1, settings: fresh }));
  };

  const save = (patch: Partial<Settings>) => {
    updateSettings(patch)
      .then(() => showToast('保存しました'))
      .catch((e: unknown) => showToast(errorMessage(e)));
  };

  return (
    <>
      <Header title="設定" backTo="/more" />
      <div className={ui.body}>
        {settings && (
          <>
            <ReceiptSettings
              key={reloaded?.revision ?? 0}
              settings={settings}
              initial={reloaded?.settings ?? settings}
            />

            <section className={ui.section} aria-labelledby="settings-discount">
              <h2 id="settings-discount" className={ui.sectionTitle}>
                値引き
              </h2>
              <div className={styles.row}>
                <label htmlFor="settings-rounding">端数処理の初期選択</label>
                <select
                  id="settings-rounding"
                  className={`${ui.select} ${styles.control}`}
                  value={settings.defaultRounding}
                  onChange={(e) => save({ defaultRounding: e.target.value as Rounding })}
                >
                  {(Object.keys(ROUNDING_LABELS) as Rounding[]).map((r) => (
                    <option key={r} value={r}>
                      {ROUNDING_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <ul className={ui.list}>
                <li>
                  <Link to="/settings/discounts" className={ui.row}>
                    <span className={ui.rowMain}>
                      <span className={ui.rowTitle}>定型ボタン</span>
                      <span className={ui.rowSub}>{settings.discountPresets.length} 件</span>
                    </span>
                    <span aria-hidden="true">▶</span>
                  </Link>
                </li>
              </ul>
            </section>

            <DataSettings onReplaced={() => void reloadForm()} />

            <section className={ui.section} aria-labelledby="settings-display">
              <h2 id="settings-display" className={ui.sectionTitle}>
                表示
              </h2>
              <div className={styles.row}>
                <span>テーマ</span>
                <div className={styles.control}>
                  <Segmented
                    label="テーマ"
                    options={THEME_OPTIONS}
                    value={settings.theme}
                    onChange={(theme) => save({ theme })}
                  />
                </div>
              </div>
            </section>
          </>
        )}

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>アプリ</h2>
          <p className={styles.row}>
            <span>バージョン</span>
            <span>{__APP_VERSION__}</span>
          </p>
        </section>

        {import.meta.env.DEV && <DevTools />}
      </div>
    </>
  );
}

/** 開発用サーバーだけに出す（05-実装計画 2 章） */
function DevTools() {
  const [busy, setBusy] = useState(false);
  const seed = async () => {
    setBusy(true);
    try {
      const { seedDummyData } = await import('../../dev/seed');
      await seedDummyData();
      showToast('ダミーデータを作りました');
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>開発用</h2>
      <button type="button" className={ui.button} onClick={() => void seed()} disabled={busy}>
        ダミーの商品とイベントを作る
      </button>
    </section>
  );
}
