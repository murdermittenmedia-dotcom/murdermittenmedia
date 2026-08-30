export const REVIEW_PLUS_MONTHLY_PRICE_CENTS = 2500;
export const REVIEW_PLUS_BILLING_CYCLE_LINE_SKIPS = 5;

export function canGenerateReviewBotMessage(isReviewLive: boolean, botEnabled: boolean) {
  return isReviewLive && botEnabled;
}
