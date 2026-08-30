import { useState } from "react";
import { Coins, Check, ChevronRight, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Package = { coins: number; usdCents: number; label?: string; popular?: boolean };

type Props = { open: boolean; onClose: () => void };

export default function BuyCoinsModal({ open, onClose }: Props) {
  const [selected, setSelected] = useState<Package | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const requestPurchase = trpc.coins.requestPurchase.useMutation({
    onSuccess: () => { setSubmitted(true); toast.success("Purchase request sent for review."); },
    onError: (error) => toast.error(error.message),
  });

  if (!open) return null;
  const options = [
    { coins: 100, usdCents: 100, label: "Starter Pack", popular: false },
    { coins: 500, usdCents: 450, label: "Fan Pack", popular: true },
    { coins: 1200, usdCents: 1000, label: "Supporter", popular: false },
    { coins: 3000, usdCents: 2400, label: "VIP", popular: false },
  ] as Package[];
  const reset = () => { setSelected(null); setSubmitted(false); setPaymentNote(""); onClose(); };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Buy coins">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-yellow-400/20 bg-[#111] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div><p className="text-[10px] uppercase tracking-[0.25em] text-yellow-400/70">Live supporter wallet</p><h2 className="font-[Anton] text-2xl text-white">BUY COINS</h2><p className="text-xs text-white/40">Use coins for gifts, queue skips, and live support.</p></div>
          <button onClick={reset} className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close buy coins dialog"><X className="h-4 w-4" /></button>
        </div>
        {submitted ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6 text-center"><Check className="mx-auto mb-3 h-10 w-10 text-green-400" /><h3 className="text-lg font-semibold text-white">Request Sent</h3><p className="mt-2 text-sm text-white/50">Your request for {selected?.coins.toLocaleString()} coins was submitted. Coins are added after payment is confirmed.</p><Button onClick={reset} className="mt-5 bg-red-600 text-white hover:bg-red-700">Done</Button></div>
        ) : selected ? (
          <div className="space-y-4"><button onClick={() => setSelected(null)} className="text-xs text-white/50 hover:text-white">← Back to packages</button><div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs uppercase tracking-widest text-white/40">Selected package</p><p className="mt-1 font-[Anton] text-3xl text-yellow-400">{selected.coins.toLocaleString()} coins</p><p className="text-white/60">${(selected.usdCents / 100).toFixed(2)} · {selected.label}</p></div><p className="text-sm leading-relaxed text-white/50">Send payment via CashApp <strong className="text-yellow-400">$MittenMedia</strong> or PayPal <strong className="text-yellow-400">@MurderMittenPromo</strong>, then include the payment note below.</p><Input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Payment note / username" className="border-white/15 bg-white/5 text-white placeholder:text-white/25" /><Button disabled={requestPurchase.isPending} onClick={() => requestPurchase.mutate({ coins: selected.coins, amountCents: selected.usdCents, paymentNote: paymentNote || "Coins purchase" })} className="w-full bg-red-600 text-white hover:bg-red-700">{requestPurchase.isPending ? "Submitting…" : "Submit Purchase Request"}</Button></div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{options.map((pkg) => <button key={pkg.coins} onClick={() => setSelected(pkg)} className={`relative rounded-xl border p-4 text-left transition hover:border-yellow-400/60 ${pkg.popular ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-white/[0.03]"}`}>{pkg.popular && <span className="absolute right-3 top-3 text-[9px] font-bold uppercase tracking-widest text-yellow-300">Popular</span>}<Coins className="mb-2 h-4 w-4 text-yellow-400" /><p className="font-[Anton] text-2xl text-yellow-400">{pkg.coins.toLocaleString()}</p><p className="text-sm text-white/50">coins · ${(pkg.usdCents / 100).toFixed(2)}</p><p className="mt-1 text-xs text-white/30">{pkg.label}</p><ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-white/20" /></button>)}</div>
        )}
      </div>
    </div>
  );
}

export { BuyCoinsModal };
