import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BottomSheet } from '../../components/BottomSheet';
import { Header } from '../../components/Header';
import ui from '../../components/ui.module.css';
import { getCurrentEventId } from '../../db/kv';
import { listEvents } from '../../db/repositories/events';
import type { MarketEvent } from '../../domain/types';
import { formatEventDate } from '../../lib/format';
import styles from './EventsScreen.module.css';
import { useSwitchEvent } from './useSwitchEvent';

/** S-06 イベント一覧 */
export function EventsScreen() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => ({
    events: await listEvents(),
    currentId: await getCurrentEventId(),
  }));
  const [selected, setSelected] = useState<MarketEvent | null>(null);

  const { switchTo, dialog } = useSwitchEvent();

  const makeCurrent = (event: MarketEvent) => {
    setSelected(null);
    switchTo(event);
  };

  return (
    <>
      <Header title="イベント" backTo="/more" />
      <div className={ui.body}>
        {data && data.events.length === 0 && <p className={ui.empty}>イベントがまだありません。</p>}
        {data && data.events.length > 0 && (
          <ul className={ui.list}>
            {data.events.map((e) => (
              <li key={e.id}>
                <button type="button" className={ui.row} onClick={() => setSelected(e)}>
                  <span className={ui.rowMain}>
                    <span className={ui.rowTitle}>{e.name}</span>
                    <span className={ui.rowSub}>
                      {formatEventDate(e.date)}
                      {e.location && `・${e.location}`}
                    </span>
                  </span>
                  {e.id === data.currentId && (
                    <span className={`${ui.badge} ${ui.badgePrimary}`}>現在</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={ui.footer}>
        <Link to="/events/new" className={`${ui.button} ${ui.primary} ${ui.large}`}>
          ＋ イベントを追加
        </Link>
      </div>

      <BottomSheet
        open={selected !== null}
        title={selected?.name ?? ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className={styles.menu}>
            {selected.id === data?.currentId ? (
              <p className={ui.hint}>現在のイベントです</p>
            ) : (
              <button
                type="button"
                className={`${ui.button} ${ui.primary} ${ui.large}`}
                onClick={() => makeCurrent(selected)}
              >
                現在のイベントにする
              </button>
            )}
            <button
              type="button"
              className={`${ui.button} ${ui.large}`}
              onClick={() => {
                setSelected(null);
                void navigate(`/events/${selected.id}`);
              }}
            >
              編集・持ち込み在庫
            </button>
          </div>
        )}
      </BottomSheet>
      {dialog}
    </>
  );
}
