import { Link } from 'react-router';
import { Header } from '../../components/Header';
import styles from './MoreScreen.module.css';

const groups = [
  [
    { to: '/products', label: '商品' },
    { to: '/categories', label: 'カテゴリ' },
    { to: '/events', label: 'イベント・持ち込み在庫' },
  ],
  [{ to: '/settings', label: '設定' }],
];

/** S-05 その他メニュー */
export function MoreScreen() {
  return (
    <>
      <Header title="その他" />
      <div className={styles.body}>
        {groups.map((items, i) => (
          <ul key={i} className={styles.group}>
            {items.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={styles.item}>
                  <span>{item.label}</span>
                  <span aria-hidden="true">▶</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </>
  );
}
