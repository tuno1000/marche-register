import { Outlet } from 'react-router';
import { TabBar } from '../components/TabBar';
import styles from './Layouts.module.css';

/** 下のタブを表示する画面の枠 */
export function TabLayout() {
  return (
    <div className={styles.root}>
      <div className={styles.screen}>
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}

/** 全画面で開く画面の枠 */
export function FullScreenLayout() {
  return (
    <div className={styles.root}>
      <div className={styles.screen}>
        <Outlet />
      </div>
    </div>
  );
}
