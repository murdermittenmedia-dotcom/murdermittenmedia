/* ============================================================
   MURDER MITTEN MEDIA — Admin Panel
   Tabs: Users | Promo Orders | Analytics | Site Settings
   Access: admin role only
   ============================================================ */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users, ShoppingBag, BarChart3, Settings, Shield,
  Search, Ban, CheckCircle, AlertTriangle, RefreshCw,
  Crown, Gavel, Music, Star, TrendingUp, FileText,
  ChevronDown, ChevronUp, Eye, EyeOff
} from "lucide-react";

// ─── Role badge ───────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: "bg-red-600 text-white",
    judge: "bg-purple-600 text-white",
    contestant: "bg-blue-600 text-white",
    user: "bg-white/10 text-white/60",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${map[role] ?? map.user}`}>
      {role}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "red" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: "red" | "green" | "blue" | "purple" | "yellow";
}) {
  const colorMap = {
    red: "text-red-500 bg-red-600/10 border-red-600/20",
    green: "text-green-400 bg-green-600/10 border-green-600/20",
    blue: "text-blue-400 bg-blue-600/10 border-blue-600/20",
    purple: "text-purple-400 bg-purple-600/10 border-purple-600/20",
    yellow: "text-yellow-400 bg-yellow-600/10 border-yellow-600/20",
  };
  return (
    <div className={`border rounded-lg p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-widest text-white/50">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [banReason, setBanReason] = useState("");
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({ search: search || undefined, limit: 200 });

  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });

  const banUser = trpc.admin.banUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); setBanReason(""); toast.success("User banned"); },
    onError: (e) => toast.error(e.message),
  });

  const unbanUser = trpc.admin.unbanUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("User unbanned"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search by name, artist, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <span className="text-white/40 text-sm">{users?.length ?? 0} users</span>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-white/30">Loading users...</div>
      ) : (
        <div className="space-y-2">
          {users?.map(user => (
            <div key={user.id} className="border border-white/10 bg-white/[0.02] rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.avatarUrl
                    ? <img src={user.avatarUrl} alt={user.name ?? ""} className="w-full h-full object-cover" />
                    : <span className="text-white/40 text-sm font-bold">{(user.name ?? "?")[0]?.toUpperCase()}</span>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold truncate">{user.name ?? "No name"}</span>
                    {user.artistName && <span className="text-white/40 text-sm">· {user.artistName}</span>}
                    <RoleBadge role={user.role} />
                    {user.isBanned && <span className="text-xs bg-red-900/60 text-red-400 px-2 py-0.5 rounded font-semibold">BANNED</span>}
                  </div>
                  <div className="text-white/30 text-xs mt-0.5 truncate">
                    {user.email ?? "No email"} · {user.city ?? "No city"} · Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Expand */}
                <div className="text-white/30">
                  {expandedUser === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Expanded controls */}
              {expandedUser === user.id && (
                <div className="border-t border-white/10 p-4 bg-white/[0.02] space-y-4">
                  {/* Role change */}
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Change Role</p>
                    <div className="flex flex-wrap gap-2">
                      {(["user", "judge", "contestant", "admin"] as const).map(role => (
                        <Button
                          key={role}
                          size="sm"
                          variant={user.role === role ? "default" : "outline"}
                          className={user.role === role ? "bg-red-600 hover:bg-red-700" : "border-white/20 text-white/60 hover:text-white"}
                          onClick={() => setRole.mutate({ userId: user.id, role })}
                          disabled={setRole.isPending}
                        >
                          {role === "admin" && <Crown className="w-3 h-3 mr-1" />}
                          {role === "judge" && <Gavel className="w-3 h-3 mr-1" />}
                          {role}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Ban / Unban */}
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Ban Management</p>
                    {user.isBanned ? (
                      <div className="flex items-center gap-3">
                        <span className="text-red-400 text-sm">Banned: {user.banReason ?? "No reason given"}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600/40 text-green-400 hover:bg-green-600/20"
                          onClick={() => unbanUser.mutate({ userId: user.id })}
                          disabled={unbanUser.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Unban
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Ban reason (optional)..."
                          value={banReason}
                          onChange={e => setBanReason(e.target.value)}
                          className="flex-1 max-w-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600/40 text-red-400 hover:bg-red-600/20"
                          onClick={() => banUser.mutate({ userId: user.id, reason: banReason || undefined })}
                          disabled={banUser.isPending}
                        >
                          <Ban className="w-3 h-3 mr-1" /> Ban
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Instagram */}
                  {user.instagramHandle && (
                    <div className="text-white/30 text-xs">
                      Instagram: <a href={`https://instagram.com/${user.instagramHandle}`} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">@{user.instagramHandle}</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Promo Orders Tab ─────────────────────────────────────────
function PromoOrdersTab() {
  const [activeSubTab, setActiveSubTab] = useState<"skip" | "wheel">("skip");
  const utils = trpc.useUtils();

  const { data: skipOrders, isLoading: skipLoading } = trpc.admin.skipOrders.useQuery();
  const { data: wheelOrders, isLoading: wheelLoading } = trpc.admin.wheelOrders.useQuery();

  const confirmSkip = trpc.admin.confirmSkip.useMutation({
    onSuccess: () => { utils.admin.skipOrders.invalidate(); toast.success("Skip payment confirmed"); },
    onError: (e) => toast.error(e.message),
  });

  const confirmWheel = trpc.admin.confirmWheelPayment.useMutation({
    onSuccess: () => { utils.admin.wheelOrders.invalidate(); toast.success("Wheel payment confirmed"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveSubTab("skip")}
          className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${activeSubTab === "skip" ? "bg-red-600 text-white" : "border border-white/20 text-white/50 hover:text-white"}`}
        >
          Skip-the-Line ({skipOrders?.length ?? 0})
        </button>
        <button
          onClick={() => setActiveSubTab("wheel")}
          className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${activeSubTab === "wheel" ? "bg-red-600 text-white" : "border border-white/20 text-white/50 hover:text-white"}`}
        >
          Wheel Entries ({wheelOrders?.length ?? 0})
        </button>
      </div>

      {activeSubTab === "skip" && (
        <div className="space-y-3">
          {skipLoading ? <div className="text-white/30 text-center py-10">Loading...</div> : skipOrders?.length === 0 ? (
            <div className="text-center py-20 text-white/30">No skip-the-line orders</div>
          ) : skipOrders?.map(order => (
            <div key={order.id} className="border border-white/10 bg-white/[0.02] rounded-lg p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white font-semibold">{order.artistName}</span>
                  <span className="text-white/40 text-sm">— {order.songTitle}</span>
                  {order.skipPaymentConfirmed
                    ? <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded">Confirmed</span>
                    : <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded">Pending</span>
                  }
                </div>
                <div className="text-white/30 text-xs">
                  {order.contactInfo && <span>Contact: {order.contactInfo} · </span>}
                  Submitted: {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              {!order.skipPaymentConfirmed && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                  onClick={() => confirmSkip.mutate({ submissionId: order.id })}
                  disabled={confirmSkip.isPending}
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Confirm
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {activeSubTab === "wheel" && (
        <div className="space-y-3">
          {wheelLoading ? <div className="text-white/30 text-center py-10">Loading...</div> : wheelOrders?.length === 0 ? (
            <div className="text-center py-20 text-white/30">No paid wheel entries</div>
          ) : wheelOrders?.map(entry => (
            <div key={entry.id} className="border border-white/10 bg-white/[0.02] rounded-lg p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white font-semibold">{entry.artistName}</span>
                  <span className="text-white/40 text-sm">— {entry.songTitle}</span>
                  {entry.paymentConfirmed
                    ? <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded">Confirmed</span>
                    : <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded">Pending</span>
                  }
                  <span className={`text-xs px-2 py-0.5 rounded ${entry.status === "active" ? "bg-blue-900/40 text-blue-400" : "bg-white/10 text-white/40"}`}>
                    {entry.status}
                  </span>
                </div>
                <div className="text-white/30 text-xs">
                  {entry.contactInfo && <span>Contact: {entry.contactInfo} · </span>}
                  Submitted: {new Date(entry.createdAt).toLocaleString()}
                </div>
              </div>
              {!entry.paymentConfirmed && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                  onClick={() => confirmWheel.mutate({ entryId: entry.id })}
                  disabled={confirmWheel.isPending}
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Confirm
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────
function AnalyticsTab() {
  const { data: analytics, isLoading } = trpc.admin.analytics.useQuery();

  if (isLoading) return <div className="text-center py-20 text-white/30">Loading analytics...</div>;
  if (!analytics) return <div className="text-center py-20 text-white/30">No data available</div>;

  return (
    <div className="space-y-8">
      {/* Overview stats */}
      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Total Users" value={analytics.users.total} sub={`+${analytics.users.recentSignups} this week`} color="blue" />
          <StatCard icon={Music} label="Submissions" value={analytics.submissions.total} sub={`${analytics.submissions.pending} pending`} color="red" />
          <StatCard icon={TrendingUp} label="Total Votes" value={analytics.votes.total} color="green" />
          <StatCard icon={Gavel} label="Battles" value={analytics.battles.total} color="purple" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard icon={Star} label="Wheel Entries" value={analytics.wheelEntries.total} color="yellow" />
          <StatCard icon={Music} label="User Songs" value={analytics.songs.total} color="blue" />
          <StatCard icon={FileText} label="Forum Posts" value={analytics.forumPosts.total} color="green" />
          <StatCard icon={ShoppingBag} label="Skip Orders" value={analytics.promoOrders.skipTotal} sub={`${analytics.promoOrders.skipConfirmed} confirmed`} color="red" />
        </div>
      </div>

      {/* Top artists by fire count */}
      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Top Artists by 🔥 Reactions</h3>
        <div className="space-y-2">
          {analytics.topArtists.map((artist, i) => (
            <div key={artist.artistName} className="flex items-center gap-3 border border-white/10 bg-white/[0.02] rounded p-3">
              <span className="text-white/30 text-sm w-6 text-right">{i + 1}</span>
              <span className="text-white font-semibold flex-1">{artist.artistName}</span>
              <span className="text-orange-400 text-sm">🔥 {artist.totalFire ?? 0}</span>
              <span className="text-white/30 text-sm">🗑 {artist.totalTrash ?? 0}</span>
              <span className="text-white/30 text-xs">{artist.submissionCount} sub{artist.submissionCount !== 1 ? "s" : ""}</span>
            </div>
          ))}
          {analytics.topArtists.length === 0 && <div className="text-white/30 text-center py-8">No submission data yet</div>}
        </div>
      </div>

      {/* Top battle winners */}
      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Top Battle Winners</h3>
        <div className="space-y-2">
          {analytics.topBattleWinners.map((winner, i) => (
            <div key={winner.artistName} className="flex items-center gap-3 border border-white/10 bg-white/[0.02] rounded p-3">
              <span className="text-white/30 text-sm w-6 text-right">{i + 1}</span>
              <span className="text-white font-semibold flex-1">{winner.artistName}</span>
              <span className="text-green-400 text-sm font-bold">{winner.wins} W</span>
            </div>
          ))}
          {analytics.topBattleWinners.length === 0 && <div className="text-white/30 text-center py-8">No battle data yet</div>}
        </div>
      </div>

      {/* Promo revenue summary */}
      <div>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Promo Orders Summary</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
            <div className="text-white/50 text-xs uppercase tracking-widest mb-2">Skip-the-Line</div>
            <div className="text-2xl font-bold text-white">{analytics.promoOrders.skipTotal}</div>
            <div className="text-xs text-white/30 mt-1">{analytics.promoOrders.skipConfirmed} confirmed · {analytics.promoOrders.skipTotal - analytics.promoOrders.skipConfirmed} pending</div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
            <div className="text-white/50 text-xs uppercase tracking-widest mb-2">Wheel Entries (Paid)</div>
            <div className="text-2xl font-bold text-white">{analytics.promoOrders.wheelPaidTotal}</div>
            <div className="text-xs text-white/30 mt-1">{analytics.promoOrders.wheelPaidConfirmed} confirmed · {analytics.promoOrders.wheelPaidTotal - analytics.promoOrders.wheelPaidConfirmed} pending</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Site Settings Tab ────────────────────────────────────────
function SiteSettingsTab() {
  const utils = trpc.useUtils();
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "aow">("settings");

  // Settings
  const { data: settings, isLoading: settingsLoading } = trpc.admin.getSettings.useQuery();
  const setSetting = trpc.admin.setSetting.useMutation({
    onSuccess: () => { utils.admin.getSettings.invalidate(); toast.success("Setting saved"); },
    onError: (e) => toast.error(e.message),
  });

  // Artist of the week
  const { data: aowList, isLoading: aowLoading } = trpc.admin.getArtistsOfWeek.useQuery();
  const setAow = trpc.admin.setArtistOfWeek.useMutation({
    onSuccess: () => { utils.admin.getArtistsOfWeek.invalidate(); toast.success("Artist of the Week updated!"); },
    onError: (e) => toast.error(e.message),
  });

  const [aowForm, setAowForm] = useState({
    artistName: "", bio: "", imageUrl: "", instagramUrl: "",
    youtubeUrl: "", spotifyUrl: "", featuredVideoId: "",
    audioTrackUrl: "", audioTrackTitle: "",
  });

  const SETTING_LABELS: Record<string, { label: string; description: string; type: "text" | "textarea" | "toggle" }> = {
    site_announcement: { label: "Site Announcement Banner", description: "Shown at the top of every page. Leave empty to hide.", type: "textarea" },
    submission_open: { label: "Submissions Open", description: "Set to 'true' or 'false' to open/close the submission queue.", type: "text" },
    wars_open: { label: "Music Wars Open", description: "Set to 'true' or 'false' to open/close wheel entry submissions.", type: "text" },
    promo_skip_price: { label: "Skip-the-Line Price", description: "Display price for skip-the-line (e.g. '$10')", type: "text" },
    promo_wheel_price: { label: "Wheel Entry Price", description: "Display price for paid wheel entries (e.g. '$20')", type: "text" },
    contact_email: { label: "Contact Email", description: "Public contact email shown on the site.", type: "text" },
    footer_message: { label: "Footer Message", description: "Custom message shown in the site footer.", type: "textarea" },
  };

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (key: string) => {
    setEditingKey(key);
    setEditValue(settings?.[key] ?? "");
  };

  const saveEdit = () => {
    if (!editingKey) return;
    setSetting.mutate({ key: editingKey, value: editValue });
    setEditingKey(null);
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveSubTab("settings")}
          className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${activeSubTab === "settings" ? "bg-red-600 text-white" : "border border-white/20 text-white/50 hover:text-white"}`}
        >
          Site Settings
        </button>
        <button
          onClick={() => setActiveSubTab("aow")}
          className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${activeSubTab === "aow" ? "bg-red-600 text-white" : "border border-white/20 text-white/50 hover:text-white"}`}
        >
          Artist of the Week
        </button>
      </div>

      {activeSubTab === "settings" && (
        <div className="space-y-3">
          {settingsLoading ? <div className="text-white/30 text-center py-10">Loading...</div> : (
            Object.entries(SETTING_LABELS).map(([key, meta]) => (
              <div key={key} className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{meta.label}</div>
                    <div className="text-white/40 text-xs mt-0.5">{meta.description}</div>
                    {editingKey === key ? (
                      <div className="mt-3 space-y-2">
                        {meta.type === "textarea" ? (
                          <Textarea
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                            rows={3}
                          />
                        ) : (
                          <Input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="bg-white/5 border-white/10 text-white text-sm"
                          />
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={saveEdit} disabled={setSetting.isPending}>Save</Button>
                          <Button size="sm" variant="outline" className="border-white/20 text-white/60" onClick={() => setEditingKey(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-white/60 text-sm font-mono bg-white/5 rounded px-2 py-1 truncate">
                        {settings?.[key] ?? <span className="text-white/20 italic">not set</span>}
                      </div>
                    )}
                  </div>
                  {editingKey !== key && (
                    <Button size="sm" variant="outline" className="border-white/20 text-white/60 hover:text-white flex-shrink-0" onClick={() => startEdit(key)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === "aow" && (
        <div className="space-y-6">
          {/* Set new artist of the week */}
          <div className="border border-red-600/30 bg-red-600/5 rounded-lg p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" /> Set New Artist of the Week
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "artistName", label: "Artist Name *", placeholder: "e.g. YLG TWON" },
                { key: "imageUrl", label: "Profile Image URL", placeholder: "https://..." },
                { key: "instagramUrl", label: "Instagram URL", placeholder: "https://instagram.com/..." },
                { key: "youtubeUrl", label: "YouTube URL", placeholder: "https://youtube.com/..." },
                { key: "spotifyUrl", label: "Spotify URL", placeholder: "https://open.spotify.com/..." },
                { key: "featuredVideoId", label: "Featured YouTube Video ID", placeholder: "e.g. dQw4w9WgXcQ" },
                { key: "audioTrackUrl", label: "Audio Track URL", placeholder: "https://... or /manus-storage/..." },
                { key: "audioTrackTitle", label: "Audio Track Title", placeholder: "e.g. Summer Days" },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-white/50 text-xs uppercase tracking-widest block mb-1">{field.label}</label>
                  <Input
                    placeholder={field.placeholder}
                    value={aowForm[field.key as keyof typeof aowForm]}
                    onChange={e => setAowForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-white/50 text-xs uppercase tracking-widest block mb-1">Bio</label>
                <Textarea
                  placeholder="Artist bio..."
                  value={aowForm.bio}
                  onChange={e => setAowForm(prev => ({ ...prev, bio: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm"
                  rows={3}
                />
              </div>
            </div>
            <Button
              className="mt-4 bg-red-600 hover:bg-red-700"
              onClick={() => setAow.mutate(aowForm)}
              disabled={!aowForm.artistName || setAow.isPending}
            >
              <Star className="w-4 h-4 mr-2" />
              {setAow.isPending ? "Saving..." : "Set as Artist of the Week"}
            </Button>
          </div>

          {/* History */}
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3">History</h3>
            {aowLoading ? <div className="text-white/30 text-center py-8">Loading...</div> : (
              <div className="space-y-2">
                {aowList?.map(aow => (
                  <div key={aow.id} className={`border rounded-lg p-3 flex items-center gap-3 ${aow.isActive ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                    {aow.imageUrl && <img src={aow.imageUrl} alt={aow.artistName} className="w-10 h-10 rounded-full object-cover" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{aow.artistName}</span>
                        {aow.isActive && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Current</span>}
                      </div>
                      <div className="text-white/30 text-xs">Week of {new Date(aow.weekOf).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {!aowList?.length && <div className="text-white/30 text-center py-8">No artists set yet</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────
type Tab = "users" | "orders" | "analytics" | "settings";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "orders", label: "Promo Orders", icon: ShoppingBag },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Site Settings", icon: Settings },
];

export default function AdminPanel() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-white/30">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-white text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-white/40 mb-6">You need admin privileges to view this page.</p>
          <Button onClick={() => navigate("/")} className="bg-red-600 hover:bg-red-700">Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {/* Header */}
      <section className="pt-24 pb-8 border-b border-white/10">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-red-600" />
            <h1 className="font-['Anton'] text-4xl uppercase">Admin Panel</h1>
          </div>
          <p className="text-white/40 text-sm">Manage users, orders, analytics, and site settings.</p>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-white/10 sticky top-0 bg-[#080808]/95 backdrop-blur-sm z-10">
        <div className="container">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold uppercase tracking-widest whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-red-600 text-white"
                    : "border-transparent text-white/40 hover:text-white/70"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="container py-8">
        {activeTab === "users" && <UsersTab />}
        {activeTab === "orders" && <PromoOrdersTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "settings" && <SiteSettingsTab />}
      </div>
    </div>
  );
}
