import type { HeldNavigation } from '../app/BackGuard';
import { ConfirmDialog } from './ConfirmDialog';

/** 入力途中で戻ろうとしたときの確認 */
export function DiscardDialog({
  held,
  onDone,
}: {
  held: HeldNavigation | null;
  onDone: () => void;
}) {
  return (
    <ConfirmDialog
      open={held !== null}
      title="変更を破棄しますか？"
      message="入力した内容は保存されません。"
      confirmLabel="破棄する"
      cancelLabel="編集を続ける"
      danger
      guardBack={false}
      onConfirm={() => {
        held?.proceed();
        onDone();
      }}
      onCancel={() => {
        held?.reset();
        onDone();
      }}
    />
  );
}
