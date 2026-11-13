import { CheckCircle, ExternalLink, Receipt } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export type ReviewPaymentRecord = {
  id: number; artistName: string; songTitle: string; status: string;
  skippedLine: boolean; skipPaymentConfirmed: boolean;
  isPaidSubmission?: boolean; paidSubmissionConfirmed?: boolean;
  paidSubmissionType?: string | null; cashappPaymentReceiptUrl?: string | null;
  stripePaymentSessionId?: string | null;
};

export function ReviewPaymentApprovals({ submissions }: { submissions: ReviewPaymentRecord[] }) {
  const utils = trpc.useUtils();
  const approvals = submissions.filter((song) => ["pending", "playing"].includes(song.status) &&
    ((song.skippedLine && !song.skipPaymentConfirmed) || (song.isPaidSubmission && !song.paidSubmissionConfirmed)));
  const approve = trpc.queue.approvePayment.useMutation({
    onSuccess: () => {
      void utils.queue.getAll.invalidate();
      void utils.queue.getReviewed.invalidate();
      toast.success("Payment approved — live queue updated");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <section className="rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-amber-200"><Receipt className="h-3.5 w-3.5" /> Payment review</p><h2 className="mt-1 font-['Anton'] text-xl uppercase text-white">Payment Approvals</h2></div>
        <span className="rounded-full border border-amber-300/30 px-2.5 py-1 text-[10px] font-bold text-amber-200">{approvals.length} pending</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">Verify payment before approving. Approvals do not charge anyone or interrupt the playing song.</p>
      <div className="mt-3 space-y-2">
        {approvals.map((song) => {
          const paidPending = !!song.isPaidSubmission && !song.paidSubmissionConfirmed;
          const label = paidPending ? (song.paidSubmissionType === "skip" ? "Paid entry + line skip" : "Paid entry / full-song review") : "Line skip";
          const receipt = song.cashappPaymentReceiptUrl;
          const receiptIsSafe = !!receipt && /^https?:\/\//i.test(receipt);
          return (
            <div key={song.id} className="rounded-lg border border-amber-300/15 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{song.songTitle}</p><p className="truncate text-[10px] text-white/40">{song.artistName}</p><p className="mt-1 text-[10px] font-bold text-amber-200">{label}</p></div>
                <button type="button" disabled={approve.isPending} onClick={() => approve.mutate({ id: song.id, kind: paidPending ? "paid_submission" : "skip" })} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-amber-300 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-black hover:bg-amber-200 disabled:opacity-40"><CheckCircle className="h-3 w-3" />{paidPending ? "Approve paid entry" : "Approve skip"}</button>
              </div>
              {receiptIsSafe ? <a href={receipt!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-300 underline">View payment receipt <ExternalLink className="h-3 w-3" /></a> : <p className="mt-2 text-[10px] text-white/35">{song.stripePaymentSessionId ? "Stripe checkout recorded. Verify the payment in Stripe." : "No receipt attached. Check the received payment manually."}</p>}
            </div>
          );
        })}
        {approvals.length === 0 && <p className="rounded-lg border border-white/5 bg-black/15 p-3 text-xs text-white/35">No payment requests awaiting approval.</p>}
      </div>
      <p className="mt-3 text-[10px] text-white/40">For a separate full-song payment, use Approve full song next to the track or under Now Playing.</p>
    </section>
  );
}
