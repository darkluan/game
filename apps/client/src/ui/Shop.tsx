import { tr } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { ITEM_LIST, itemPrice, ITEMS } from '@game/core';
import type { GameSession, HudState } from '@/lib/session';
import { describeItem } from './heroText';
import { GameIcon } from './icons/GameIcon';

/** The hero's bag. Items can be sold back by clicking them while the shop is open. */
export function ItemBag({ hud, game, columns }: { hud: HudState; game: GameSession; columns: number }) {
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={tr('Túi đồ')}
    >
      {Array.from({ length: hud.itemSlots }, (_, i) => {
        const item = ITEMS[hud.items[i]];
        if (!item) {
          return <span key={i} className="h-9 rounded-sm border border-dashed border-border" />;
        }
        return (
          <button
            key={i}
            type="button"
            disabled={!hud.canShop}
            title={`${tr(item.name)}: ${describeItem(item.stats)}${hud.canShop ? ` · ${tr('bấm để bán lại nửa giá')}` : ''}`}
            onClick={() => game.send({ t: 'sell', slotIndex: i })}
            className="flex h-9 items-center justify-center rounded-sm text-gold border border-border bg-background px-1 text-[10px] enabled:cursor-pointer enabled:hover:border-danger"
          >
            <GameIcon id={item.id} className="size-7" />
          </button>
        );
      })}
    </div>
  );
}

/** The shop closes by itself after this long without the player touching it. */
const IDLE_CLOSE_MS = 3000;

/** The item shop. Buying only works at the fountain or while waiting to respawn. */
export function ShopPanel({ hud, game, onClose }: { hud: HudState; game: GameSession; onClose: () => void }) {
  const full = hud.items.length >= hud.itemSlots;
  // Opens on what suits this hero, like the shops of other games of the kind; everything is one tab away.
  const [tab, setTab] = useState<'recommended' | 'all'>('recommended');
  const listed = tab === 'recommended' ? hud.recommended.map((id) => ITEMS[id]) : ITEM_LIST;
  // Closes itself when left alone, so it never sits over the fight. Every touch starts the wait again.
  const [activity, setActivity] = useState(0);
  const lastActivity = useRef(0);
  useEffect(() => {
    const timer = window.setTimeout(onClose, IDLE_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [activity, onClose]);
  const stayOpen = (event: { timeStamp: number }) => {
    // Moving the pointer fires constantly; restarting the wait a few times a second is enough.
    if (event.timeStamp - lastActivity.current < 250) return;
    lastActivity.current = event.timeStamp;
    setActivity((n) => n + 1);
  };
  return (
    <section
      onPointerMove={stayOpen}
      onPointerDown={stayOpen}
      onWheel={stayOpen}
      aria-label={tr('Cửa hàng')}
      className="pointer-events-auto absolute top-12 right-2 z-20 flex max-h-[70vh] w-80 max-w-[92vw] flex-col gap-2 rounded-lg hud-sheet p-3"
    >
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">{tr('Cửa hàng')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr('Đóng cửa hàng')}
          className="cursor-pointer px-2 text-muted-foreground"
        >
          ✕
        </button>
      </header>
      <p className={`text-xs ${hud.canShop ? 'text-hp' : 'text-danger'}`}>
        {hud.canShop
          ? full
            ? tr('Túi đồ đã đầy. Bấm vào một món trong túi để bán.')
            : tr('Đang ở đền: mua được.')
          : tr('Chỉ mua bán được khi đứng ở đền của đội mình.')}
      </p>
      <div role="tablist" className="flex gap-1.5 text-xs">
        {(['recommended', 'all'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 cursor-pointer rounded-md border px-2 py-1 font-semibold ${tab === id ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
          >
            {id === 'recommended' ? tr('Gợi ý cho {hero}', { hero: hud.heroName.split(',')[0] }) : tr('Tất cả')}
          </button>
        ))}
      </div>
      <ul onScroll={stayOpen} className="flex flex-col gap-1 overflow-y-auto">
        {listed.map((item, i) => {
          const price = itemPrice(item.id, hud.discount);
          const owned = tab === 'recommended' && hud.items.includes(item.id);
          const next = tab === 'recommended' && hud.suggestion?.id === item.id;
          const can = hud.canShop && !full && !owned && hud.gold >= price;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={!can}
                onClick={() => game.send({ t: 'buy', itemId: item.id })}
                className={`flex w-full items-center justify-between gap-2 rounded-sm border bg-background px-2 py-1 text-left text-xs enabled:cursor-pointer enabled:hover:border-primary disabled:opacity-50 ${next ? 'border-gold' : 'border-border'}`}
              >
                {/* The build is bought in order: the number is the step, the tick an item already owned. */}
                {tab === 'recommended' && (
                  <span className={`w-4 text-center font-bold ${owned ? 'text-hp' : 'text-muted-foreground'}`}>
                    {owned ? '✓' : i + 1}
                  </span>
                )}
                <GameIcon id={item.id} className="size-8 shrink-0 text-gold" />
                <span className="flex-1">
                  <span className="font-semibold">{tr(item.name)}</span>
                  <span className="block text-muted-foreground">{describeItem(item.stats)}</span>
                </span>
                <span className="font-semibold text-gold tabular-nums">{price}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
