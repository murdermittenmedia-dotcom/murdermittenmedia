import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, ChevronLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderDetail() {
  const [match, params] = useRoute("/account/orders/:orderId");
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  const orderId = params?.orderId ? parseInt(params.orderId) : null;

  // Fetch order details
  const { data: order, isLoading, error } = trpc.merch.orders.getById.useQuery(
    { orderId: orderId || 0 },
    { enabled: !!orderId }
  );

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

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => setLocation("/account/orders")}
            variant="ghost"
            className="mb-6"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
            <p className="text-foreground/60 mb-6">
              We couldn't find this order. It may have been deleted or you don't have access to it.
            </p>
            <Button onClick={() => setLocation("/account/orders")} variant="outline">
              View All Orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Parse order data
  const items = JSON.parse(order.items || "[]") as Array<{
    productId: number;
    productName: string;
    color: string;
    size: string;
    quantity: number;
    price: number;
  }>;

  const shippingAddress = JSON.parse(order.shippingAddress || "{}") as Record<string, any>;

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
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Button
          onClick={() => setLocation("/account/orders")}
          variant="ghost"
          className="mb-8"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Order #{order.id}</h1>
            <p className="text-foreground/60">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              statusColors[order.status as keyof typeof statusColors]
            }`}
          >
            {statusLabels[order.status as keyof typeof statusLabels]}
          </span>
        </div>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Items Section */}
          <div className="md:col-span-2">
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Order Items</h2>
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-start pb-4 border-b border-border last:border-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold break-words">{item.productName}</p>
                      <p className="text-sm text-foreground/60">
                        Color: {item.color}
                      </p>
                      <p className="text-sm text-foreground/60">
                        Size: {item.size}
                      </p>
                      <p className="text-sm text-foreground/60">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-semibold">
                        ${((item.price * item.quantity) / 100).toFixed(2)}
                      </p>
                      <p className="text-sm text-foreground/60">
                        ${(item.price / 100).toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Section */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Order Total</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-foreground/60">Subtotal</span>
                  <span>${(order.subtotalCents / 100).toFixed(2)}</span>
                </div>
                {order.shippingCents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Shipping</span>
                    <span>${(order.shippingCents / 100).toFixed(2)}</span>
                  </div>
                )}
                {order.shippingCents === 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Shipping</span>
                    <span>FREE</span>
                  </div>
                )}
                {order.taxCents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Tax</span>
                    <span>${(order.taxCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-border">
                  <span>Total</span>
                  <span>${(order.totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Shipping Address */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-bold mb-4">Shipping Address</h3>
              <div className="text-sm space-y-1 text-foreground/80">
                <p className="font-medium">{shippingAddress.name}</p>
                <p>{shippingAddress.address}</p>
                <p>
                  {shippingAddress.city}, {shippingAddress.state}{" "}
                  {shippingAddress.zip}
                </p>
                <p>{shippingAddress.country}</p>
              </div>
            </div>

            {/* Order Info */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-bold mb-4">Order Info</h3>
              <div className="text-sm space-y-3">
                <div>
                  <p className="text-foreground/60 mb-1">Order Date</p>
                  <p className="font-medium">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {order.stripeCheckoutSessionId && (
                  <div>
                    <p className="text-foreground/60 mb-1">Session ID</p>
                    <p className="font-mono text-xs break-all">
                      {order.stripeCheckoutSessionId.slice(0, 20)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setLocation("/account/orders")}
            variant="outline"
            className="flex-1"
          >
            Back to Orders
          </Button>
          <Button
            onClick={() => setLocation("/merch")}
            variant="default"
            className="flex-1"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
