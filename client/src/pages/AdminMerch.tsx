import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { Plus, Edit2, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

const DEMO_PRODUCTS = [
  {
    id: 1,
    name: "Spirit of The Mitten Tee",
    price: 4999,
    colors: "Black, White",
    sizes: "S, M, L, XL, 2XL, 3XL",
    isActive: true,
    sales: 24,
    revenue: 119976,
  },
  {
    id: 2,
    name: "Murder Mitten Classic Logo Tee",
    price: 3499,
    colors: "Black, White",
    sizes: "S, M, L, XL, 2XL, 3XL",
    isActive: true,
    sales: 18,
    revenue: 62982,
  },
];

const DEMO_ORDERS = [
  {
    id: 1,
    orderNumber: "MMM-001",
    customer: "John Doe",
    email: "john@example.com",
    items: 2,
    total: 8499,
    status: "completed",
    date: "2026-07-15",
  },
  {
    id: 2,
    orderNumber: "MMM-002",
    customer: "Jane Smith",
    email: "jane@example.com",
    items: 1,
    total: 4999,
    status: "pending",
    date: "2026-07-16",
  },
  {
    id: 3,
    orderNumber: "MMM-003",
    customer: "Mike Johnson",
    email: "mike@example.com",
    items: 3,
    total: 12498,
    status: "completed",
    date: "2026-07-17",
  },
];

export default function AdminMerch() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "analytics">("products");
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Check if user is admin
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-['Anton'] text-3xl mb-4">Access Denied</h1>
          <p className="text-white/60 mb-6">You don't have permission to access this page.</p>
          <button
            onClick={() => setLocation("/")}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 font-bold uppercase tracking-widest"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const totalRevenue = DEMO_PRODUCTS.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders = DEMO_ORDERS.length;
  const totalProducts = DEMO_PRODUCTS.length;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <SiteNav />

      <section className="py-24 pt-32">
        <div className="container">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <h1 className="font-['Anton'] text-4xl uppercase">Merch Admin</h1>
            {activeTab === "products" && (
              <button
                onClick={() => setShowAddProduct(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 font-bold uppercase tracking-widest flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Product
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-white/20">
            {["products", "orders", "analytics"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 font-bold uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-white/60 hover:text-white"
                }`}
              >
                {tab === "products" && "Products"}
                {tab === "orders" && "Orders"}
                {tab === "analytics" && "Analytics"}
              </button>
            ))}
          </div>

          {/* Products Tab */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Product</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Price</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Sales</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Revenue</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Status</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_PRODUCTS.map((product) => (
                      <tr key={product.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-xs text-white/60">{product.colors}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">${(product.price / 100).toFixed(2)}</td>
                        <td className="py-4 px-4">{product.sales}</td>
                        <td className="py-4 px-4 font-bold">${(product.revenue / 100).toFixed(2)}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                            product.isActive
                              ? "bg-green-600/20 text-green-500"
                              : "bg-red-600/20 text-red-500"
                          }`}>
                            {product.isActive ? "Active" : "Hidden"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button className="text-white/60 hover:text-white p-2">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="text-white/60 hover:text-white p-2">
                              {product.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button className="text-white/60 hover:text-red-600 p-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Order #</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Customer</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Items</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Total</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Status</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Date</th>
                      <th className="text-left py-4 px-4 font-bold uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_ORDERS.map((order) => (
                      <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="py-4 px-4 font-bold">{order.orderNumber}</td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-semibold">{order.customer}</p>
                            <p className="text-xs text-white/60">{order.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">{order.items}</td>
                        <td className="py-4 px-4 font-bold">${(order.total / 100).toFixed(2)}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                            order.status === "completed"
                              ? "bg-green-600/20 text-green-500"
                              : "bg-yellow-600/20 text-yellow-500"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-white/60">{order.date}</td>
                        <td className="py-4 px-4">
                          <button className="text-white/60 hover:text-white p-2">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="border border-white/20 rounded-lg p-8">
                <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Total Revenue</p>
                <p className="text-4xl font-bold text-red-600">${(totalRevenue / 100).toFixed(2)}</p>
                <p className="text-xs text-white/60 mt-2">All time</p>
              </div>
              <div className="border border-white/20 rounded-lg p-8">
                <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Total Orders</p>
                <p className="text-4xl font-bold">{totalOrders}</p>
                <p className="text-xs text-white/60 mt-2">Completed & Pending</p>
              </div>
              <div className="border border-white/20 rounded-lg p-8">
                <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Active Products</p>
                <p className="text-4xl font-bold">{totalProducts}</p>
                <p className="text-xs text-white/60 mt-2">In collection</p>
              </div>

              {/* Top Products */}
              <div className="md:col-span-3 border border-white/20 rounded-lg p-8">
                <h3 className="font-bold uppercase tracking-widest mb-6">Top Products</h3>
                <div className="space-y-4">
                  {DEMO_PRODUCTS.sort((a, b) => b.revenue - a.revenue).map((product) => (
                    <div key={product.id} className="flex items-center justify-between pb-4 border-b border-white/10 last:border-0">
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-white/60">{product.sales} sales</p>
                      </div>
                      <p className="font-bold text-red-600">${(product.revenue / 100).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
