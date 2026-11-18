import { useState } from "react";
import { ArrowUp, Music2 } from "lucide-react";
import { ReviewPaymentProof } from "@/components/ReviewPaymentProof";

export type ReviewUpgradeChoice = {
  kind: "none" | "skip" | "full_song" | "full_song_skip";
  method: "Stripe" | "Cash App" | "PayPal";
  receiptUrl: string;
};
export function ReviewSubmissionAddOns({ choice, onChange, mode, fullSongPriceCents, busy = false, onBusyChange, submissionId, onPay, skipBalance = 0 }: {
  choice: ReviewUpgradeChoice;
  onChange: (choice: ReviewUpgradeChoice) => void;
  mode: string;
  fullSongPriceCents: number;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  submissionId?: number | null;
  onPay?: () => void;
  skipBalance?: number;
}) {
  const [proofBusy, setProofBusy] = useState(false);
  const disabled = busy || proofBusy;
  const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const fullPrice = Math.max(0, fullSongPriceCents);
  const options = [
    { kind: "none" as const, title: "Standard queue", amount: 0, description: mode === "90sec" ? "Free submission · 90-second review" : "Free submission · normal queue" },
    { kind: "skip" as const, title: "Add a line skip", amount: 1000, description: "Behind already-approved skips. Never interrupts the song playing." },
    ...(mode === "90sec" && fullPrice > 0 ? [
      { kind: "full_song" as const, title: "Hear the full song", amount: fullPrice, description: "Remove the 90-second cutoff for this track." },
      { kind: "full_song_skip" as const, title: "Full song + line skip", amount: fullPrice + 1000, description: "Full playback and priority in the waiting line." },
    ] : []),
  ];
  const selected = options.find((option) => option.kind === choice.kind);
  return <section className="space-y-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-300"><ArrowUp className="h-4 w-4" /> Want to move up?</p><p className="mt-1 text-xs leading-relaxed text-white/50">{mode === "90sec" ? "We’re in 90-second mode. Add full-song playback, a line skip, or both." : "Add a line skip with Cash App, PayPal, or secure Stripe checkout."}</p></div>{skipBalance > 0 && <span className="shrink-0 rounded-full border border-amber-300/30 px-2 py-1 text-[10px] text-amber-200">{skipBalance} skips saved</span>}</div>
    <div className="space-y-2" role="radiogroup" aria-label="Optional review add-ons">
      {options.map((option) => <label key={option.kind} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${choice.kind === option.kind ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-black/15"}`}>
        <input type="radio" name="review-upgrade" value={option.kind} checked={choice.kind === option.kind} disabled={disabled} onChange={() => onChange({ ...choice, kind: option.kind })} className="mt-1 accent-amber-300" />
        <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-xs font-bold text-white"><span>{option.title}</span><span className="shrink-0 text-amber-200">{option.amount ? money(option.amount) : "Free"}</span></span><span className="mt-1 block text-[10px] leading-relaxed text-white/45">{option.description}</span></span>
      </label>)}
    </div>
    {choice.kind !== "none" && selected && <div className="space-y-3 border-t border-white/10 pt-3">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Payment method">
        {(["Cash App", "PayPal", "Stripe"] as const).map((method) => <button key={method} type="button" disabled={disabled} aria-pressed={choice.method === method} onClick={() => onChange({ ...choice, method, receiptUrl: choice.method === method ? choice.receiptUrl : "" })} className={`rounded-lg border px-3 py-2.5 text-xs font-bold disabled:opacity-40 ${choice.method === method ? method === "Cash App" ? "border-[#00D632]/60 bg-[#00D632]/15 text-[#00D632]" : method === "PayPal" ? "border-blue-400/60 bg-blue-400/15 text-blue-200" : "border-[#635bff]/60 bg-[#635bff]/20 text-white" : "border-white/15 text-white/50"}`}>{method}</button>)}
      </div>
      {choice.method !== "Stripe" ? <ReviewPaymentProof method={choice.method} receiptUrl={choice.receiptUrl} onChange={(receiptUrl) => onChange({ ...choice, receiptUrl })} amountCents={selected.amount} busy={busy} onBusyChange={(value) => { setProofBusy(value); onBusyChange?.(value); }} /> : <p className="text-[10px] leading-relaxed text-white/45">{submissionId ? "Secure checkout applies only to this submitted track." : "Submit first, then we’ll open secure checkout for this exact track. If checkout is canceled, your track stays in the standard queue."}</p>}
      {submissionId && onPay && <button type="button" disabled={disabled} onClick={onPay} className="w-full rounded-lg bg-red-600 px-3 py-3 text-xs font-bold uppercase text-white disabled:opacity-40">{disabled ? "Please wait…" : choice.method === "Stripe" ? `Open Stripe — ${money(selected.amount)}` : "Submit receipt for admin approval"}</button>}
    </div>}
    <p className="flex gap-1.5 text-[10px] leading-relaxed text-white/35"><Music2 className="h-3 w-3 shrink-0" />Add-ons never increase the two-submissions-per-day cap.</p>
  </section>;
}
