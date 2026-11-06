import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { showToast } from '../../components/Toast';
import { setCurrentEventId } from '../../db/kv';
import type { MarketEvent } from '../../domain/types';
import { errorMessage } from '../../lib/errorMessage';
import { useCartStore } from '../checkout/cartStore';

/**
 * 現在のイベントを切り替える。カートに商品が入っていたら、
 * 「カートを空にして切り替えますか？」と確かめる（02-画面設計 S-01）
 */
export function useSwitchEvent(): { switchTo: (event: MarketEvent) => void; dialog: ReactNode } {
  const cart = useCartStore((s) => s.cart);
  const [pending, setPending] = useState<MarketEvent | null>(null);

  const run = async (event: MarketEvent) => {
    try {
      const current = useCartStore.getState().cart;
      if (current && current.eventId !== event.id) useCartStore.getState().clear();
      await setCurrentEventId(event.id);
      showToast(`「${event.name}」を現在のイベントにしました`);
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const switchTo = (event: MarketEvent) => {
    if (cart && cart.lines.length > 0 && cart.eventId !== event.id) setPending(event);
    else void run(event);
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title="カートを空にして切り替えますか？"
      message="会計中の商品がカートに入っています。"
      confirmLabel="空にして切り替える"
      danger
      onConfirm={() => {
        const event = pending;
        setPending(null);
        if (event) void run(event);
      }}
      onCancel={() => setPending(null)}
    />
  );

  return { switchTo, dialog };
}
