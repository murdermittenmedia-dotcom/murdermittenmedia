/* ============================================================
   MURDER MITTEN MEDIA — Admin Panel (Pop-out Window)
   Clean, modern UI for admin controls
   ============================================================ */

import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users, ShoppingBag, BarChart3, Settings, Shield,
  X, ChevronDown, ChevronUp, RefreshCw, TrendingUp,
  DollarSign, Activity, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminTab = "overview" | "users" | "orders" | "settings";

export default function AdminPanelPopout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      window.close();
    }
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-white/60">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a0a0a] to-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-red-600" />
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>
          <button
            onClick={() => window.close()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/10">
          {[
            { id: "overview" as const, label: "Overview", icon: Activity },
            { id: "users" as const, label: "Users", icon: Users },
            { id: "orders" as const, label: "Orders", icon: ShoppingBag },
            { id: "settings" as const, label: "Settings", icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 px-4 py-3 border-b-2 transition-colors flex items-center justify-center gap-2 ${
                activeTab === id
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-white/60 hover:text-white/80"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "users" && <UsersTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === "orders" && <OrdersTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────
function OverviewTab() {
  const { data: stats } = trpc.admin.getStats.useQuery();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers || 0}
          color="blue"
        />
        <StatCard
          icon={ShoppingBag}
          label="Total Orders"
          value={stats?.totalOrders || 0}
          color="green"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={`$${stats?.revenue || 0}`}
          color="yellow"
        />
        <StatCard
          icon={TrendingUp}
          label="Active Sessions"
          value={stats?.activeSessions || 0}
          color="purple"
        />
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────
function UsersTab({ searchQuery, setSearchQuery }: { searchQuery: string; setSearchQuery: (q: string) => void }) {
  const { data: users, isLoading } = trpc.admin.getUsers.useQuery({ search: searchQuery });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Users</h2>
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-white/60">Loading...</div>
      ) : (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user: any) => (
                <tr key={user.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3 text-sm">{user.name}</td>
                  <td className="px-6 py-3 text-sm text-white/60">{user.email}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.role === "admin" ? "bg-red-600/20 text-red-400" : "bg-white/10 text-white/60"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-white/60">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────
function OrdersTab() {
  const { data: orders, isLoading } = trpc.admin.getOrders.useQuery();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Recent Orders</h2>

      {isLoading ? (
        <div className="text-center text-white/60">Loading...</div>
      ) : (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Order ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Customer</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders?.map((order: any) => (
                <tr key={order.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3 text-sm font-mono">{order.id}</td>
                  <td className="px-6 py-3 text-sm">{order.customerEmail}</td>
                  <td className="px-6 py-3 text-sm">${order.amount}</td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      order.status === "completed" ? "bg-green-600/20 text-green-400" : "bg-yellow-600/20 text-yellow-400"
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-white/60">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ───────────────────────────────────────────
function SettingsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Admin Settings</h2>
      <div className="border border-white/10 rounded-lg p-6 space-y-4">
        <p className="text-white/60">Settings panel coming soon...</p>
      </div>
    </div>
  );
}

// ─── Stat Card Component ────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = "red" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color?: "red" | "green" | "blue" | "purple" | "yellow";
}) {
  const colorMap = {
    red: "border-red-600/20 bg-red-600/10",
    green: "border-green-600/20 bg-green-600/10",
    blue: "border-blue-600/20 bg-blue-600/10",
    purple: "border-purple-600/20 bg-purple-600/10",
    yellow: "border-yellow-600/20 bg-yellow-600/10",
  };

  return (
    <div className={`border rounded-lg p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-white/60" />
        <span className="text-xs uppercase tracking-widest text-white/50">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}
