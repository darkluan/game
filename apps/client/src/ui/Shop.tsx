import { HEROES, ITEM_LIST, itemPrice, ITEMS } from '@game/core';
import type { GameSession, HudState } from '@/lib/session';
import { describeItem } from './heroText';

/** The hero's bag. Items can be sold back by clicking them while the shop is open. */
export function ItemBag({ hud, game }: { hud: HudState; game: GameSession }) {
  return (
    <div className="flex gap-1" aria-label="Túi đồ">
      {Array.from({ length: hud.itemSlots }, (_, i) => {
        const item = ITEMS[hud.items[i]];
        if (!item) {
          return <span key={i} className="h-8 flex-1 rounded-sm border border-dashed border-border" />;
        }
        return (
          <button
            key={i}
            type="button"
            disabled={!hud.canShop}
            title={`${item.name}: ${describeItem(item.stats)}${hud.canShop ? ' · bấm để bán lại nửa giá' : ''}`}
            onClick={() => game.send({ t: 'sell', slotIndex: i })}
            className="h-8 flex-1 truncate rounded-sm border border-border bg-background px-1 text-[10px] enabled:cursor-pointer enabled:hover:border-danger"
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

/** The item shop. Buying only works at the fountain or while waiting to respawn. */
export function ShopPanel({ hud, game, onClose }: { hud: HudState; game: GameSession; onClose: () => void }) {
  const def = HEROES[hud.heroDefId];
  const full = hud.items.length >= hud.itemSlots;
  return (
    <section
      aria-label="Cửa hàng"
      className="pointer-events-auto absolute top-16 left-3 flex max-h-[70vh] w-80 max-w-[92vw] flex-col gap-2 rounded-lg border border-border bg-panel p-3"
    >
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">Cửa hàng</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng cửa hàng"
          className="cursor-pointer px-2 text-muted-foreground"
        >
          ✕
        </button>
      </header>
      <p className={`text-xs ${hud.canShop ? 'text-hp' : 'text-danger'}`}>
        {hud.canShop
          ? full
            ? 'Túi đồ đã đầy. Bấm vào một món trong túi để bán.'
            : 'Đang ở đền: mua được.'
          : 'Chỉ mua bán được khi đứng ở đền của đội mình.'}
      </p>
      <ul className="flex flex-col gap-1 overflow-y-auto">
        {ITEM_LIST.map((item) => {
          const price = itemPrice(def, item.id);
          const can = hud.canShop && !full && hud.gold >= price;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={!can}
                onClick={() => game.send({ t: 'buy', itemId: item.id })}
                className="flex w-full items-center justify-between gap-2 rounded-sm border border-border bg-background px-2 py-1 text-left text-xs enabled:cursor-pointer enabled:hover:border-primary disabled:opacity-50"
              >
                <span>
                  <span className="font-semibold">{item.name}</span>
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
