import { useState } from "react";
import { Coins } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import BuyCoinsModal from "@/components/BuyCoinsModal";

export default function CoinBalance() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data, isLoading } = trpc.coins.getBalance.useQuery(undefined, {
    enabled: Boolean(user),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 text-[10px] border border-yellow-500/25 text-yellow-300/80 px-3 py-2 hover:border-yellow-400/70 hover:text-yellow-200 transition-all uppercase tracking-widest font-semibold"
        title="Buy Coins"
        aria-label="Buy coins"
      >
        <Coins className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{isLoading ? "Coins" : `${(data?.balance ?? 0).toLocaleString()} Coins`}</span>
      </button>
      <BuyCoinsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { CoinBalance };

// Keep this component intentionally presentational: coin purchases and balances remain server-authoritative.
// The /coins destination contains the existing purchase flow and balance history.
void Coins;
void useAuth;
void trpc;
