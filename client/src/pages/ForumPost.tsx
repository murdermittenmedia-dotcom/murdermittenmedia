/* ============================================================
   MURDER MITTEN MEDIA — Forum Post Detail Page
   Style: Dark Editorial matching site theme (#080808, #D10000)
   ============================================================ */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ThumbsUp, ThumbsDown, MessageSquare, Trash2, Reply, Music, X, Upload, Play, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { ArtistLink } from "@/components/ArtistLink";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { TuneInButton } from "@/components/TuneInButton";

// ── Audio attachment — redirects to live radio station ──────────────────────
function ForumAudioPlayer({
  audioTitle, large = false
}: {
  audioUrl: string; audioTitle: string; artist: string;
  sourcePage: string; sourceUrl: string; large?: boolean;
}) {
  return (
    <div className={`mt-2 border border-red-600/20 bg-red-950/10 rounded p-2.5 flex items-center gap-3 ${large ? "mt-4 p-3" : ""}`}>
      <TuneInButton size={large ? "md" : "sm"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Music className={`flex-shrink-0 text-red-400 ${large ? "w-4 h-4" : "w-3 h-3"}`} />
          <span className={`text-red-400 font-medium truncate ${large ? "text-sm" : "text-xs"}`}>{audioTitle}</span>
        </div>
        <div className="text-xs text-white/30 mt-0.5">Tune in to hear this on the radio</div>
      </div>
    </div>
  );
}

function timeAgo(date: Date | string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-white/10 text-white/70",
  music: "bg-red-900/40 text-red-400",
  battles: "bg-orange-900/40 text-orange-400",
  news: "bg-blue-900/40 text-blue-400",
  feedback: "bg-green-900/40 text-green-400",
};

interface CommentItemProps {
  comment: {
    id: number;
    body: string;
    createdAt: Date;
    parentId: number | null;
    audioUrl?: string | null;
    audioTitle?: string | null;
    author: { id: number; name: string | null; artistName: string | null; avatarUrl: string | null } | null;
    upvotes: number;
    downvotes: number;
    myReaction: string | null;
  };
  currentUserId?: number;
  isAdmin?: boolean;
  onReply: (commentId: number) => void;
  onDelete: (commentId: number) => void;
  onReact: (commentId: number, reaction: "upvote" | "downvote") => void;
  depth?: number;
}

function CommentItem({ comment, currentUserId, isAdmin, onReply, onDelete, onReact, depth = 0 }: CommentItemProps) {
  const canDelete = isAdmin || comment.author?.id === currentUserId;
  const maxDepth = 3;
  const indent = Math.min(depth, maxDepth) * 16;

  return (
    <div className="border-l border-white/10" style={{ marginLeft: depth > 0 ? indent : 0 }}>
      <div className="p-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-red-900/40 border border-red-600/20 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
            {comment.author?.avatarUrl ? (
              <img src={comment.author.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-red-400 font-bold text-xs">
                {(comment.author?.artistName ?? comment.author?.name ?? "?")[0].toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Author + time */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-white/80">
                <ArtistLink artistName={comment.author?.artistName ?? comment.author?.name ?? 'Anonymous'} userId={comment.author?.id} />
              </span>
              <span className="text-xs text-white/30">{timeAgo(comment.createdAt)}</span>
            </div>

            {/* Body */}
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{comment.body}</p>
            {/* Audio attachment */}
            {comment.audioUrl && (
              <ForumAudioPlayer
                audioUrl={comment.audioUrl}
                audioTitle={comment.audioTitle || "Audio"}
                artist={comment.author?.artistName ?? comment.author?.name ?? "Anonymous"}
                sourcePage="Forum"
                sourceUrl="/forum"
              />
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
              <button
                onClick={() => onReact(comment.id, "upvote")}
                className={`flex items-center gap-1 hover:text-green-400 transition-colors ${comment.myReaction === "upvote" ? "text-green-400" : ""}`}
              >
                <ThumbsUp className="w-3 h-3" /> {comment.upvotes}
              </button>
              <button
                onClick={() => onReact(comment.id, "downvote")}
                className={`flex items-center gap-1 hover:text-red-400 transition-colors ${comment.myReaction === "downvote" ? "text-red-400" : ""}`}
              >
                <ThumbsDown className="w-3 h-3" /> {comment.downvotes}
              </button>
              {depth < maxDepth && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="flex items-center gap-1 hover:text-white/70 transition-colors"
                >
                  <Reply className="w-3 h-3" /> Reply
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 hover:text-red-500 transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ForumPostProps {
  params: { id: string };
}

export default function ForumPost({ params }: ForumPostProps) {
  const postId = parseInt(params.id, 10);
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentAudioUploading, setCommentAudioUploading] = useState(false);
  const [commentUploadedAudio, setCommentUploadedAudio] = useState<{ url: string; title: string } | null>(null);
  const utils = trpc.useUtils();
  const uploadAudio = trpc.forum.uploadAudio.useMutation();

  const handleCommentAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(mp3|wav|m4a|aac)$/i)) { toast.error("Only MP3, WAV, M4A, or AAC files allowed"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("File must be under 15MB"); return; }
    setCommentAudioUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        const result = await uploadAudio.mutateAsync({
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || "audio/mpeg",
          title: file.name.replace(/\.[^.]+$/, ""),
        });
        setCommentUploadedAudio(result);
        setCommentAudioUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { toast.error("Audio upload failed"); setCommentAudioUploading(false); }
  };

  const { data: post, isLoading, error } = trpc.forum.getPost.useQuery(
    { id: postId },
    { enabled: !isNaN(postId) }
  );

  const createComment = trpc.forum.createComment.useMutation({
    onSuccess: () => {
      toast.success("Comment posted!");
      setCommentBody("");
      setReplyTo(null);
      setCommentUploadedAudio(null);
      utils.forum.getPost.invalidate({ id: postId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteComment = trpc.forum.deleteComment.useMutation({
    onSuccess: () => {
      toast.success("Comment deleted");
      utils.forum.getPost.invalidate({ id: postId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePost = trpc.forum.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      navigate("/forum");
    },
    onError: (err) => toast.error(err.message),
  });

  const reactMutation = trpc.forum.react.useMutation({
    onSuccess: () => utils.forum.getPost.invalidate({ id: postId }),
    onError: (err) => toast.error(err.message),
  });

  const handleSubmitComment = () => {
    if (!commentBody.trim()) return;
    createComment.mutate({
      postId,
      body: commentBody.trim(),
      parentId: replyTo ?? undefined,
      audioUrl: commentUploadedAudio?.url,
      audioTitle: commentUploadedAudio?.title,
    });
  };

  if (isNaN(postId)) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <p className="text-white/50">Invalid post ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <div className="container py-8 max-w-4xl">
          <div className="h-8 w-32 bg-white/5 animate-pulse mb-6" />
          <div className="h-48 bg-white/5 animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/5 animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Post not found</p>
          <Link href="/forum">
            <Button variant="outline" className="border-white/20 text-white/70">Back to Forum</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === post.author?.id;
  const isAdmin = user?.role === "admin";
  const canDelete = isOwner || isAdmin;

  // Organize comments into tree (top-level + replies)
  type PostComment = NonNullable<typeof post>['comments'][number];
  const allComments: PostComment[] = post?.comments ?? [];
  const topLevelComments = allComments.filter(c => !c.parentId);
  const repliesByParent: Record<number, PostComment[]> = {};
  allComments.forEach(c => {
    if (c.parentId) {
      if (!repliesByParent[c.parentId]) repliesByParent[c.parentId] = [];
      repliesByParent[c.parentId].push(c);
    }
  });

  function renderCommentTree(comments: PostComment[], depth = 0): React.ReactNode {
    return comments.map(comment => (
      <div key={comment.id}>
        <CommentItem
          comment={comment}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          onReply={(id) => { setReplyTo(id); setCommentBody(""); }}
          onDelete={(id) => deleteComment.mutate({ id })}
          onReact={(id, reaction) => reactMutation.mutate({ targetType: "comment", targetId: id, reaction })}
          depth={depth}
        />
        {repliesByParent[comment.id] && renderCommentTree(repliesByParent[comment.id], depth + 1)}
      </div>
    ));
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />
      <div className="container py-6 max-w-4xl pt-24">
        {/* Back link */}
        <Link href="/forum">
          <button className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm mb-6">
            <ChevronLeft className="w-4 h-4" /> Back to Forum
          </button>
        </Link>

        {/* Post card */}
        <div className="border border-white/10 bg-white/[0.03] mb-6">
          <div className="p-6">
            {/* Category + title */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${CATEGORY_COLORS[post.category] ?? "bg-white/10 text-white/50"}`}>
                {post.category}
              </span>
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm("Delete this post?")) deletePost.mutate({ id: post.id });
                  }}
                  className="ml-auto flex items-center gap-1 text-xs text-white/30 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete Post
                </button>
              )}
            </div>

            <h1 className="font-['Anton'] text-2xl md:text-3xl tracking-wider text-white mb-4">
              {post.title}
            </h1>

            {/* Author row */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-red-900/40 border border-red-600/30 flex items-center justify-center overflow-hidden">
                {post.author?.avatarUrl ? (
                  <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-red-400 font-bold text-sm">
                    {(post.author?.artistName ?? post.author?.name ?? "?")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white/80">
                  <ArtistLink artistName={post.author?.artistName ?? post.author?.name ?? 'Anonymous'} userId={post.author?.id} />
                </div>
                <div className="text-xs text-white/40">{timeAgo(post.createdAt)}</div>
              </div>
            </div>

            {/* Body */}
            <div className="text-white/80 leading-relaxed whitespace-pre-wrap text-sm md:text-base border-t border-white/10 pt-4">
              {post.body}
            </div>

            {/* Audio attachment */}
            {post.audioUrl && (
              <ForumAudioPlayer
                audioUrl={post.audioUrl}
                audioTitle={post.audioTitle || "Audio"}
                artist={post.author?.artistName ?? post.author?.name ?? "Anonymous"}
                sourcePage="Forum"
                sourceUrl="/forum"
                large
              />
            )}

            {/* Reactions */}
            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10">
              <button
                onClick={() => reactMutation.mutate({ targetType: "post", targetId: post.id, reaction: "upvote" })}
                className={`flex items-center gap-2 px-3 py-1.5 border transition-all text-sm ${
                  post.myReaction === "upvote"
                    ? "border-green-500 text-green-400 bg-green-900/20"
                    : "border-white/10 text-white/50 hover:border-green-500/50 hover:text-green-400"
                }`}
              >
                <ThumbsUp className="w-4 h-4" /> {post.upvotes}
              </button>
              <button
                onClick={() => reactMutation.mutate({ targetType: "post", targetId: post.id, reaction: "downvote" })}
                className={`flex items-center gap-2 px-3 py-1.5 border transition-all text-sm ${
                  post.myReaction === "downvote"
                    ? "border-red-500 text-red-400 bg-red-900/20"
                    : "border-white/10 text-white/50 hover:border-red-500/50 hover:text-red-400"
                }`}
              >
                <ThumbsDown className="w-4 h-4" /> {post.downvotes}
              </button>
              <span className="text-white/30 text-sm flex items-center gap-1 ml-auto">
                <MessageSquare className="w-4 h-4" /> {post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Comments section */}
        <div className="mb-6">
          <h2 className="font-['Anton'] text-lg tracking-wider text-white mb-4">
            COMMENTS <span className="text-red-600">({post.comments.length})</span>
          </h2>

          {/* Comment form */}
          {isAuthenticated ? (
            <div className="border border-white/10 bg-white/[0.03] p-4 mb-4">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-white/50">
                  <Reply className="w-3 h-3" />
                  Replying to comment #{replyTo}
                  <button onClick={() => setReplyTo(null)} className="text-red-500 hover:text-red-400 ml-1">
                    Cancel
                  </button>
                </div>
              )}
              <Textarea
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px] resize-none mb-3"
                maxLength={2000}
              />
              {/* Audio attachment for comment */}
              <div className="mb-3">
                {commentUploadedAudio ? (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5">
                    <Music className="w-3 h-3 text-red-400 shrink-0" />
                    <span className="text-xs text-white/70 truncate flex-1">{commentUploadedAudio.title}</span>
                    <button onClick={() => setCommentUploadedAudio(null)} className="text-white/30 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : commentAudioUploading ? (
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <Upload className="w-3 h-3 animate-pulse" /> Uploading audio...
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                    <Music className="w-3 h-3" /> Attach audio (MP3/WAV/M4A/AAC, max 15MB)
                    <input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" className="hidden" onChange={handleCommentAudioSelect} />
                  </label>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30">{commentBody.length}/2000</span>
                <Button
                  onClick={handleSubmitComment}
                  disabled={!commentBody.trim() || createComment.isPending || commentAudioUploading}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-widest px-5"
                >
                  {createComment.isPending ? "Posting..." : replyTo ? "Reply" : "Comment"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border border-white/10 bg-white/[0.03] p-4 mb-4 text-center">
              <p className="text-white/50 text-sm mb-3">Sign in to join the discussion</p>
              <a href={getLoginUrl()}>
                <Button className="bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-widest">
                  Sign In
                </Button>
              </a>
            </div>
          )}

          {/* Comments tree */}
          {post.comments.length === 0 ? (
            <div className="text-center py-10 text-white/30">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            <div className="border border-white/10 bg-white/[0.02] divide-y divide-white/5">
              {renderCommentTree(topLevelComments)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
