/* ============================================================
   MURDER MITTEN MEDIA — Admin Panel
   Tabs: Users | Promo Orders | Analytics | Site Settings
   Access: admin role only
   ============================================================ */

import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import LabelBadge, { ALL_LABEL_OPTIONS, AccountLabel } from "@/components/LabelBadge";
import { AdminRewardsTab } from "@/components/AdminRewardsTab";
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
  Crown, Gavel, Music, Star, TrendingUp, FileText, Activity,
  ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Trophy, Disc, Radio, Coins, Gift
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

// ─── User Stats Editor Component ─────────────────────────────
function UserStatsEditor({ userId, user, utils }: { userId: number; user: any; utils: any }) {
  const [editMode, setEditMode] = useState(false);
  // Pre-populated from the user object (fields that live on the users table)
  const [userStats, setUserStats] = useState({ xp: 0, level: "", streak: 0 });
  // Per-submission fire/trash edits: { [submissionId]: { fireCount, trashCount } }
  const [subEdits, setSubEdits] = useState<Record<number, { fireCount: number; trashCount: number }>>({});

  const { data: userData, refetch: refetchUserData } = trpc.admin.adminGetUserData.useQuery(
    { userId },
    { enabled: editMode }
  );

  // Seed subEdits when userData loads
  const prevUserDataRef = useState<any>(null);
  if (userData && userData !== prevUserDataRef[0]) {
    prevUserDataRef[1](userData);
    const initial: Record<number, { fireCount: number; trashCount: number }> = {};
    userData.submissions.forEach((s: any) => {
      initial[s.id] = { fireCount: s.fireCount ?? 0, trashCount: s.trashCount ?? 0 };
    });
    setSubEdits(initial);
  }

  // When edit mode opens, seed userStats from the user prop
  const openEditor = () => {
    setUserStats({ xp: user.xp ?? 0, level: user.level ?? "bronze", streak: user.streak ?? 0 });
    setEditMode(true);
  };

  const editStatsMutation = trpc.admin.adminEditUserStats.useMutation({
    onSuccess: () => {
      toast.success("User stats saved");
      utils.admin.listUsers.invalidate();
      utils.user.getStats.invalidate();
      utils.user.getStatsByUserId.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editSubStatsMutation = trpc.admin.adminEditSubmissionStats.useMutation({
    onSuccess: () => {
      toast.success("Submission votes updated");
      refetchUserData();
      utils.user.getStats.invalidate();
      utils.user.getStatsByUserId.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeSongMutation = trpc.admin.adminRemoveSong.useMutation({
    onSuccess: () => { toast.success("Song removed"); refetchUserData(); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeSubmissionMutation = trpc.admin.adminRemoveReviewSubmission.useMutation({
    onSuccess: () => { toast.success("Submission removed"); refetchUserData(); utils.user.getStats.invalidate(); utils.user.getStatsByUserId.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAll = async () => {
    // Save user-level stats
    await editStatsMutation.mutateAsync({ userId, ...userStats });
    // Save any modified submission vote counts
    const promises = Object.entries(subEdits).map(([idStr, vals]) =>
      editSubStatsMutation.mutateAsync({ submissionId: Number(idStr), ...vals })
    );
    await Promise.all(promises);
    setEditMode(false);
  };

  return (
    <div>
      <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Edit User Stats</p>
      {!editMode ? (
        <div className="space-y-1">
          <div className="flex gap-4 text-xs text-white/40 mb-2">
            <span>XP: <span className="text-white/70">{user.xp ?? 0}</span></span>
            <span>Level: <span className="text-white/70">{user.level ?? "bronze"}</span></span>
            <span>Streak: <span className="text-white/70">{user.streak ?? 0}</span></span>
          </div>
          <Button size="sm" variant="outline" className="border-white/20 text-white/60 hover:text-white" onClick={openEditor}>
            Edit Stats & Data
          </Button>
        </div>
      ) : (
        <div className="space-y-4 bg-white/[0.02] border border-white/10 p-4 rounded-lg">
          {/* User-level stats (XP, level, streak) */}
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2">User Stats</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">XP</label>
                <Input type="number" min="0" value={userStats.xp}
                  onChange={(e) => setUserStats({ ...userStats, xp: parseInt(e.target.value) || 0 })}
                  className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">Level</label>
                <Input type="text" value={userStats.level}
                  onChange={(e) => setUserStats({ ...userStats, level: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-sm"
                  placeholder="bronze" />
              </div>
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest block mb-1">Streak</label>
                <Input type="number" min="0" value={userStats.streak}
                  onChange={(e) => setUserStats({ ...userStats, streak: parseInt(e.target.value) || 0 })}
                  className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
            </div>
          </div>

          {/* Submissions — editable fire/trash per song */}
          {userData?.submissions && userData.submissions.length > 0 && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Submissions — Edit 🔥 / 🗑️ Votes</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {userData.submissions.map((sub: any) => {
                  const vals = subEdits[sub.id] ?? { fireCount: sub.fireCount ?? 0, trashCount: sub.trashCount ?? 0 };
                  return (
                    <div key={sub.id} className="p-2 bg-white/5 border border-white/10 rounded text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white/70 truncate flex-1 font-medium">{sub.songTitle}</span>
                        <span className="text-white/30 shrink-0">{sub.status}</span>
                        <Button size="sm" variant="outline" className="border-red-600/40 text-red-400 hover:bg-red-600/20 h-6 px-2 shrink-0"
                          onClick={() => removeSubmissionMutation.mutate({ submissionId: sub.id })}
                          disabled={removeSubmissionMutation.isPending}>
                          Delete
                        </Button>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-orange-400">🔥</span>
                          <Input type="number" min="0" value={vals.fireCount}
                            onChange={(e) => setSubEdits(prev => ({ ...prev, [sub.id]: { ...vals, fireCount: parseInt(e.target.value) || 0 } }))}
                            className="bg-white/5 border-white/10 text-white text-xs h-6 w-16 px-1" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span>🗑️</span>
                          <Input type="number" min="0" value={vals.trashCount}
                            onChange={(e) => setSubEdits(prev => ({ ...prev, [sub.id]: { ...vals, trashCount: parseInt(e.target.value) || 0 } }))}
                            className="bg-white/5 border-white/10 text-white text-xs h-6 w-16 px-1" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Songs list */}
          {userData?.songs && userData.songs.length > 0 && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Songs ({userData.songs.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {userData.songs.map((song: any) => (
                  <div key={song.id} className="flex items-center justify-between gap-2 p-2 bg-white/5 border border-white/10 rounded text-xs">
                    <span className="text-white/70 truncate flex-1">{song.title ?? song.songTitle ?? "Untitled"}</span>
                    <Button size="sm" variant="outline" className="border-red-600/40 text-red-400 hover:bg-red-600/20 h-6 px-2"
                      onClick={() => removeSongMutation.mutate({ songId: song.id })}
                      disabled={removeSongMutation.isPending}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white"
              onClick={saveAll}
              disabled={editStatsMutation.isPending || editSubStatsMutation.isPending}>
              {(editStatsMutation.isPending || editSubStatsMutation.isPending) ? "Saving..." : "Save All Changes"}
            </Button>
            <Button size="sm" variant="outline" className="border-white/20 text-white/60" onClick={() => setEditMode(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
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
  const setAccountLabelsMutation = trpc.admin.setAccountLabels.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("Labels updated"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const banUser = trpc.admin.banUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); setBanReason(""); toast.success("User banned"); },
    onError: (e) => toast.error(e.message),
  });

  const unbanUser = trpc.admin.unbanUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("User unbanned"); },
    onError: (e) => toast.error(e.message),
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); setDeleteConfirmId(null); toast.success("User deleted permanently"); },
    onError: (e) => { toast.error(e.message); setDeleteConfirmId(null); },
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

                {/* View Profile link */}
                <Link
                  href={`/profile/${user.id}`}
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 text-xs text-red-400 hover:text-red-300 border border-red-600/30 hover:border-red-500/60 px-2.5 py-1 rounded transition-colors font-semibold uppercase tracking-wider"
                >
                  Profile
                </Link>

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
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Grant Account Labels <span className="text-white/30 normal-case font-normal">(multi-select)</span></p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {ALL_LABEL_OPTIONS.map(opt => {
                        const rawLabels = (user as { accountLabels?: string | null }).accountLabels;
                        const userLabels: string[] = rawLabels ? (() => { try { const p = JSON.parse(rawLabels); return Array.isArray(p) ? p : []; } catch { return []; } })() : [];
                        const isActive = userLabels.includes(opt.value);
                        return (
                          <Button
                            key={opt.value}
                            size="sm"
                            variant={isActive ? "default" : "outline"}
                            className={isActive ? "bg-red-600 hover:bg-red-700 text-white" : "border-white/20 text-white/60 hover:text-white"}
                            onClick={() => {
                              const next = isActive
                                ? userLabels.filter(l => l !== opt.value)
                                : [...userLabels, opt.value];
                              setAccountLabelsMutation.mutate({ userId: user.id, labels: next as AccountLabel[] });
                            }}
                            disabled={setAccountLabelsMutation.isPending}
                          >
                            {opt.display}
                          </Button>
                        );
                      })}
                    </div>
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

                  {/* Edit Stats */}
                  <div className="pt-2 border-t border-white/10">
                    <UserStatsEditor userId={user.id} user={user} utils={utils} />
                  </div>

                  {/* Delete user */}
                  <div className="pt-2 border-t border-red-900/30">
                    <p className="text-red-400/60 text-xs uppercase tracking-widest mb-2">Danger Zone</p>
                    {deleteConfirmId === user.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs">Permanently delete this user and ALL their data?</span>
                        <Button size="sm" className="bg-red-700 hover:bg-red-800 text-white" onClick={() => deleteUser.mutate({ userId: user.id })} disabled={deleteUser.isPending}>
                          {deleteUser.isPending ? "Deleting..." : "Yes, Delete"}
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white/60" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="border-red-600/40 text-red-400 hover:bg-red-600/20" onClick={() => setDeleteConfirmId(user.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete User
                      </Button>
                    )}
                  </div>
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

/// ─── Danger Zone Tab ─────────────────────────────────────────
function DangerZoneTab() {
  const utils = trpc.useUtils();
  const [confirmAction, setConfirmAction] = useState<"stats" | "submissions" | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const resetStats = trpc.admin.resetAllStats.useMutation({
    onSuccess: () => { setConfirmAction(null); setConfirmText(""); toast.success("All stats have been reset"); },
    onError: (e) => toast.error(e.message),
  });
  const resetSubmissions = trpc.admin.resetAllSubmissions.useMutation({
    onSuccess: () => { setConfirmAction(null); setConfirmText(""); toast.success("All submissions have been reset"); },
    onError: (e) => toast.error(e.message),
  });

  const CONFIRM_STATS = "RESET STATS";
  const CONFIRM_SUBS = "RESET SUBMISSIONS";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-red-500" />
        <div>
          <h2 className="text-white font-bold text-lg">Danger Zone</h2>
          <p className="text-white/40 text-sm">These actions are irreversible. Proceed with extreme caution.</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Reset All Stats */}
        <div className="border border-red-600/30 bg-red-950/20 rounded-lg p-5">
          <h3 className="text-white font-semibold mb-1">Reset All Stats</h3>
          <p className="text-white/50 text-sm mb-4">
            Deletes all battle records, all votes, all song reactions (🔥/🗑️), and resets fire/trash counts on every submission to zero.
            User accounts and songs are preserved.
          </p>
          {confirmAction === "stats" ? (
            <div className="space-y-3">
              <p className="text-red-400 text-sm font-semibold">Type <span className="font-mono bg-red-900/40 px-1 rounded">{CONFIRM_STATS}</span> to confirm:</p>
              <div className="flex gap-2">
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_STATS}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono"
                />
                <Button
                  className="bg-red-700 hover:bg-red-800 text-white flex-shrink-0"
                  onClick={() => resetStats.mutate()}
                  disabled={confirmText !== CONFIRM_STATS || resetStats.isPending}
                >
                  {resetStats.isPending ? "Resetting..." : "Confirm Reset"}
                </Button>
                <Button variant="outline" className="border-white/20 text-white/60 flex-shrink-0" onClick={() => { setConfirmAction(null); setConfirmText(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="border-red-600/50 text-red-400 hover:bg-red-600/20" onClick={() => { setConfirmAction("stats"); setConfirmText(""); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Reset All Stats
            </Button>
          )}
        </div>

        {/* Reset All Submissions */}
        <div className="border border-red-600/30 bg-red-950/20 rounded-lg p-5">
          <h3 className="text-white font-semibold mb-1">Reset All Submissions</h3>
          <p className="text-white/50 text-sm mb-4">
            Deletes all Music Review queue submissions, all Music Wars wheel entries, all votes, and closes the active battle.
            User accounts, songs, and battle records are preserved.
          </p>
          {confirmAction === "submissions" ? (
            <div className="space-y-3">
              <p className="text-red-400 text-sm font-semibold">Type <span className="font-mono bg-red-900/40 px-1 rounded">{CONFIRM_SUBS}</span> to confirm:</p>
              <div className="flex gap-2">
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_SUBS}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono"
                />
                <Button
                  className="bg-red-700 hover:bg-red-800 text-white flex-shrink-0"
                  onClick={() => resetSubmissions.mutate()}
                  disabled={confirmText !== CONFIRM_SUBS || resetSubmissions.isPending}
                >
                  {resetSubmissions.isPending ? "Resetting..." : "Confirm Reset"}
                </Button>
                <Button variant="outline" className="border-white/20 text-white/60 flex-shrink-0" onClick={() => { setConfirmAction(null); setConfirmText(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="border-red-600/50 text-red-400 hover:bg-red-600/20" onClick={() => { setConfirmAction("submissions"); setConfirmText(""); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Reset All Submissions
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Daily Wheel Tab ─────────────────────────────────────────
const PRIZE_COLORS: Record<string, string> = {
  free_story_post:  "text-red-400",
  bogo_permanent:   "text-red-300",
  free_page_post:   "text-red-400",
  line_skip:        "text-blue-400",
  promo_20off:      "text-orange-400",
  promo_10off:      "text-orange-300",
  unlimited_promo:  "text-yellow-400",
  try_again:        "text-white/40",
};

function DailyWheelTab() {
  const [search, setSearch] = useState("");
  const { data: allSpins, isLoading } = trpc.dailyWheel.adminGetAllSpins.useQuery();

  const filtered = (allSpins ?? []).filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.userName ?? "").toLowerCase().includes(q) ||
      (s.userEmail ?? "").toLowerCase().includes(q) ||
      s.prizeLabel.toLowerCase().includes(q) ||
      s.spinDate.includes(q)
    );
  });

  // Summary stats
  const totalSpins = allSpins?.length ?? 0;
  const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const todaySpins = (allSpins ?? []).filter(s => s.spinDate === todayDate).length;
  const prizeBreakdown = (allSpins ?? []).reduce((acc, s) => {
    acc[s.prizeLabel] = (acc[s.prizeLabel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-['Anton'] text-2xl uppercase">Daily Wheel History</h2>
        <div className="text-white/40 text-sm">
          <span className="text-white font-semibold">{totalSpins}</span> total spins ·{" "}
          <span className="text-white font-semibold">{todaySpins}</span> today
        </div>
      </div>

      {/* Prize breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(prizeBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => (
            <div key={label} className="border border-white/10 bg-white/[0.03] p-3 rounded">
              <div className="text-white/40 text-xs mb-1 truncate">{label}</div>
              <div className="text-white font-bold text-xl">{count}</div>
            </div>
          ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, prize, or date…"
          className="pl-9 bg-white/5 border-white/10 text-white placeholder-white/30"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-white/30 text-sm py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/30 text-sm py-8 text-center">No spin records found.</div>
      ) : (
        <div className="border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-0 text-xs text-white/40 uppercase tracking-widest px-4 py-2 border-b border-white/10 bg-white/[0.02]">
            <span>User</span>
            <span>Prize</span>
            <span>Date</span>
            <span>Profile</span>
          </div>
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {filtered.map(spin => (
              <div key={spin.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-0 items-center px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div>
                  <div className="text-white text-sm font-semibold truncate">{spin.userName ?? "Unknown"}</div>
                  <div className="text-white/30 text-xs truncate">{spin.userEmail ?? `User #${spin.userId}`}</div>
                </div>
                <div className={`text-sm font-semibold truncate ${PRIZE_COLORS[spin.prizeKey] ?? "text-white/60"}`}>
                  {spin.prizeLabel}
                </div>
                <div className="text-white/40 text-xs whitespace-nowrap px-3">{spin.spinDate}</div>
                <Link
                  href={`/profile/${spin.userId}`}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-600/30 hover:border-red-500/60 px-2.5 py-1 rounded transition-colors font-semibold uppercase tracking-wider whitespace-nowrap"
                >
                  Profile
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Live Cook Up Admin Tab ─────────────────────────────────
function LiveCookUpAdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<"streams" | "coins" | "gifts">("streams");

  const { data: allStreams, refetch: refetchStreams } = trpc.admin.adminGetLiveStreams.useQuery();
  const { data: coinRequests, refetch: refetchCoins } = trpc.admin.adminGetCoinRequests.useQuery();
  const { data: allGifts } = trpc.admin.adminGetGiftLedger.useQuery({ limit: 200 });

  const approveCoinMutation = trpc.admin.adminApproveCoinPurchase.useMutation({
    onSuccess: () => { toast.success("Coins approved and added!"); refetchCoins(); },
    onError: (err: any) => toast.error(err.message),
  });

  const endStreamMutation = trpc.admin.adminMarkPayoutSent.useMutation({
    onSuccess: () => { toast.success("Stream marked as paid out"); refetchStreams(); },
    onError: (err: any) => toast.error(err.message),
  });

  const totalGiftUsd = allGifts?.reduce((sum: number, g: any) => sum + (g.usdValueCents ?? 0), 0) ?? 0;
  const pendingCoins = coinRequests?.filter((r: any) => r.status === "pending").length ?? 0;
  const activeStreams = allStreams?.filter((s: any) => s.status === "live").length ?? 0;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border border-red-600/20 bg-red-600/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-red-400" />
            <span className="text-xs text-white/40 uppercase tracking-widest">Active Streams</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{activeStreams}</div>
        </div>
        <div className="border border-yellow-600/20 bg-yellow-600/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-white/40 uppercase tracking-widest">Pending Coin Requests</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{pendingCoins}</div>
        </div>
        <div className="border border-green-600/20 bg-green-600/5 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-green-400" />
            <span className="text-xs text-white/40 uppercase tracking-widest">Total Gift Value</span>
          </div>
          <div className="text-2xl font-bold text-green-400">${(totalGiftUsd / 100).toFixed(2)}</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {(["streams", "coins", "gifts"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveSubTab(t)}
            className={`px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
              activeSubTab === t ? "bg-red-600 text-white" : "border border-white/20 text-white/50 hover:text-white"
            }`}
          >
            {t === "streams" ? "Live Streams" : t === "coins" ? "Coin Requests" : "Gift Ledger"}
          </button>
        ))}
      </div>

      {/* Streams */}
      {activeSubTab === "streams" && (
        <div className="space-y-3">
          {!allStreams || allStreams.length === 0 ? (
            <p className="text-white/30 text-sm">No streams yet.</p>
          ) : allStreams.map((s: any) => (
            <div key={s.id} className="border border-white/10 bg-white/[0.03] rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {s.status === "live" && (
                    <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                    </span>
                  )}
                  <span className="text-white font-semibold text-sm truncate">{s.title}</span>
                </div>
                <p className="text-white/40 text-xs">
                  {s.streamer?.artistName || s.streamer?.name || "Unknown"} · {s.viewerCount ?? 0} viewers · 🎁 {s.totalGiftCoins ?? 0} coins gifted (${((s.totalGiftUsd ?? 0) / 100).toFixed(2)})
                </p>
                <p className="text-white/20 text-xs mt-0.5">{new Date(s.createdAt).toLocaleString()}</p>
              </div>
              {s.status === "live" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => endStreamMutation.mutate({ streamId: s.id })}

                  className="border-red-600/40 text-red-400 hover:bg-red-600/10 shrink-0"
                >
                  Force End
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Coin Requests */}
      {activeSubTab === "coins" && (
        <div className="space-y-3">
          {!coinRequests || coinRequests.length === 0 ? (
            <p className="text-white/30 text-sm">No coin purchase requests yet.</p>
          ) : coinRequests.map((req: any) => (
            <div key={req.id} className="border border-white/10 bg-white/[0.03] rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-sm uppercase ${
                    req.status === "pending" ? "bg-yellow-600/20 text-yellow-400" :
                    req.status === "approved" ? "bg-green-600/20 text-green-400" :
                    "bg-red-600/20 text-red-400"
                  }`}>{req.status}</span>
                  <span className="text-white font-semibold text-sm">{req.user?.artistName || req.user?.name || "Unknown"}</span>
                </div>
                <p className="text-white/60 text-sm">
                  <span className="text-yellow-400 font-bold">{req.coins.toLocaleString()} coins</span>
                  {" · "}
                  <span className="text-white">${(req.usdCents / 100).toFixed(2)}</span>
                </p>
                {req.paymentNote && (
                  <p className="text-white/30 text-xs mt-0.5">Note: {req.paymentNote}</p>
                )}
                <p className="text-white/20 text-xs mt-0.5">{new Date(req.createdAt).toLocaleString()}</p>
              </div>
              {req.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                  onClick={() => approveCoinMutation.mutate({ purchaseId: req.id, approve: true })}
                  disabled={approveCoinMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => approveCoinMutation.mutate({ purchaseId: req.id, approve: false })}
                    disabled={approveCoinMutation.isPending}
                    className="border-red-600/40 text-red-400 hover:bg-red-600/10"
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gift Ledger */}
      {activeSubTab === "gifts" && (
        <div className="space-y-3">
          {!allGifts || allGifts.length === 0 ? (
            <p className="text-white/30 text-sm">No gifts sent yet.</p>
          ) : allGifts.map((g: any) => (
            <div key={g.id} className="border border-white/10 bg-white/[0.03] rounded-lg px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-sm">
                  <span className="text-red-400 font-semibold">{g.from?.artistName || g.from?.name || "?"}</span>
                  {" → "}
                  <span className="text-white font-semibold">{g.to?.artistName || g.to?.name || "?"}</span>
                  {" · "}
                  <span className="text-yellow-400">{g.giftType?.name || "Gift"}</span>
                </p>
                <p className="text-white/30 text-xs mt-0.5">
                  {g.coinCost} coins · ${((g.usdValueCents ?? 0) / 100).toFixed(2)} · {new Date(g.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="text-white/40 text-lg shrink-0">{g.giftType?.emoji || "🎁"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────
type Tab = "users" | "orders" | "analytics" | "settings" | "danger" | "rewards" | "dailywheel" | "live";
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "orders", label: "Promo Orders", icon: ShoppingBag },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Site Settings", icon: Settings },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  { id: "rewards", label: "Rewards", icon: Trophy },
  { id: "dailywheel", label: "Daily Wheel", icon: Disc },
  { id: "live", label: "Live Cook Up", icon: Radio },
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
          <div className="mt-4">
            <Link href="/admin/stats">
              <button className="flex items-center gap-2 text-xs border border-green-500/40 text-green-400 bg-green-500/10 px-4 py-2 hover:bg-green-500/20 transition-all uppercase tracking-widest font-semibold">
                <Activity className="w-3.5 h-3.5" />
                Live Site Stats
              </button>
            </Link>
          </div>
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
        {activeTab === "danger" && <DangerZoneTab />}
        {activeTab === "rewards" && <AdminRewardsTab />}
        {activeTab === "dailywheel" && <DailyWheelTab />}
        {activeTab === "live" && <LiveCookUpAdminTab />}
      </div>
    </div>
  );
}
