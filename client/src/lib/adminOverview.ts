export function getAdminOverviewMetrics(queue: any, analytics: any) {
  const submissions = queue?.submissions ?? [];
  const pending = submissions.filter((submission: any) => submission.status === "pending").length;
  const skipTotal = analytics?.promoOrders?.skipTotal ?? 0;
  const skipConfirmed = analytics?.promoOrders?.skipConfirmed ?? 0;

  return {
    queueCount: submissions.length,
    pendingCount: pending,
    paidWorkload: analytics?.submissions?.paid ?? analytics?.promoOrders?.wheelPaidTotal ?? 0,
    skipTotal,
    pendingSkipOrders: Math.max(skipTotal - skipConfirmed, 0),
    memberCount: analytics?.users?.total ?? null,
    recentSignups: analytics?.users?.recentSignups ?? 0,
    isLive: Boolean(queue?.state?.isLive),
    currentTitle: queue?.currentPlaying?.songTitle ?? null,
    currentArtist: queue?.currentPlaying?.artistName ?? null,
  };
}
