import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Header } from '../../components/Header';
import { Segmented } from '../../components/Segmented';
import { showToast } from '../../components/Toast';
import ui from '../../components/ui.module.css';
import { updateSettings } from '../../db/kv';
import {
  MAX_PRESETS,
  PRESET_LABEL_MAX,
  presetAutoLabel,
  presetError,
} from '../../domain/settingsRules';
import type { DiscountPreset } from '../../domain/types';
import { useSettings } from '../../hooks/useSettings';
import { errorMessage } from '../../lib/errorMessage';
import { digitsOnly } from '../../lib/format';
import { newId } from '../../lib/id';
import styles from './DiscountPresetsScreen.module.css';

const KIND_OPTIONS = [
  { value: 'yen', label: '円' },
  { value: 'percent', label: '%' },
] as const;
const SCOPE_OPTIONS = [
  { value: 'line', label: '商品ごと' },
  { value: 'order', label: '会計全体' },
  { value: 'both', label: '両方' },
] as const;
const SCOPE_LABELS: Record<DiscountPreset['scope'], string> = {
  line: '商品ごと',
  order: '会計全体',
  both: '両方',
};

interface Draft {
  /** null なら新規 */
  id: string | null;
  label: string;
  kind: DiscountPreset['kind'];
  value: string;
  scope: DiscountPreset['scope'];
}

/** S-07a 値引き定型ボタン編集 */
export function DiscountPresetsScreen() {
  const settings = useSettings();
  const presets = settings?.discountPresets ?? [];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const full = presets.length >= MAX_PRESETS;

  const savePresets = async (next: DiscountPreset[], message: string) => {
    try {
      await updateSettings({ discountPresets: next });
      showToast(message);
      return true;
    } catch (e) {
      showToast(errorMessage(e));
      return false;
    }
  };

  const openNew = () => {
    setError(null);
    setDraft({ id: null, label: '', kind: 'yen', value: '', scope: 'both' });
  };

  const openEdit = (p: DiscountPreset) => {
    setError(null);
    setDraft({ id: p.id, label: p.label, kind: p.kind, value: String(p.value), scope: p.scope });
  };

  const save = async () => {
    if (!draft) return;
    const value = Number(draft.value || '0');
    const found = presetError({ label: draft.label, kind: draft.kind, value });
    if (found) {
      setError(found);
      return;
    }
    const preset: DiscountPreset = {
      id: draft.id ?? newId(),
      // 表示名を入れなかったら「100円引き」のように付ける
      label: draft.label.trim() || presetAutoLabel(draft.kind, value),
      kind: draft.kind,
      value,
      scope: draft.scope,
    };
    const next = draft.id
      ? presets.map((p) => (p.id === draft.id ? preset : p))
      : [...presets, preset];
    if (await savePresets(next, '保存しました')) setDraft(null);
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!draft?.id) return;
    if (
      await savePresets(
        presets.filter((p) => p.id !== draft.id),
        '削除しました',
      )
    ) {
      setDraft(null);
    }
  };

  const move = (i: number, direction: -1 | 1) => {
    const next = [...presets];
    const [item] = next.splice(i, 1);
    next.splice(i + direction, 0, item!);
    void savePresets(next, '並べ替えました');
  };

  return (
    <>
      <Header title="値引きの定型ボタン" backTo="/settings" />
      <div className={ui.body}>
        {settings && presets.length === 0 && <p className={ui.empty}>定型ボタンがありません。</p>}
        {presets.length > 0 && (
          <ul className={ui.list}>
            {presets.map((p, i) => (
              <li key={p.id} className={ui.rowWithActions}>
                <button
                  type="button"
                  className={ui.row}
                  onClick={() => openEdit(p)}
                  aria-label={`${p.label}を編集`}
                >
                  <span className={ui.rowMain}>
                    <span className={ui.rowTitle}>{p.label}</span>
                    <span className={ui.rowSub}>
                      {p.kind === 'yen' ? `${p.value} 円` : `${p.value} %`}・{SCOPE_LABELS[p.scope]}
                    </span>
                  </span>
                </button>
                <span className={ui.moveButtons}>
                  <button
                    type="button"
                    className={ui.button}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`${p.label}を上へ`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={ui.button}
                    onClick={() => move(i, 1)}
                    disabled={i === presets.length - 1}
                    aria-label={`${p.label}を下へ`}
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
        {full && <p className={ui.hint}>定型ボタンは {MAX_PRESETS} 件までです。</p>}
        <button
          type="button"
          className={`${ui.button} ${ui.primary} ${ui.large}`}
          onClick={openNew}
          disabled={!settings || full}
        >
          ＋ 追加
        </button>
      </div>

      <BottomSheet
        open={draft !== null}
        title={draft?.id ? '定型ボタンを編集' : '定型ボタンを追加'}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className={ui.field}>
              <label className={ui.label} htmlFor="preset-label">
                表示名
              </label>
              <input
                id="preset-label"
                className={ui.input}
                value={draft.label}
                maxLength={PRESET_LABEL_MAX}
                placeholder={
                  draft.value ? presetAutoLabel(draft.kind, Number(draft.value)) : '例：100円引き'
                }
                autoComplete="off"
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
              <p className={ui.hint}>空のままなら「100円引き」のように付けます</p>
            </div>
            <div className={ui.field}>
              <span className={ui.label}>種類と値</span>
              <div className={styles.valueRow}>
                <div className={styles.kind}>
                  <Segmented
                    label="種類"
                    options={KIND_OPTIONS}
                    value={draft.kind}
                    onChange={(kind) => setDraft({ ...draft, kind })}
                  />
                </div>
                <input
                  className={ui.input}
                  value={draft.value}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={draft.kind === 'yen' ? '値引き額（円）' : '値引き率（%）'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      value: digitsOnly(e.target.value).replace(/^0+(?=\d)/, ''),
                    })
                  }
                />
              </div>
            </div>
            <div className={ui.field}>
              <span className={ui.label}>使える対象</span>
              <Segmented
                label="使える対象"
                options={SCOPE_OPTIONS}
                value={draft.scope}
                onChange={(scope) => setDraft({ ...draft, scope })}
              />
            </div>
            {error && (
              <p className={ui.error} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={`${ui.button} ${ui.primary} ${ui.large}`}>
              保存
            </button>
            {draft.id && (
              <button
                type="button"
                className={`${ui.button} ${ui.danger}`}
                onClick={() => setConfirmDelete(true)}
              >
                この定型ボタンを削除する
              </button>
            )}
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="定型ボタンを削除しますか？"
        message={draft ? `「${draft.label}」を削除します。` : undefined}
        confirmLabel="削除する"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
