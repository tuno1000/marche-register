import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { create } from 'zustand';
import { BottomSheet } from '../../components/BottomSheet';
import ui from '../../components/ui.module.css';
import { getCurrentEventId } from '../../db/kv';
import { listEvents } from '../../db/repositories/events';
import type { Id, MarketEvent } from '../../domain/types';
import { formatEventDate } from '../../lib/format';
import styles from './EventSelect.module.css';

/** 「全イベント」を選んだとき */
export const ALL_EVENTS = 'all';
export type EventSelection = Id | typeof ALL_EVENTS;

/**
 * 履歴と集計で「見ているイベント」。null なら現在のイベント。
 * 会計に使う「現在のイベント」は変えない。履歴と集計で同じイベントを見られるよう共有する
 */
const useViewingStore = create<{
  eventId: Id | null;
  allEvents: boolean;
  set: (eventId: Id | null, allEvents: boolean) => void;
}>((set) => ({
  eventId: null,
  allEvents: false,
  set: (eventId, allEvents) => set({ eventId, allEvents }),
}));

export interface ViewingEvent {
  /** 読み込み中は undefined */
  events: MarketEvent[] | undefined;
  /** 見ているイベント。イベントが 1 つもなければ null */
  event: MarketEvent | null;
  /** 「全イベント」を選んでいるか（allowAll のときだけ true になる） */
  allEvents: boolean;
  select: (selection: EventSelection) => void;
}

/** 見ているイベント。allowAll が false の画面では「全イベント」を選んでいても、イベントを返す */
export function useViewingEvent(allowAll = false): ViewingEvent {
  const { eventId, allEvents, set } = useViewingStore();
  const data = useLiveQuery(async () => ({
    events: await listEvents(),
    currentId: await getCurrentEventId(),
  }));
  const events = data?.events;
  const event =
    events?.find((e) => e.id === eventId) ??
    events?.find((e) => e.id === data?.currentId) ??
    events?.[0] ??
    null;
  return {
    events,
    event,
    allEvents: allowAll && allEvents,
    select: (selection) => (selection === ALL_EVENTS ? set(eventId, true) : set(selection, false)),
  };
}

/** 見ているイベントを表示し、タップで選び直すバー（02-画面設計 S-03、S-04） */
export function EventSelectBar({
  viewing,
  allowAll = false,
}: {
  viewing: ViewingEvent;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { events, event, allEvents } = viewing;
  if (!events || events.length === 0) return null;

  const label = allEvents
    ? '全イベント'
    : event
      ? `${event.name}・${formatEventDate(event.date)}`
      : '';
  const choose = (selection: EventSelection) => {
    viewing.select(selection);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={styles.bar}
        onClick={() => setOpen(true)}
        aria-label={`表示するイベント：${label}`}
      >
        <span className={styles.label}>{label}</span>
        <span aria-hidden="true">▼</span>
      </button>
      <BottomSheet open={open} title="表示するイベント" onClose={() => setOpen(false)}>
        <ul className={ui.list}>
          {allowAll && (
            <li>
              <button
                type="button"
                className={ui.row}
                aria-current={allEvents}
                onClick={() => choose(ALL_EVENTS)}
              >
                <span className={ui.rowMain}>
                  <span className={ui.rowTitle}>全イベント</span>
                </span>
                {allEvents && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          )}
          {events.map((e) => {
            const selected = !allEvents && e.id === event?.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className={ui.row}
                  aria-current={selected}
                  onClick={() => choose(e.id)}
                >
                  <span className={ui.rowMain}>
                    <span className={ui.rowTitle}>{e.name}</span>
                    <span className={ui.rowSub}>{formatEventDate(e.date)}</span>
                  </span>
                  {selected && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

/** テスト用：見ているイベントを初期状態に戻す */
export function resetViewingEvent(): void {
  useViewingStore.setState({ eventId: null, allEvents: false });
}
