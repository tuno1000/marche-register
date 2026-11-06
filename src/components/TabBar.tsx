import { NavLink } from 'react-router';
import styles from './TabBar.module.css';

const tabs = [
  { to: '/', label: '会計', icon: 'M4 6h16v12H4z M8 10h8 M8 14h5' },
  { to: '/history', label: '履歴', icon: 'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18' },
  { to: '/summary', label: '集計', icon: 'M5 20V10 M12 20V4 M19 20v-7' },
  { to: '/more', label: 'その他', icon: 'M5 12h.01 M12 12h.01 M19 12h.01' },
] as const;

/** 下部タブバー（02-画面設計 D-1） */
export function TabBar() {
  return (
    <nav className={styles.bar} aria-label="メイン">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
        >
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={tab.icon} />
          </svg>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
