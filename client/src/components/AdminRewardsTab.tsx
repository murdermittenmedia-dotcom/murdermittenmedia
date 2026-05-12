/* ============================================================
   AdminRewardsTab — Full reward control panel for admins.
   Sub-tabs:
     - Rewards Catalog: list/create/edit/pause rewards
     - User Rewards: search user, view/grant/revoke rewards & badges
     - Reward Logs: audit trail
     - XP Override: manually set user XP
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Trophy, Shield, Zap, Clock, Plus, Edit2, Pause, Play,
  Search, Trash2, CheckCircle2, XCircle, Gift, Star,
  ChevronDown, ChevronUp, RefreshCw, User
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
const RARITY_COLORS: Record<string, string> = {
  common:       "bg-white/10 text-white/60",
  rare:         "bg-blue-900/30 text-blue-400",
  epic:         "bg-purple-900/30 text-purple-400",
  legendary:    "bg-yellow-900/30 text-yellow-400",
  hall_of_fame: "bg-red-900/30 text-red-400",
};
const STATUS_COLORS: Record<string, string> = {
  locked:    "bg-white/5 text-white/30",
  unlocked:  "bg-yellow-900/20 text-yellow-400",
  claimable: "bg-green-900/20 text-green-400",
  active:    "bg-blue-900/20 text-blue-400",
  redeemed:  "bg-white/5 text-white/40",
  expired:   "bg-white/5 text-white/20",
  revoked:   "bg-red-900/20 text-red-400/60",
};

// ── Rewards Catalog sub-tab ───────────────────────────────────
function RewardsCatalogTab() {
  const utils = trpc.useUtils();
  const { data: rewards, isLoading } = trpc.rewards.getAll.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "achievement" as const,
    rarity: "common" as const,
    requirements: "{}",
    requiresAdminApproval: false,
    badgeIcon: "",
    badgeColor: "",
  });

  const createMutation = trpc.rewards.create.useMutation({
    onSuccess: () => {
      toast.success("Reward created!");
      setShowCreate(false);
      setForm({ name: "", description: "", type: "achievement", rarity: "common", requirements: "{}", requiresAdminApproval: false, badgeIcon: "", badgeColor: "" });
      utils.rewards.getAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.rewards.update.useMutation({
    onSuccess: () => {
      toast.success("Reward updated!");
      setEditingId(null);
      utils.rewards.getAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleCreate() {
    let req: Record<string, unknown> = {};
    try { req = JSON.parse(form.requirements); } catch { toast.error("Invalid requirements JSON"); return; }
    createMutation.mutate({
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      rarity: form.rarity,
      requirements: req,
      requiresAdminApproval: form.requiresAdminApproval,
      badgeIcon: form.badgeIcon || undefined,
      badgeColor: form.badgeColor || undefined,
    });
  }

  if (isLoading) return <div className="text-white/30 py-8 text-center">Loading rewards...</div>;

  return (
    <div>
      {/* Create button */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-white/50 text-sm">{rewards?.length ?? 0} rewards defined</p>
        <Button
          size="sm"
          onClick={() => setShowCreate(v => !v)}
          className="bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-widest gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCreate ? "Cancel" : "New Reward"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border border-white/10 bg-white/[0.03] p-5 mb-6 space-y-3">
          <h3 className="font-semibold text-white text-sm uppercase tracking-widest">Create Reward</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Reward name" className="bg-white/5 border-white/10 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Badge Icon (emoji)</label>
              <Input value={form.badgeIcon} onChange={e => setForm(f => ({ ...f, badgeIcon: e.target.value }))} placeholder="🏆" className="bg-white/5 border-white/10 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof form.type }))}
                className="w-full bg-[#111] border border-white/10 text-white text-sm rounded px-3 py-2"
              >
                {["level","achievement","promo","wars","review","supporter","verified","rare"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Rarity</label>
              <select
                value={form.rarity}
                onChange={e => setForm(f => ({ ...f, rarity: e.target.value as typeof form.rarity }))}
                className="w-full bg-[#111] border border-white/10 text-white text-sm rounded px-3 py-2"
              >
                {["common","rare","epic","legendary","hall_of_fame"].map(r => (
                  <option key={r} value={r}>{r.replace("_"," ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Badge Color (hex)</label>
              <Input value={form.badgeColor} onChange={e => setForm(f => ({ ...f, badgeColor: e.target.value }))} placeholder="#D10000" className="bg-white/5 border-white/10 text-white text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="reqAdmin"
                checked={form.requiresAdminApproval}
                onChange={e => setForm(f => ({ ...f, requiresAdminApproval: e.target.checked }))}
                className="accent-red-600"
              />
              <label htmlFor="reqAdmin" className="text-xs text-white/60">Requires admin approval</label>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Description</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this reward..." className="bg-white/5 border-white/10 text-white text-sm resize-none" rows={2} />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">
              Requirements JSON
              <span className="ml-2 text-white/30 font-normal">
                e.g. {"{"}"minXP": 500, "minWins": 3{"}"}
              </span>
            </label>
            <Textarea
              value={form.requirements}
              onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
              placeholder='{"minXP": 500}'
              className="bg-white/5 border-white/10 text-white text-sm font-mono resize-none"
              rows={3}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !form.name}
            className="bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-widest"
          >
            {createMutation.isPending ? "Creating..." : "Create Reward"}
          </Button>
        </div>
      )}

      {/* Rewards list */}
      <div className="space-y-2">
        {(!rewards || rewards.length === 0) && (
          <div className="text-center py-8 text-white/30">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No rewards defined yet</p>
          </div>
        )}
        {rewards?.map(reward => (
          <RewardRow
            key={reward.id}
            reward={reward}
            isEditing={editingId === reward.id}
            onEdit={() => setEditingId(editingId === reward.id ? null : reward.id)}
            onUpdate={(data) => updateMutation.mutate({ id: reward.id, ...data })}
            isUpdating={updateMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function RewardRow({
  reward,
  isEditing,
  onEdit,
  onUpdate,
  isUpdating,
}: {
  reward: {
    id: number;
    name: string;
    description?: string | null;
    type: string;
    rarity: string;
    isActive: boolean;
    isPaused?: boolean | null;
    requiresAdminApproval: boolean;
    badgeIcon?: string | null;
    badgeColor?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requirements?: any;
  };
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (data: { isActive?: boolean; isPaused?: boolean; name?: string; description?: string }) => void;
  isUpdating: boolean;
}) {
  const [editName, setEditName] = useState(reward.name);
  const [editDesc, setEditDesc] = useState(reward.description ?? "");
  const rarityClass = RARITY_COLORS[reward.rarity] ?? RARITY_COLORS.common;

  return (
    <div className="border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex items-center justify-center text-lg flex-shrink-0">
          {reward.badgeIcon ?? "🏅"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-white text-sm">{reward.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-widest ${rarityClass}`}>
              {reward.rarity.replace("_", " ")}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest">{reward.type}</span>
            {!reward.isActive && (
              <span className="text-[10px] text-red-400/60 uppercase tracking-widest font-semibold">Inactive</span>
            )}
            {reward.isPaused && (
              <span className="text-[10px] text-yellow-400/60 uppercase tracking-widest font-semibold">Paused</span>
            )}
            {reward.requiresAdminApproval && (
              <span className="text-[10px] text-purple-400/60 uppercase tracking-widest">Admin Approval</span>
            )}
          </div>
          {reward.description && (
            <p className="text-white/40 text-xs mb-1">{reward.description}</p>
          )}
          {reward.requirements && Object.keys(reward.requirements).length > 0 && (
            <div className="text-[10px] text-white/30 font-mono">
              {JSON.stringify(reward.requirements)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate({ isPaused: !reward.isPaused })}
            disabled={isUpdating}
            className="h-7 px-2 text-[10px] border-white/10 text-white/50 hover:text-white"
          >
            {reward.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate({ isActive: !reward.isActive })}
            disabled={isUpdating}
            className={`h-7 px-2 text-[10px] border-white/10 ${reward.isActive ? "text-green-400 hover:text-red-400" : "text-red-400 hover:text-green-400"}`}
          >
            {reward.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onEdit}
            className="h-7 px-2 text-[10px] border-white/10 text-white/50 hover:text-white"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {/* Inline edit */}
      {isEditing && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="Name" />
          <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="bg-white/5 border-white/10 text-white text-sm resize-none" rows={2} placeholder="Description" />
          <Button
            size="sm"
            onClick={() => onUpdate({ name: editName, description: editDesc })}
            disabled={isUpdating}
            className="bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-widest"
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// ── User Rewards sub-tab ──────────────────────────────────────
function UserRewardsTab() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [grantRewardId, setGrantRewardId] = useState("");
  const [grantNotes, setGrantNotes] = useState("");
  const [revokeRewardId, setRevokeRewardId] = useState<number | null>(null);
  const [revokeNotes, setRevokeNotes] = useState("");
  const [badgeForm, setBadgeForm] = useState({ badge: "", label: "", rarity: "common" as const, badgeIcon: "", badgeColor: "" });
  const [showBadgeForm, setShowBadgeForm] = useState(false);

  const { data: allUsers } = trpc.rewards.adminGetAllUserStats.useQuery();
  const { data: userRewards, refetch: refetchUserRewards } = trpc.rewards.adminGetUserRewards.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: userBadges, refetch: refetchBadges } = trpc.rewards.getBadgesForUser.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: allRewards } = trpc.rewards.getAll.useQuery();

  const grantMutation = trpc.rewards.adminGrant.useMutation({
    onSuccess: () => {
      toast.success("Reward granted!");
      setGrantRewardId("");
      setGrantNotes("");
      refetchUserRewards();
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.rewards.adminRevoke.useMutation({
    onSuccess: () => {
      toast.success("Reward revoked!");
      setRevokeRewardId(null);
      setRevokeNotes("");
      refetchUserRewards();
    },
    onError: (err) => toast.error(err.message),
  });

  const grantBadgeMutation = trpc.rewards.adminGrantBadge.useMutation({
    onSuccess: () => {
      toast.success("Badge granted!");
      setShowBadgeForm(false);
      setBadgeForm({ badge: "", label: "", rarity: "common", badgeIcon: "", badgeColor: "" });
      refetchBadges();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeBadgeMutation = trpc.rewards.adminRemoveBadge.useMutation({
    onSuccess: () => {
      toast.success("Badge removed!");
      refetchBadges();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredUsers = allUsers?.filter(u => {
    const q = search.toLowerCase();
    return (u.name?.toLowerCase().includes(q) || u.artistName?.toLowerCase().includes(q) || String(u.id).includes(q));
  }) ?? [];

  const selectedUser = allUsers?.find(u => u.id === selectedUserId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* User list */}
      <div className="md:col-span-1">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 bg-white/5 border-white/10 text-white text-sm"
          />
        </div>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {filteredUsers.slice(0, 50).map(u => (
            <button
              key={u.id}
              onClick={() => setSelectedUserId(u.id)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedUserId === u.id ? "bg-red-600/20 border border-red-600/40 text-white" : "border border-transparent text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="font-semibold">{u.artistName || u.name || `User #${u.id}`}</div>
              <div className="text-[10px] text-white/30 flex gap-2">
                <span>{u.xp} XP</span>
                <span>·</span>
                <span>{u.level}</span>
                <span>·</span>
                <span>🔥{u.streak}</span>
              </div>
            </button>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-white/30 text-xs text-center py-4">No users found</div>
          )}
        </div>
      </div>

      {/* User detail */}
      <div className="md:col-span-2">
        {!selectedUserId ? (
          <div className="text-center py-12 text-white/30">
            <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a user to manage their rewards</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* User header */}
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <div className="font-['Anton'] text-xl text-white mb-1">
                {selectedUser?.artistName || selectedUser?.name || `User #${selectedUserId}`}
              </div>
              <div className="flex gap-4 text-xs text-white/50">
                <span>Artist XP: <strong className="text-white">{selectedUser?.xp ?? 0}</strong></span>
                <span>Fan XP: <strong className="text-white">{selectedUser?.fanXP ?? 0}</strong></span>
                <span>Level: <strong className="text-white">{selectedUser?.level}</strong></span>
                <span>Streak: <strong className="text-orange-400">🔥{selectedUser?.streak ?? 0}</strong></span>
              </div>
            </div>

            {/* Grant reward */}
            <div className="border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-3 flex items-center gap-2">
                <Gift className="w-3.5 h-3.5" /> Grant Reward
              </h4>
              <div className="flex gap-2">
                <select
                  value={grantRewardId}
                  onChange={e => setGrantRewardId(e.target.value)}
                  className="flex-1 bg-[#111] border border-white/10 text-white text-sm rounded px-3 py-2"
                >
                  <option value="">Select reward...</option>
                  {allRewards?.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.rarity})</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => grantMutation.mutate({ userId: selectedUserId, rewardId: Number(grantRewardId), notes: grantNotes || undefined })}
                  disabled={!grantRewardId || grantMutation.isPending}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs uppercase tracking-widest"
                >
                  Grant
                </Button>
              </div>
              <Input
                value={grantNotes}
                onChange={e => setGrantNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="mt-2 bg-white/5 border-white/10 text-white text-sm"
              />
            </div>

            {/* Current rewards */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-3 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" /> Rewards ({userRewards?.length ?? 0})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userRewards?.map(ur => (
                  <div key={ur.userReward.id} className="border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{ur.reward?.name ?? `Reward #${ur.userReward.rewardId}`}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-widest ${STATUS_COLORS[ur.userReward.status] ?? "text-white/40"}`}>
                          {ur.userReward.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5">
                        {ur.userReward.earnedVia && `via ${ur.userReward.earnedVia.replace(/_/g, " ")} · `}
                        {ur.userReward.unlockedAt && `Unlocked ${new Date(ur.userReward.unlockedAt).toLocaleDateString()}`}
                        {ur.userReward.grantedBy && ` · Granted by admin`}
                        {ur.userReward.notes && ` · ${ur.userReward.notes}`}
                      </div>
                    </div>
                    {revokeRewardId === ur.userReward.rewardId ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={revokeNotes}
                          onChange={e => setRevokeNotes(e.target.value)}
                          placeholder="Reason..."
                          className="w-32 bg-white/5 border-white/10 text-white text-xs h-7"
                        />
                        <Button
                          size="sm"
                          onClick={() => revokeMutation.mutate({ userId: selectedUserId, rewardId: ur.userReward.rewardId, notes: revokeNotes || undefined })}
                          disabled={revokeMutation.isPending}
                          className="h-7 px-2 bg-red-700 hover:bg-red-600 text-white text-[10px]"
                        >
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRevokeRewardId(null)} className="h-7 px-2 border-white/10 text-white/50">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRevokeRewardId(ur.userReward.rewardId)}
                        className="h-7 px-2 border-red-600/30 text-red-400/60 hover:text-red-400 text-[10px]"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
                {(!userRewards || userRewards.length === 0) && (
                  <div className="text-white/30 text-xs text-center py-4">No rewards yet</div>
                )}
              </div>
            </div>

            {/* Badges */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-white/60 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Badges ({userBadges?.length ?? 0})
                </h4>
                <Button
                  size="sm"
                  onClick={() => setShowBadgeForm(v => !v)}
                  className="h-7 px-3 bg-purple-700 hover:bg-purple-600 text-white text-[10px] uppercase tracking-widest gap-1"
                >
                  <Plus className="w-3 h-3" /> Assign Badge
                </Button>
              </div>
              {showBadgeForm && (
                <div className="border border-white/10 bg-white/[0.03] p-3 mb-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">Badge Key *</label>
                      <Input value={badgeForm.badge} onChange={e => setBadgeForm(f => ({ ...f, badge: e.target.value }))} placeholder="e.g. hall_of_fame" className="bg-white/5 border-white/10 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">Label</label>
                      <Input value={badgeForm.label} onChange={e => setBadgeForm(f => ({ ...f, label: e.target.value }))} placeholder="Display name" className="bg-white/5 border-white/10 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">Rarity</label>
                      <select
                        value={badgeForm.rarity}
                        onChange={e => setBadgeForm(f => ({ ...f, rarity: e.target.value as typeof badgeForm.rarity }))}
                        className="w-full bg-[#111] border border-white/10 text-white text-xs rounded px-2 py-1.5"
                      >
                        {["common","rare","epic","legendary","hall_of_fame"].map(r => (
                          <option key={r} value={r}>{r.replace("_"," ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block">Icon (emoji)</label>
                      <Input value={badgeForm.badgeIcon} onChange={e => setBadgeForm(f => ({ ...f, badgeIcon: e.target.value }))} placeholder="🏆" className="bg-white/5 border-white/10 text-white text-xs" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => grantBadgeMutation.mutate({
                      userId: selectedUserId,
                      badge: badgeForm.badge,
                      label: badgeForm.label || undefined,
                      rarity: badgeForm.rarity,
                      badgeIcon: badgeForm.badgeIcon || undefined,
                      badgeColor: badgeForm.badgeColor || undefined,
                    })}
                    disabled={!badgeForm.badge || grantBadgeMutation.isPending}
                    className="bg-purple-700 hover:bg-purple-600 text-white text-xs uppercase tracking-widest"
                  >
                    {grantBadgeMutation.isPending ? "Granting..." : "Grant Badge"}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {userBadges?.map(badge => (
                  <div key={badge.id} className="flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
                    <span>{badge.badgeIcon ?? "🏅"}</span>
                    <span>{badge.label ?? badge.badge}</span>
                    <span className="text-white/30 text-[10px]">({badge.rarity})</span>
                    <button
                      onClick={() => removeBadgeMutation.mutate({ badgeId: badge.id })}
                      className="ml-1 text-red-400/50 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {(!userBadges || userBadges.length === 0) && (
                  <span className="text-white/30 text-xs">No badges assigned</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reward Logs sub-tab ───────────────────────────────────────
function RewardLogsTab() {
  const [limit, setLimit] = useState(100);
  const { data: logs, isLoading, refetch } = trpc.rewards.adminGetLogs.useQuery({ limit });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/50 text-sm">{logs?.length ?? 0} log entries</p>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="bg-[#111] border border-white/10 text-white text-xs rounded px-2 py-1.5"
          >
            {[50, 100, 200, 500].map(n => <option key={n} value={n}>Last {n}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 px-2 border-white/10 text-white/50 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="text-white/30 text-center py-8">Loading logs...</div>
      ) : (
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {(!logs || logs.length === 0) && (
            <div className="text-white/30 text-center py-8">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reward logs yet</p>
            </div>
          )}
          {logs?.map((log, i) => (
            <div key={i} className="border border-white/10 bg-white/[0.02] px-3 py-2 flex items-center gap-3 text-xs">
              <span className="text-white/30 font-mono w-20 flex-shrink-0">
                {new Date(log.createdAt).toLocaleDateString()}
              </span>
              <span className={`px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-widest text-[10px] flex-shrink-0 ${
                log.action === "unlock" ? "bg-yellow-900/30 text-yellow-400" :
                log.action === "grant" ? "bg-green-900/30 text-green-400" :
                log.action === "revoke" ? "bg-red-900/30 text-red-400" :
                log.action === "claim" ? "bg-blue-900/30 text-blue-400" :
                "bg-white/5 text-white/40"
              }`}>
                {log.action}
              </span>
              <span className="text-white/60 flex-1 min-w-0 truncate">
                User #{log.userId} · Reward #{log.rewardId}
                {log.notes && ` · ${log.notes}`}
              </span>
              {log.performedBy && (
                <span className="text-white/30 flex-shrink-0">by #{log.performedBy}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── XP Override sub-tab ───────────────────────────────────────
function XPOverrideTab() {
  const utils = trpc.useUtils();
  const { data: allUsers } = trpc.rewards.adminGetAllUserStats.useQuery();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newXP, setNewXP] = useState("");
  const [notes, setNotes] = useState("");

  const setXPMutation = trpc.rewards.adminSetXP.useMutation({
    onSuccess: () => {
      toast.success("XP updated!");
      setNewXP("");
      setNotes("");
      utils.rewards.adminGetAllUserStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredUsers = allUsers?.filter(u => {
    const q = search.toLowerCase();
    return (u.name?.toLowerCase().includes(q) || u.artistName?.toLowerCase().includes(q) || String(u.id).includes(q));
  }) ?? [];

  const selectedUser = allUsers?.find(u => u.id === selectedUserId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* User list */}
      <div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 bg-white/5 border-white/10 text-white text-sm"
          />
        </div>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {filteredUsers.slice(0, 50).map(u => (
            <button
              key={u.id}
              onClick={() => { setSelectedUserId(u.id); setNewXP(String(u.xp)); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedUserId === u.id ? "bg-red-600/20 border border-red-600/40 text-white" : "border border-transparent text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="font-semibold">{u.artistName || u.name || `User #${u.id}`}</div>
              <div className="text-[10px] text-white/30 flex gap-2">
                <span>Artist XP: {u.xp}</span>
                <span>·</span>
                <span>Fan XP: {u.fanXP}</span>
                <span>·</span>
                <span>{u.level}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* XP form */}
      <div>
        {!selectedUserId ? (
          <div className="text-center py-12 text-white/30">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a user to override their XP</p>
          </div>
        ) : (
          <div className="border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div className="font-['Anton'] text-xl text-white">
              {selectedUser?.artistName || selectedUser?.name || `User #${selectedUserId}`}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-white/50">
              <div>Current Artist XP: <strong className="text-white">{selectedUser?.xp ?? 0}</strong></div>
              <div>Level: <strong className="text-white">{selectedUser?.level}</strong></div>
              <div>Current Fan XP: <strong className="text-white">{selectedUser?.fanXP ?? 0}</strong></div>
              <div>Fan Level: <strong className="text-white">{selectedUser?.fanLevel}</strong></div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">New Artist XP Value</label>
              <Input
                type="number"
                value={newXP}
                onChange={e => setNewXP(e.target.value)}
                placeholder="e.g. 1500"
                className="bg-white/5 border-white/10 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Reason / Notes</label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Why are you overriding XP?"
                className="bg-white/5 border-white/10 text-white text-sm"
              />
            </div>
            <Button
              onClick={() => setXPMutation.mutate({ userId: selectedUserId, xp: Number(newXP), notes: notes || undefined })}
              disabled={!newXP || isNaN(Number(newXP)) || setXPMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-xs uppercase tracking-widest w-full"
            >
              {setXPMutation.isPending ? "Updating..." : "Override XP"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main AdminRewardsTab ──────────────────────────────────────
type SubTab = "catalog" | "users" | "logs" | "xp";

export function AdminRewardsTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("catalog");

  const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "catalog", label: "Rewards Catalog", icon: Trophy },
    { id: "users", label: "User Rewards", icon: User },
    { id: "logs", label: "Reward Logs", icon: Clock },
    { id: "xp", label: "XP Override", icon: Zap },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-all ${
              activeSubTab === tab.id
                ? "bg-red-600 text-white"
                : "border border-white/20 text-white/50 hover:text-white"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "catalog" && <RewardsCatalogTab />}
      {activeSubTab === "users" && <UserRewardsTab />}
      {activeSubTab === "logs" && <RewardLogsTab />}
      {activeSubTab === "xp" && <XPOverrideTab />}
    </div>
  );
}
