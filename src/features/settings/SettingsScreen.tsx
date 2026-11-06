import { Header } from '../../components/Header';
import { Placeholder } from '../../components/Placeholder';
import styles from './SettingsScreen.module.css';

/** S-07 設定（M0 ではバージョンの表示だけ） */
export function SettingsScreen() {
  return (
    <>
      <Header title="設定" backTo="/more" />
      <Placeholder screen="S-07 設定" milestone="M2・M5" />
      <section className={styles.section}>
        <h2 className={styles.heading}>アプリ</h2>
        <p className={styles.row}>
          <span>バージョン</span>
          <span>{__APP_VERSION__}</span>
        </p>
      </section>
    </>
  );
}
