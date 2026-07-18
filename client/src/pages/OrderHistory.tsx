import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, ShoppingBag, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderHistory() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Fetch user's orders
  const { data: orders, isLoading, error } = trpc.merch.orders.getMyOrders.useQuery();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/60" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Error Loading Orders</h1>
            <p className="text-foreground/60 mb-6">
              We couldn't load your orders. Please try again later.
            </p>
            <Button onClick={() => setLocation("/merch")} variant="outline">
              Back to Merch
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">My Orders</h1>
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Orders Yet</h2>
            <p className="text-foreground/60 mb-6">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
            <Button onClick={() => setLocation("/merch")} className="w-full sm:w-auto">
              Shop Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Orders</h1>
          <p className="text-foreground/60">
            You have {orders.length} order{orders.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.map((order) => {
            const items = JSON.parse(order.items || "[]") as Array<{
              productId: number;
              productName: string;
              color: string;
              size: string;
              quantity: number;
              price: number;
            }>;

            const statusColors = {
              pending: "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200",
              completed: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200",
              failed: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200",
              cancelled: "bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200",
            };

            const statusLabels = {
              pending: "Processing",
              completed: "Completed",
              failed: "Failed",
              cancelled: "Cancelled",
            };

            return (
              <div
                key={order.id}
                className="bg-card border border-border rounded-lg p-4 sm:p-6 hover:border-border/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                      <h3 className="font-semibold text-lg break-words">
                        Order #{order.id}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${
                          statusColors[order.status as keyof typeof statusColors]
                        }`}
                      >
                        {statusLabels[order.status as keyof typeof statusLabels]}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/60">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      ${(order.totalCents / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-foreground/60">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="mb-4 pb-4 border-t border-border pt-4">
                  <div className="space-y-2">
                    {items.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="text-sm text-foreground/70">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-foreground/60">
                          {item.color} / {item.size} × {item.quantity}
                        </p>
                      </div>
                    ))}
                    {items.length > 2 && (
                      <p className="text-sm text-foreground/60 italic">
                        +{items.length - 2} more item{items.length - 2 !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* View Button */}
                <Button
                  onClick={() => setLocation(`/account/orders/${order.id}`)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  View Details
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Back to Merch */}
        <div className="mt-8 pt-8 border-t border-border">
          <Button
            onClick={() => setLocation("/merch")}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
