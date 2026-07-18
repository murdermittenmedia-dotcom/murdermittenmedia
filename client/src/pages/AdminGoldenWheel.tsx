/* ============================================================
   ADMIN — Golden Wheel Dashboard
   Prize CRUD, spin history, status management
   ============================================================ */

import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Trophy, Plus, Pencil, Trash2, CheckCircle, AlertCircle,
  RotateCcw, Eye, Download, Loader2, X, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────
interface Prize {
  id: number;
  name: string;
  description: string | null;
  weight: number;
  enabled: boolean;
  rewardType: string;
  rewardValue: string | null;
  inventoryLimit: number | null;
  remainingInventory: number | null;
  couponExpiryDays: number | null;
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  stripe_coupon: "Stripe Discount Code",
  promo_service: "Promo Service",
  physical_item: "Physical Item",
  cash_prize: "Cash Prize",
};

// ─── Prize Form Modal ─────────────────────────────────────────
function PrizeModal({
  prize,
  onClose,
  onSave,
}: {
  prize: Partial<Prize> | null;
  onClose: () => void;
  onSave: (data: Omit<Prize, "id"> & { id?: number }) => void;
}) {
  const [form, setForm] = useState<Omit<Prize, "id"> & { id?: number }>({
    id: prize?.id,
    name: prize?.name ?? "",
    description: prize?.description ?? "",
    weight: prize?.weight ?? 100,
    enabled: prize?.enabled ?? true,
    rewardType: prize?.rewardType ?? "stripe_coupon",
    rewardValue: prize?.rewardValue ?? "",
    inventoryLimit: prize?.inventoryLimit ?? null,
    remainingInventory: prize?.remainingInventory ?? null,
    couponExpiryDays: prize?.couponExpiryDays ?? 90,
  });

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-['Anton'] text-xl uppercase text-yellow-400">
            {form.id ? "Edit Prize" : "Add Prize"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Prize Name *</label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
              placeholder="e.g. 20% Off Next Order"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Description</label>
            <textarea
              value={form.description ?? ""}
              onChange={e => set("description", e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50 resize-none"
              placeholder="Shown to the winner after spinning"
            />
          </div>

          {/* Reward Type */}
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Reward Type *</label>
            <select
              value={form.rewardType}
              onChange={e => set("rewardType", e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
            >
              {Object.entries(REWARD_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Reward Value */}
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">
              {form.rewardType === "stripe_coupon" ? "Discount % (e.g. 20)" : "Reward Value / Description"}
            </label>
            <input
              value={form.rewardValue ?? ""}
              onChange={e => set("rewardValue", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
              placeholder={form.rewardType === "stripe_coupon" ? "20" : "e.g. Free MMM Tee"}
            />
          </div>

          {/* Weight */}
          <div>
            <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">
              Weight (higher = more likely, 1–1000)
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={form.weight}
              onChange={e => set("weight", parseInt(e.target.value) || 1)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
            />
          </div>

          {/* Inventory */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Inventory Limit</label>
              <input
                type="number"
                min={1}
                value={form.inventoryLimit ?? ""}
                onChange={e => {
                  const v = e.target.value ? parseInt(e.target.value) : null;
                  set("inventoryLimit", v);
                  if (v !== null && form.remainingInventory === null) set("remainingInventory", v);
                }}
                placeholder="Unlimited"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Remaining</label>
              <input
                type="number"
                min={0}
                value={form.remainingInventory ?? ""}
                onChange={e => set("remainingInventory", e.target.value ? parseInt(e.target.value) : null)}
                placeholder="—"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
              />
            </div>
          </div>

          {/* Coupon Expiry */}
          {form.rewardType === "stripe_coupon" && (
            <div>
              <label className="text-xs uppercase tracking-widest text-white/50 mb-1 block">Coupon Expiry (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.couponExpiryDays ?? 90}
                onChange={e => set("couponExpiryDays", parseInt(e.target.value) || 90)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500/50"
              />
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled}
              onChange={e => set("enabled", e.target.checked)}
              className="w-4 h-4 accent-yellow-500"
            />
            <label htmlFor="enabled" className="text-sm text-white/70">Prize is active (visible on wheel)</label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 border-white/20 text-white/60">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.name.trim()}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Prize
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────
export default function AdminGoldenWheel() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"prizes" | "spins" | "orders">("prizes");
  const [editingPrize, setEditingPrize] = useState<Partial<Prize> | null | undefined>(undefined);
  const [spinPage, setSpinPage] = useState(1);

  const prizesQuery = trpc.goldenWheel.admin.getPrizes.useQuery();
  const spinsQuery = trpc.goldenWheel.admin.getSpins.useQuery({ page: spinPage, limit: 50 });
  const ordersQuery = trpc.goldenWheel.admin.getOrders.useQuery({ page: 1, limit: 50 });

  const upsertPrize = trpc.goldenWheel.admin.upsertPrize.useMutation({
    onSuccess: () => { prizesQuery.refetch(); setEditingPrize(undefined); toast.success("Prize saved!"); },
    onError: (e) => toast.error(e.message),
  });

  const deletePrize = trpc.goldenWheel.admin.deletePrize.useMutation({
    onSuccess: () => { prizesQuery.refetch(); toast.success("Prize deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const updateSpinStatus = trpc.goldenWheel.admin.updateSpinStatus.useMutation({
    onSuccess: () => { spinsQuery.refetch(); toast.success("Spin status updated"); },
    onError: (e) => toast.error(e.message),
  });

  // Auth guard
  if (loading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
    </div>
  );
  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const handleSavePrize = (data: Omit<Prize, "id"> & { id?: number }) => {
    upsertPrize.mutate({
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      weight: data.weight,
      enabled: data.enabled,
      rewardType: data.rewardType as any,
      rewardValue: data.rewardValue || undefined,
      inventoryLimit: data.inventoryLimit ?? undefined,
      remainingInventory: data.remainingInventory ?? undefined,
      couponExpiryDays: data.couponExpiryDays ?? undefined,
    });
  };

  const exportCSV = () => {
    const spins = spinsQuery.data?.spins ?? [];
    const rows = [
      ["Spin ID", "User", "Email", "Prize", "Coupon Code", "Status", "Date"],
      ...spins.map(s => [
        s.spin.id,
        s.user?.name ?? "Unknown",
        s.user?.email ?? "",
        s.spin.prizeNameSnapshot,
        s.spin.couponCode ?? "",
        s.spin.status,
        new Date(s.spin.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `golden-wheel-spins-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_redemption: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      redeemed: "bg-green-500/20 text-green-400 border-green-500/30",
      flagged: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      revoked: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return map[status] ?? "bg-white/10 text-white/50 border-white/10";
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      {editingPrize !== undefined && (
        <PrizeModal
          prize={editingPrize}
          onClose={() => setEditingPrize(undefined)}
          onSave={handleSavePrize}
        />
      )}

      <section className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-500 text-xs uppercase tracking-[0.3em] mb-1">Admin</p>
              <h1 className="font-['Anton'] text-3xl uppercase">Golden Wheel</h1>
            </div>
            <a
              href="/golden-wheel"
              target="_blank"
              className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <Eye className="w-4 h-4" /> Preview
            </a>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10">
            {(["prizes", "spins", "orders"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-semibold uppercase tracking-widest transition-colors ${
                  tab === t
                    ? "text-yellow-400 border-b-2 border-yellow-400"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── PRIZES TAB ── */}
          {tab === "prizes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white/50 text-sm">
                  {prizesQuery.data?.length ?? 0} prizes configured
                </p>
                <Button
                  onClick={() => setEditingPrize(null)}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Prize
                </Button>
              </div>

              {prizesQuery.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                </div>
              )}

              <div className="space-y-3">
                {(prizesQuery.data ?? []).map(prize => (
                  <div
                    key={prize.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      prize.enabled
                        ? "border-yellow-500/20 bg-yellow-950/20"
                        : "border-white/5 bg-white/3 opacity-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white truncate">{prize.name}</span>
                        {!prize.enabled && (
                          <span className="text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded">Disabled</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-white/40">
                        <span>{REWARD_TYPE_LABELS[prize.rewardType] ?? prize.rewardType}</span>
                        {prize.rewardValue && <span>Value: {prize.rewardValue}</span>}
                        <span>Weight: {prize.weight}</span>
                        {prize.inventoryLimit !== null && (
                          <span>Stock: {prize.remainingInventory ?? 0}/{prize.inventoryLimit}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingPrize(prize)}
                        className="p-2 text-white/40 hover:text-yellow-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${prize.name}"?`)) deletePrize.mutate({ id: prize.id });
                        }}
                        className="p-2 text-white/40 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {!prizesQuery.isLoading && (prizesQuery.data ?? []).length === 0 && (
                  <div className="text-center py-12 text-white/30">
                    <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No prizes yet. Add one to get started.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SPINS TAB ── */}
          {tab === "spins" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white/50 text-sm">
                  {spinsQuery.data?.total ?? 0} total spins
                </p>
                <Button
                  variant="outline"
                  onClick={exportCSV}
                  className="border-white/20 text-white/60 hover:text-white text-sm"
                >
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>

              {spinsQuery.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-widest">
                      <th className="text-left px-4 py-3">User</th>
                      <th className="text-left px-4 py-3">Prize</th>
                      <th className="text-left px-4 py-3">Code</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(spinsQuery.data?.spins ?? []).map(({ spin, user: u, prize }) => (
                      <tr key={spin.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{u?.name ?? "Unknown"}</p>
                            <p className="text-xs text-white/40">{u?.email ?? ""}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/70">{spin.prizeNameSnapshot}</td>
                        <td className="px-4 py-3">
                          {spin.couponCode ? (
                            <code className="text-yellow-400 font-mono text-xs bg-yellow-950/40 px-2 py-1 rounded">
                              {spin.couponCode}
                            </code>
                          ) : <span className="text-white/30">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(spin.status)}`}>
                            {spin.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-xs">
                          {new Date(spin.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {spin.status === "pending_redemption" && (
                              <button
                                onClick={() => updateSpinStatus.mutate({ spinId: spin.id, status: "redeemed", manuallyRedeemed: true })}
                                className="p-1.5 text-white/40 hover:text-green-400 transition-colors"
                                title="Mark Redeemed"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {spin.status !== "revoked" && (
                              <button
                                onClick={() => {
                                  if (confirm("Revoke this spin?")) updateSpinStatus.mutate({ spinId: spin.id, status: "revoked" });
                                }}
                                className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                                title="Revoke"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            {spin.status === "revoked" && (
                              <button
                                onClick={() => updateSpinStatus.mutate({ spinId: spin.id, status: "pending_redemption" })}
                                className="p-1.5 text-white/40 hover:text-yellow-400 transition-colors"
                                title="Restore"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!spinsQuery.isLoading && (spinsQuery.data?.spins ?? []).length === 0 && (
                  <div className="text-center py-12 text-white/30">
                    <p>No spins yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ORDERS TAB ── */}
          {tab === "orders" && (
            <div className="space-y-4">
              <p className="text-white/50 text-sm">{ordersQuery.data?.total ?? 0} Golden Wheel orders tracked</p>

              {ordersQuery.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-widest">
                      <th className="text-left px-4 py-3">Order ID</th>
                      <th className="text-left px-4 py-3">Stripe Session</th>
                      <th className="text-left px-4 py-3">Amount</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ordersQuery.data?.orders ?? []).map(order => (
                      <tr key={order.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-white/70">{order.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-white/40 max-w-[160px] truncate">
                          {order.stripeSessionId}
                        </td>
                        <td className="px-4 py-3 text-white">
                          ${((order.amountTotal ?? 0) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${
                            order.paymentStatus === "paid"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-white/10 text-white/40 border-white/10"
                          }`}>
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-xs">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!ordersQuery.isLoading && (ordersQuery.data?.orders ?? []).length === 0 && (
                  <div className="text-center py-12 text-white/30">
                    <p>No orders yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
