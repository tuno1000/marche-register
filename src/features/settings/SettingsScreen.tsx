import { useState } from 'react';
import { Header } from '../../components/Header';
import { Segmented } from '../../components/Segmented';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { updateSettings } from '../../db/kv';
import type { Settings } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';
import { errorMessage } from '../../lib/errorMessage';
import styles from './SettingsScreen.module.css';

const THEME_OPTIONS = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
] as const;

/** S-07 設定（M2 ではテーマとバージョン。レシート・値引き・データは M5 で作る） */
export function SettingsScreen() {
  const settings = useSettings();

  const setTheme = (theme: Settings['theme']) => {
    updateSettings({ theme }).catch((e: unknown) => showToast(errorMessage(e)));
  };

  return (
    <>
      <Header title="設定" backTo="/more" />
      <div className={ui.body}>
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>表示</h2>
          <div className={styles.row}>
            <span>テーマ</span>
            {settings && (
              <div className={styles.control}>
                <Segmented
                  label="テーマ"
                  options={THEME_OPTIONS}
                  value={settings.theme}
                  onChange={setTheme}
                />
              </div>
            )}
          </div>
        </section>

        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>アプリ</h2>
          <p className={styles.row}>
            <span>バージョン</span>
            <span>{__APP_VERSION__}</span>
          </p>
        </section>

        <p className={ui.hint} style={{ marginTop: 'var(--space-5)' }}>
          レシート・値引き・データの設定は、M5 で作ります。
        </p>

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
