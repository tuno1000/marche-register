import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { getKv } from '../db/kv';
import { useCartStore } from '../features/checkout/cartStore';
import { isStandalone } from '../lib/device';
import styles from './AppBanners.module.css';
import { usePwaStore } from './pwaStore';

/**
 * ヘッダーの下に出すお知らせ（02-画面設計 1.4）
 * - 更新のお知らせ：カートに商品が入っている間と、お預かり画面にいる間は出さない
 * - インストール警告：ホーム画面から起動しておらず、「このまま使う」を選んだとき
 */
export function AppBanners() {
  const applyUpdate = usePwaStore((s) => s.applyUpdate);
  const cartHasItems = useCartStore((s) => (s.cart?.lines.length ?? 0) > 0);
  const { pathname } = useLocation();
  const dismissed = useLiveQuery(async () => (await getKv('installWarningDismissed')) ?? false);
  const [updating, setUpdating] = useState(false);

  const showUpdate =
    applyUpdate !== null && !cartHasItems && pathname !== '/tender' && pathname !== '/install';
  const showBrowserWarning = dismissed === true && !isStandalone() && pathname !== '/install';

  if (!showUpdate && !showBrowserWarning) return null;
  return (
    <div className={styles.banners}>
      {showUpdate && (
        <div className={styles.update} role="status">
          <span>新しいバージョンがあります</span>
          <button
            type="button"
            className={styles.updateButton}
            disabled={updating}
            onClick={() => {
              setUpdating(true);
              void applyUpdate();
            }}
          >
            {updating ? '更新中…' : '更新'}
          </button>
        </div>
      )}
      {showBrowserWarning && (
        <div className={styles.warning}>
          <span>ブラウザで開いています</span>
          <Link to="/install" className={styles.warningLink}>
            ホーム画面に追加するには
          </Link>
        </div>
      )}
    </div>
  );
}
