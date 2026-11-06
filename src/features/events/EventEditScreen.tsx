import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useParams } from 'react-router';
import { useAllowNextNavigation, useBackGuard, type HeldNavigation } from '../../app/BackGuard';
import { CategoryDot } from '../../components/CategoryDot';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DiscardDialog } from '../../components/DiscardDialog';
import { Header, HeaderAction } from '../../components/Header';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { getCurrentEventId, setCurrentEventId } from '../../db/kv';
import { listCategories } from '../../db/repositories/categories';
import {
  deleteEvent,
  getEvent,
  hasTransactions,
  listEventStocks,
  saveEvent,
  soldQtyByProduct,
} from '../../db/repositories/events';
import { listProducts } from '../../db/repositories/products';
import type { Id, MarketEvent } from '../../domain/types';
import { useGoBack } from '../../hooks/useGoBack';
import { errorMessage } from '../../lib/errorMessage';
import { digitsOnly, todayString } from '../../lib/format';
import { requestPersistentStorage } from '../../lib/storage';
import { groupByCategory } from '../products/grouping';
import styles from './EventEditScreen.module.css';

const NAME_MAX = 40;

interface Form {
  name: string;
  date: string;
  location: string;
  memo: string;
}

interface Initial {
  event: MarketEvent | null;
  form: Form;
  /** 商品 ID → 持ち込み数（保存されているもの） */
  stocks: Map<Id, number>;
}

/** S-06a イベント編集・持ち込み在庫（/events/new と /events/:id） */
export function EventEditScreen() {
  const { id } = useParams();
  const initial = useLiveQuery(() => loadInitial(id), [id]);

  if (initial === undefined) {
    return <Header title={id ? 'イベント編集' : 'イベントを追加'} backTo="/events" />;
  }
  if (initial === null) {
    return (
      <>
        <Header title="イベント編集" backTo="/events" />
        <p className={ui.empty}>イベントが見つかりません。</p>
      </>
    );
  }
  return <EventForm key={id ?? 'new'} initial={initial} />;
}

async function loadInitial(id: string | undefined): Promise<Initial | null> {
  if (!id) {
    return {
      event: null,
      form: { name: '', date: todayString(), location: '', memo: '' },
      stocks: new Map(),
    };
  }
  const event = await getEvent(id);
  if (!event) return null;
  const stocks = await listEventStocks(id);
  return {
    event,
    form: { name: event.name, date: event.date, location: event.location, memo: event.memo },
    stocks: new Map(stocks.map((s) => [s.productId, s.broughtQty])),
  };
}

function EventForm({ initial }: { initial: Initial }) {
  const { event } = initial;
  const isNew = event === null;
  const [form, setForm] = useState<Form>(initial.form);
  const [qty, setQty] = useState<Map<Id, number>>(() => new Map(initial.stocks));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [held, setHeld] = useState<HeldNavigation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const goBack = useGoBack('/events');
  const allowNext = useAllowNextNavigation();

  // 販売数や取引の有無は、会計で変わるので保存されたら読み直す
  const live = useLiveQuery(
    async () => ({
      groups: groupByCategory(
        await listCategories(),
        // 在庫を管理する、販売中の商品だけ（02-画面設計 S-06a）
        (await listProducts()).filter((p) => p.tracksStock && p.isOnSale),
      ).filter((g) => g.products.length > 0),
      sold: event ? await soldQtyByProduct(event.id) : new Map<Id, number>(),
      hasTransactions: event ? await hasTransactions(event.id) : false,
      currentId: await getCurrentEventId(),
    }),
    [event?.id],
  );

  const qtyOf = (productId: Id) => qty.get(productId) ?? 0;
  const soldOf = (productId: Id) => live?.sold.get(productId) ?? 0;
  const targets = live?.groups.flatMap((g) => g.products) ?? [];

  const dirty =
    (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== initial.form[k]) ||
    targets.some((p) => qtyOf(p.id) !== (initial.stocks.get(p.id) ?? 0));

  useBackGuard(dirty && !saving, setHeld, { blockAll: true });

  const update = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const setProductQty = (productId: Id, value: number) => {
    setQty((m) => new Map(m).set(productId, Math.max(0, value)));
  };

  const belowSold = targets.filter((p) => qtyOf(p.id) < soldOf(p.id));

  const save = async () => {
    const found: typeof errors = {};
    if (form.name.trim() === '') found.name = 'イベント名を入力してください';
    if (form.date === '') found.date = '開催日を入力してください';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (belowSold.length > 0) {
      showToast('持ち込み数は販売数より少なくできません');
      return;
    }
    setSaving(true);
    try {
      await saveEvent(event?.id ?? null, form, new Map(targets.map((p) => [p.id, qtyOf(p.id)])));
      if (isNew) void requestPersistentStorage();
      showToast('保存しました');
      allowNext();
      goBack();
    } catch (e) {
      setSaving(false);
      showToast(errorMessage(e));
    }
  };

  const makeCurrent = async () => {
    if (!event) return;
    try {
      await setCurrentEventId(event.id);
      showToast('現在のイベントにしました');
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!event) return;
    try {
      await deleteEvent(event.id);
      showToast('削除しました');
      allowNext();
      goBack();
    } catch (e) {
      showToast(errorMessage(e, '削除できませんでした'));
    }
  };

  return (
    <>
      <Header
        title={isNew ? 'イベントを追加' : 'イベント編集'}
        backTo="/events"
        right={
          <HeaderAction onClick={() => void save()} disabled={saving}>
            保存
          </HeaderAction>
        }
      />
      <form className={ui.body} onSubmit={(e) => e.preventDefault()} noValidate>
        <section className={ui.section}>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="event-name">
              イベント名
            </label>
            <input
              id="event-name"
              className={ui.input}
              value={form.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={!!errors.name}
              onChange={(e) => update('name', e.target.value)}
            />
            {errors.name && <p className={ui.error}>{errors.name}</p>}
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="event-date">
              開催日
            </label>
            <input
              id="event-date"
              type="date"
              className={ui.input}
              value={form.date}
              aria-invalid={!!errors.date}
              onChange={(e) => update('date', e.target.value)}
            />
            {errors.date && <p className={ui.error}>{errors.date}</p>}
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="event-location">
              場所（任意）
            </label>
            <input
              id="event-location"
              className={ui.input}
              value={form.location}
              maxLength={NAME_MAX}
              autoComplete="off"
              onChange={(e) => update('location', e.target.value)}
            />
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="event-memo">
              メモ（任意）
            </label>
            <textarea
              id="event-memo"
              className={ui.textarea}
              value={form.memo}
              onChange={(e) => update('memo', e.target.value)}
            />
          </div>
        </section>

        <section className={ui.section} aria-labelledby="stock-title">
          <h2 id="stock-title" className={ui.sectionTitle}>
            持ち込み在庫
          </h2>
          {live && targets.length === 0 && (
            <p className={ui.hint}>「在庫を管理する」が ON の販売中の商品がありません。</p>
          )}
          {live?.groups.map(({ category, products }) => (
            <div key={category.id} className={styles.group}>
              <h3 className={styles.groupTitle}>
                <CategoryDot color={category.color} size={12} />
                {category.name}
              </h3>
              <ul className={ui.list}>
                {products.map((p) => {
                  const n = qtyOf(p.id);
                  const sold = soldOf(p.id);
                  return (
                    <li key={p.id} className={styles.stockRow}>
                      <span className={styles.stockName}>{p.name}</span>
                      <div className={styles.stockControls}>
                        <div className={styles.stepper}>
                          <button
                            type="button"
                            className={ui.button}
                            onClick={() => setProductQty(p.id, n - 1)}
                            disabled={n <= sold}
                            aria-label={`${p.name}を 1 減らす`}
                          >
                            －
                          </button>
                          <input
                            className={`${ui.input} ${styles.qty}`}
                            value={String(n)}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label={`${p.name}の持ち込み数`}
                            aria-invalid={n < sold}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              setProductQty(p.id, Number(digitsOnly(e.target.value)))
                            }
                          />
                          <button
                            type="button"
                            className={ui.button}
                            onClick={() => setProductQty(p.id, n + 1)}
                            aria-label={`${p.name}を 1 増やす`}
                          >
                            ＋
                          </button>
                        </div>
                        <span className={styles.counts}>
                          販売 {sold}・残 {Math.max(0, n - sold)}
                        </span>
                      </div>
                      {n < sold && <p className={ui.error}>販売数（{sold}）より少なくできません</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {!isNew && (
          <section className={`${ui.section} ${styles.actions}`}>
            {live?.currentId === event.id ? (
              <p className={ui.hint}>現在のイベントです</p>
            ) : (
              <button
                type="button"
                className={`${ui.button} ${ui.block}`}
                onClick={() => void makeCurrent()}
              >
                現在のイベントにする
              </button>
            )}
            {live && !live.hasTransactions && (
              <button
                type="button"
                className={`${ui.button} ${ui.danger} ${ui.block}`}
                onClick={() => setConfirmDelete(true)}
              >
                このイベントを削除する
              </button>
            )}
          </section>
        )}
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="イベントを削除しますか？"
        message={event ? `イベント「${event.name}」を削除します。元に戻せません。` : undefined}
        confirmLabel="削除する"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
      <DiscardDialog held={held} onDone={() => setHeld(null)} />
    </>
  );
}
