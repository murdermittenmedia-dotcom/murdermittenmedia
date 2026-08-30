import { Gift, Coins } from "lucide-react";
import { GIFT_EMOJIS, RARITY_BORDER, RARITY_LABEL } from "@/lib/gifts";

type GiftType = { id: number; name: string; emoji?: string | null; coinCost: number; rarity?: string | null; description?: string | null };

type Props = {
  giftTypes?: GiftType[];
  balance: number;
  isAuthenticated: boolean;
  isPending?: boolean;
  onSend: (giftTypeId: number) => void;
};

export default function GiftPanel({ giftTypes = [], balance, isAuthenticated, isPending = false, onSend }: Props) {
  return (
    <section className="border-t border-white/10 pt-3" aria-label="Send a gift">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-white/40"><Gift className="h-3 w-3" /> Send a Gift</span>
        <span className="flex items-center gap-1 text-xs text-yellow-400"><Coins className="h-3 w-3" />{balance.toLocaleString()}<span className="text-white/30">coins</span></span>
      </div>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 scrollbar-thin" role="list">
        {giftTypes.map((gift) => {
          const rarity = gift.rarity || "common";
          const emoji = GIFT_EMOJIS[gift.name] || gift.emoji || "🎁";
          const canAfford = isAuthenticated && balance >= gift.coinCost;
          const border = RARITY_BORDER[rarity] || RARITY_BORDER.common;
          return (
            <button key={gift.id} type="button" role="listitem" onClick={() => onSend(gift.id)} disabled={!canAfford || isPending} title={gift.description || gift.name} aria-label={`Send ${gift.name} for ${gift.coinCost} coins`} className={`group flex min-w-[82px] shrink-0 flex-col items-center gap-0.5 rounded-lg border bg-white/5 px-3 py-2 transition ${canAfford ? `${border} cursor-pointer hover:bg-white/10` : "cursor-not-allowed border-white/5 opacity-40"}`}>
              <span className="text-xl" aria-hidden="true">{emoji}</span>
              <span className={`text-xs font-semibold ${RARITY_LABEL[rarity] || "text-white/70"}`}>{gift.name}</span>
              <span className="text-xs text-yellow-400/70">{gift.coinCost} 🪙</span>
            </button>
          );
        })}
        {giftTypes.length === 0 && <p className="px-2 text-xs text-white/30">Gifts are unavailable right now.</p>}
      </div>
    </section>
  );
}

export { GiftPanel };
