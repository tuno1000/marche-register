import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { CategoryDot } from '../../components/CategoryDot';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Header } from '../../components/Header';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import {
  countProductsByCategory,
  createCategory,
  deleteCategory,
  listCategories,
  moveCategory,
  updateCategory,
} from '../../db/repositories/categories';
import { CATEGORY_COLORS, type Category, type CategoryColor } from '../../domain/types';
import { errorMessage } from '../../lib/errorMessage';
import styles from './CategoriesScreen.module.css';

const NAME_MAX = 20;

/** シートで編集している内容。category が null なら新規 */
interface Draft {
  category: Category | null;
  name: string;
  color: CategoryColor;
}

/** S-05c カテゴリ一覧・編集 */
export function CategoriesScreen() {
  const data = useLiveQuery(async () => ({
    categories: await listCategories(),
    counts: await countProductsByCategory(),
  }));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = data?.categories ?? [];
  const productCount = (id: string) => data?.counts.get(id) ?? 0;

  const openNew = () => {
    // まだ使っていない色を先に選んでおく
    const used = new Set(categories.map((c) => c.color));
    const color =
      CATEGORY_COLORS.find((c) => !used.has(c)) ??
      CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]!;
    setError(null);
    setDraft({ category: null, name: '', color });
  };

  const openEdit = (category: Category) => {
    setError(null);
    setDraft({ category, name: category.name, color: category.color });
  };

  const close = () => setDraft(null);

  const save = async () => {
    if (!draft) return;
    if (draft.name.trim() === '') {
      setError('カテゴリ名を入力してください');
      return;
    }
    try {
      if (draft.category) {
        await updateCategory(draft.category.id, { name: draft.name, color: draft.color });
      } else {
        await createCategory({ name: draft.name, color: draft.color });
      }
      showToast('保存しました');
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const askDelete = () => {
    if (!draft?.category) return;
    if (productCount(draft.category.id) > 0) {
      setError('先に商品を別のカテゴリへ移してください');
      return;
    }
    setConfirmDelete(true);
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!draft?.category) return;
    try {
      await deleteCategory(draft.category.id);
      showToast('削除しました');
      close();
    } catch (e) {
      setError(errorMessage(e, '削除できませんでした'));
    }
  };

  const move = (id: string, direction: -1 | 1) => {
    moveCategory(id, direction).catch((e: unknown) => showToast(errorMessage(e)));
  };

  return (
    <>
      <Header title="カテゴリ" backTo="/more" />
      <div className={ui.body}>
        {data && categories.length === 0 && (
          <p className={ui.empty}>カテゴリがまだありません。まずカテゴリを追加してください。</p>
        )}
        {categories.length > 0 && (
          <ul className={ui.list}>
            {categories.map((c, i) => (
              <li key={c.id} className={ui.rowWithActions}>
                <button
                  type="button"
                  className={ui.row}
                  onClick={() => openEdit(c)}
                  aria-label={`${c.name}を編集`}
                >
                  <CategoryDot color={c.color} size={20} />
                  <span className={ui.rowMain}>
                    <span className={ui.rowTitle}>{c.name}</span>
                    <span className={ui.rowSub}>商品 {productCount(c.id)}</span>
                  </span>
                </button>
                <span className={ui.moveButtons}>
                  <button
                    type="button"
                    className={ui.button}
                    onClick={() => move(c.id, -1)}
                    disabled={i === 0}
                    aria-label={`${c.name}を上へ`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={ui.button}
                    onClick={() => move(c.id, 1)}
                    disabled={i === categories.length - 1}
                    aria-label={`${c.name}を下へ`}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={ui.footer}>
        <button
          type="button"
          className={`${ui.button} ${ui.primary} ${ui.large}`}
          onClick={openNew}
        >
          ＋ カテゴリを追加
        </button>
      </div>

      <BottomSheet
        open={draft !== null}
        title={draft?.category ? 'カテゴリを編集' : 'カテゴリを追加'}
        onClose={close}
      >
        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className={ui.field}>
              <label className={ui.label} htmlFor="category-name">
                カテゴリ名
              </label>
              <input
                id="category-name"
                className={ui.input}
                value={draft.name}
                maxLength={NAME_MAX}
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className={ui.field}>
              <span className={ui.label} id="category-color">
                色
              </span>
              <div className={styles.palette} role="radiogroup" aria-labelledby="category-color">
                {CATEGORY_COLORS.map((color, i) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === color}
                    aria-label={`色 ${i + 1}`}
                    className={styles.swatch}
                    style={{ background: `var(--cat-${color})` }}
                    onClick={() => setDraft({ ...draft, color })}
                  >
                    {draft.color === color ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className={ui.error} role="alert" style={{ marginTop: 'var(--space-3)' }}>
                {error}
              </p>
            )}
            <div className={styles.sheetButtons}>
              <button type="submit" className={`${ui.button} ${ui.primary} ${ui.large}`}>
                保存
              </button>
              {draft.category && (
                <button type="button" className={`${ui.button} ${ui.danger}`} onClick={askDelete}>
                  このカテゴリを削除する
                </button>
              )}
            </div>
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="カテゴリを削除しますか？"
        message={draft?.category ? `「${draft.category.name}」を削除します。` : undefined}
        confirmLabel="削除する"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
