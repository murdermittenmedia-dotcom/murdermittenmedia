/* ============================================================
   MURDER MITTEN MEDIA — Forum Page
   Style: Dark Editorial matching site theme (#080808, #D10000)
   ============================================================ */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, ThumbsUp, ThumbsDown, Eye, Plus, Flame, Pin } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "general", label: "General" },
  { value: "music", label: "Music" },
  { value: "battles", label: "Battles" },
  { value: "news", label: "News" },
  { value: "feedback", label: "Feedback" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-white/10 text-white/70",
  music: "bg-red-900/40 text-red-400",
  battles: "bg-orange-900/40 text-orange-400",
  news: "bg-blue-900/40 text-blue-400",
  feedback: "bg-green-900/40 text-green-400",
};

function timeAgo(date: Date | string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
}

function CreatePostModal({ onCreated }: { onCreated: () => void }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"general" | "music" | "battles" | "news" | "feedback">("general");

  const createPost = trpc.forum.createPost.useMutation({
    onSuccess: () => {
      toast.success("Post created!");
      setOpen(false);
      setTitle("");
      setBody("");
      setCategory("general");
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isAuthenticated) {
    return (
      <a href={getLoginUrl()}>
        <Button className="bg-red-600 hover:bg-red-700 text-white font-semibold uppercase tracking-widest text-xs px-6">
          <Plus className="w-4 h-4 mr-2" /> New Post
        </Button>
      </a>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 text-white font-semibold uppercase tracking-widest text-xs px-6">
          <Plus className="w-4 h-4 mr-2" /> New Post
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#111] border border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-['Anton'] text-xl tracking-wider text-white">Create Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest mb-1 block">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111] border-white/10">
                {CATEGORIES.filter(c => c.value !== "all").map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-white hover:bg-white/10">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest mb-1 block">Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Post title..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              maxLength={256}
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-widest mb-1 block">Body</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="What's on your mind?"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[120px] resize-none"
              maxLength={10000}
            />
            <div className="text-right text-xs text-white/30 mt-1">{body.length}/10000</div>
          </div>
          <Button
            onClick={() => createPost.mutate({ title, body, category })}
            disabled={!title.trim() || !body.trim() || createPost.isPending}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold uppercase tracking-widest"
          >
            {createPost.isPending ? "Posting..." : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Forum() {
  const [category, setCategory] = useState("all");
  const utils = trpc.useUtils();

  const { data: posts, isLoading, refetch } = trpc.forum.getPosts.useQuery({
    category,
    limit: 30,
    offset: 0,
  });

  const reactMutation = trpc.forum.react.useMutation({
    onSuccess: () => utils.forum.getPosts.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#080808]/90 sticky top-0 z-10 backdrop-blur-sm">
        <div className="container py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-['Anton'] text-2xl tracking-wider">
              COMMUNITY <span className="text-red-600">FORUM</span>
            </h1>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-0.5">Detroit Rap · Culture · Discussion</p>
          </div>
          <CreatePostModal onCreated={() => refetch()} />
        </div>

        {/* Category tabs */}
        <div className="container pb-3">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`text-xs uppercase tracking-widest px-3 py-1.5 border transition-all duration-200 font-semibold ${
                  category === c.value
                    ? "border-red-600 text-red-500 bg-red-600/10"
                    : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts list */}
      <div className="container py-6 max-w-4xl">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {!isLoading && (!posts || posts.length === 0) && (
          <div className="text-center py-20 text-white/40">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-['Anton'] tracking-wider">No posts yet</p>
            <p className="text-sm mt-1">Be the first to start a discussion</p>
          </div>
        )}

        {posts && posts.length > 0 && (
          <div className="space-y-2">
            {posts.map(post => (
              <div
                key={post.id}
                className="border border-white/10 bg-white/[0.03] hover:border-red-600/30 hover:bg-white/[0.05] transition-all duration-200 group"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-red-900/40 border border-red-600/30 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
                      {post.author?.avatarUrl ? (
                        <img src={post.author.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-red-400 font-bold text-sm">
                          {(post.author?.artistName ?? post.author?.name ?? "?")[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {post.pinned && <Pin className="w-3 h-3 text-red-500 flex-shrink-0" />}
                        <Link href={`/forum/${post.id}`}>
                          <span className="font-semibold text-white group-hover:text-red-400 transition-colors cursor-pointer line-clamp-1">
                            {post.title}
                          </span>
                        </Link>
                        <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${CATEGORY_COLORS[post.category] ?? "bg-white/10 text-white/50"}`}>
                          {post.category}
                        </span>
                      </div>

                      {/* Body preview */}
                      <p className="text-white/50 text-sm line-clamp-2 mb-2">{post.body}</p>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-xs text-white/40">
                        <span className="font-medium text-white/60">
                          {post.author?.artistName ?? post.author?.name ?? "Anonymous"}
                        </span>
                        <span>{timeAgo(post.createdAt)}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {post.viewCount}
                        </span>
                        <Link href={`/forum/${post.id}`}>
                          <span className="flex items-center gap-1 hover:text-white/70 cursor-pointer">
                            <MessageSquare className="w-3 h-3" /> Reply
                          </span>
                        </Link>
                        <button
                          onClick={() => reactMutation.mutate({ targetType: "post", targetId: post.id, reaction: "upvote" })}
                          className={`flex items-center gap-1 hover:text-green-400 transition-colors ${'myReaction' in post && post.myReaction === "upvote" ? "text-green-400" : ""}`}
                        >
                          <ThumbsUp className="w-3 h-3" /> {post.upvotes}
                        </button>
                        <button
                          onClick={() => reactMutation.mutate({ targetType: "post", targetId: post.id, reaction: "downvote" })}
                          className={`flex items-center gap-1 hover:text-red-400 transition-colors ${'myReaction' in post && post.myReaction === "downvote" ? "text-red-400" : ""}`}
                        >
                          <ThumbsDown className="w-3 h-3" /> {post.downvotes}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
