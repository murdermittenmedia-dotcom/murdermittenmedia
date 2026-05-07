/* ============================================================
   MURDER MITTEN MEDIA — Admin Moderation Panel
   Only visible to admin accounts
   ============================================================ */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Shield, AlertTriangle, Clock, User, FileText, MessageSquare, Radio, Disc } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function timeAgo(date: Date | string) {
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return ""; }
}

// Confirmation dialog for destructive actions
function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  onConfirm,
  isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  onConfirm: (reason?: string) => void;
  isPending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-[#111] border border-red-600/30 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" /> {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-white/60 text-sm">{description}</p>
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest mb-1 block">Reason (optional)</label>
          <Input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. spam, harassment, off-topic..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
            maxLength={256}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 border-white/20 text-white/60" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            disabled={isPending}
            onClick={() => { onConfirm(reason || undefined); setOpen(false); }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminModeration() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"forum" | "chat" | "submissions" | "wheel" | "logs">("forum");

  // Data queries
  const { data: forumPosts, refetch: refetchForum } = trpc.forum.getPosts.useQuery({ limit: 50 }, { enabled: isAdmin });
  const { data: modLogs, refetch: refetchLogs } = trpc.moderation.getLogs.useQuery({ limit: 200 }, { enabled: isAdmin && activeTab === "logs" });
  const { data: queueData, refetch: refetchSubmissions } = trpc.queue.getAll.useQuery(undefined, { enabled: isAdmin && activeTab === "submissions" });
  const submissions = queueData?.submissions;
  const { data: wheelEntries, refetch: refetchWheel } = trpc.wheel.getAllEntries.useQuery(undefined, { enabled: isAdmin && activeTab === "wheel" });

  // Mutations
  const deleteForumPost = trpc.moderation.deleteForumPost.useMutation({
    onSuccess: () => { toast.success("Post deleted"); refetchForum(); utils.forum.getPosts.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteForumComment = trpc.moderation.deleteForumComment.useMutation({
    onSuccess: () => { toast.success("Comment deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const removeSubmission = trpc.moderation.removeSubmission.useMutation({
    onSuccess: () => { toast.success("Submission removed"); refetchSubmissions(); },
    onError: (e) => toast.error(e.message),
  });
  const removeWheelEntry = trpc.moderation.removeWheelEntry.useMutation({
    onSuccess: () => { toast.success("Wheel entry removed"); refetchWheel(); },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-white/50">Admin access required</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "forum", label: "Forum Posts", icon: <FileText className="w-4 h-4" /> },
    { id: "submissions", label: "Submissions", icon: <Disc className="w-4 h-4" /> },
    { id: "wheel", label: "Wheel Entries", icon: <Radio className="w-4 h-4" /> },
    { id: "logs", label: "Mod Logs", icon: <Clock className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 sticky top-16 z-10 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-red-600" />
            <div>
              <h1 className="font-['Anton'] text-2xl tracking-wider">
                ADMIN <span className="text-red-600">MODERATION</span>
              </h1>
              <p className="text-white/40 text-xs uppercase tracking-widest">Content management & audit trail</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 text-xs uppercase tracking-widest px-3 py-1.5 border transition-all font-semibold ${
                  activeTab === tab.id
                    ? "border-red-600 text-red-500 bg-red-600/10"
                    : "border-white/10 text-white/50 hover:border-white/30"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-6 max-w-5xl">

        {/* Forum Posts Tab */}
        {activeTab === "forum" && (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
              {forumPosts?.length ?? 0} posts — click delete to remove with confirmation
            </p>
            {forumPosts?.map(post => (
              <div key={post.id} className="border border-white/10 bg-white/[0.03] p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-white text-sm truncate">{post.title}</span>
                    <Badge variant="outline" className="text-xs border-white/20 text-white/50">{post.category}</Badge>
                    {'audioUrl' in post && post.audioUrl && (
                      <Badge variant="outline" className="text-xs border-red-600/40 text-red-400">🎵 Audio</Badge>
                    )}
                  </div>
                  <p className="text-white/40 text-xs line-clamp-1">{post.body}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author?.artistName ?? post.author?.name ?? "?"}</span>
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>ID: {post.id}</span>
                  </div>
                </div>
                <ConfirmDeleteDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-red-500/60 hover:text-red-500 hover:bg-red-900/20 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  }
                  title="Delete Forum Post"
                  description={`Delete "${post.title}"? This will also delete all comments on this post.`}
                  onConfirm={(reason) => deleteForumPost.mutate({ id: post.id, reason })}
                  isPending={deleteForumPost.isPending}
                />
              </div>
            ))}
            {!forumPosts?.length && (
              <div className="text-center py-12 text-white/30">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No forum posts</p>
              </div>
            )}
          </div>
        )}

        {/* Submissions Tab */}
        {activeTab === "submissions" && (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
              {submissions?.length ?? 0} active submissions
            </p>
            {submissions?.map((sub: NonNullable<typeof submissions>[number]) => (
              <div key={sub.id} className="border border-white/10 bg-white/[0.03] p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white text-sm">{sub.artistName}</span>
                    <span className="text-white/50 text-sm">— {sub.songTitle}</span>
                    <Badge variant="outline" className={`text-xs ${sub.status === "playing" ? "border-green-600/40 text-green-400" : "border-white/20 text-white/50"}`}>
                      {sub.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                    <span>{sub.submissionType}</span>
                    <span>{timeAgo(sub.createdAt)}</span>
                    <span>ID: {sub.id}</span>
                  </div>
                </div>
                <ConfirmDeleteDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-red-500/60 hover:text-red-500 hover:bg-red-900/20 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  }
                  title="Remove Submission"
                  description={`Remove "${sub.artistName} — ${sub.songTitle}"?`}
                  onConfirm={(reason) => removeSubmission.mutate({ id: sub.id, reason })}
                  isPending={removeSubmission.isPending}
                />
              </div>
            ))}
            {!submissions?.length && (
              <div className="text-center py-12 text-white/30">
                <Disc className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No active submissions</p>
              </div>
            )}
          </div>
        )}

        {/* Wheel Entries Tab */}
        {activeTab === "wheel" && (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
              {wheelEntries?.length ?? 0} wheel entries
            </p>
            {wheelEntries?.map(entry => (
              <div key={entry.id} className="border border-white/10 bg-white/[0.03] p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white text-sm">{entry.artistName}</span>
                    <span className="text-white/50 text-sm">— {entry.songTitle}</span>
                    <Badge variant="outline" className={`text-xs ${
                      entry.status === "active" ? "border-green-600/40 text-green-400" :
                      entry.status === "eliminated" ? "border-red-600/40 text-red-400" :
                      "border-white/20 text-white/50"
                    }`}>
                      {entry.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                    <span>{timeAgo(entry.createdAt)}</span>
                    <span>ID: {entry.id}</span>
                  </div>
                </div>
                <ConfirmDeleteDialog
                  trigger={
                    <Button variant="ghost" size="sm" className="text-red-500/60 hover:text-red-500 hover:bg-red-900/20 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  }
                  title="Remove Wheel Entry"
                  description={`Remove "${entry.artistName}" from the wheel?`}
                  onConfirm={(reason) => removeWheelEntry.mutate({ id: entry.id, reason })}
                  isPending={removeWheelEntry.isPending}
                />
              </div>
            ))}
            {!wheelEntries?.length && (
              <div className="text-center py-12 text-white/30">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No wheel entries</p>
              </div>
            )}
          </div>
        )}

        {/* Mod Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/40 text-xs uppercase tracking-widest">
                {modLogs?.length ?? 0} log entries (most recent first)
              </p>
              <Button variant="outline" size="sm" className="border-white/20 text-white/60 text-xs" onClick={() => refetchLogs()}>
                Refresh
              </Button>
            </div>
            {modLogs?.map(log => (
              <div key={log.id} className="border border-white/10 bg-white/[0.02] p-3 flex items-start gap-3">
                <Shield className="w-4 h-4 text-red-600/60 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">{log.action.replace(/_/g, " ")}</span>
                    <Badge variant="outline" className="text-xs border-white/20 text-white/40">{log.targetType} #{log.targetId}</Badge>
                  </div>
                  {log.targetPreview && (
                    <p className="text-white/60 text-xs line-clamp-1 mb-0.5">"{log.targetPreview}"</p>
                  )}
                  {log.reason && (
                    <p className="text-white/40 text-xs italic">Reason: {log.reason}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.adminName}</span>
                    <span>{timeAgo(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
            {!modLogs?.length && (
              <div className="text-center py-12 text-white/30">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No moderation logs yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
