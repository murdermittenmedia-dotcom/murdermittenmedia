import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function DeleteBeatButton({ id, title }: { id: number; title: string }) {
  const utils = trpc.useUtils();
  const remove = trpc.beats.producer.deleteBeat.useMutation({
    onSuccess: async () => {
      toast.success("Beat permanently deleted.");
      await Promise.all([utils.beats.producer.mine.invalidate(), utils.beats.invalidate()]);
    },
    onError: (error) => toast.error(error.message || "Could not delete this beat."),
  });
  const handleDelete = () => {
    if (remove.isPending) return;
    if (!window.confirm(`Permanently delete “${title}”? This cannot be undone.`)) return;
    void remove.mutateAsync({ id });
  };
  return <button type="button" onClick={handleDelete} disabled={remove.isPending} className="flex items-center gap-1 border border-red-500/25 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-300/75 hover:border-red-400 hover:text-red-200 disabled:opacity-40" title="Permanently delete this unsold beat">
    <Trash2 className="h-3 w-3" />{remove.isPending ? "Deleting…" : "Delete"}
  </button>;
}
