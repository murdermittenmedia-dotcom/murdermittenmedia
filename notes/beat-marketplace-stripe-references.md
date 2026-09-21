# Beat Marketplace payment references

- Stripe recommends fulfilling a Checkout payment from a verified webhook rather than relying on the success redirect: [Fulfill orders](https://docs.stripe.com/checkout/fulfillment).
- Stripe Connect supports marketplaces that collect payments through the platform and pay sellers a portion, with application fees for marketplace revenue: [Build a marketplace](https://docs.stripe.com/connect/marketplace).
- Subscription access must also respond to Stripe webhook state changes and recurring invoice events: [Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks).

The implementation records free-plan 80% producer earnings and Beat Pro 100% producer earnings per sale. Initial producer cash-outs remain request-based unless a producer completes optional Stripe Connect onboarding; an active Connect account can receive destination-charge transfers at checkout.
