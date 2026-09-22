export const BEAT_PRO_MONTHLY_PRICE_CENTS = 999;
export const FREE_PRODUCER_UPLOAD_LIMIT = 10;
export const FREE_PRODUCER_SHARE_PERCENT = 80;
export const PRO_PRODUCER_SHARE_PERCENT = 100;
export const PRODUCER_SETTLEMENT_MINIMUM_DAYS = 5;
export const PRODUCER_SETTLEMENT_FALLBACK_DAYS = 7;

export const BEAT_LICENSE_CODES = ["basic", "premium", "exclusive"] as const;
export type BeatLicenseCode = (typeof BEAT_LICENSE_CODES)[number];

export type BeatLicensePreset = {
  code: BeatLicenseCode;
  name: string;
  defaultPriceCents: number;
  summary: string;
  highlights: string[];
  distributionLimit: number | null;
  videoLimit: number | null;
  monetizedViewLimit: number | null;
  includesStems: boolean;
  isExclusive: boolean;
  customTerms?: string | null;
};

export const BEAT_LICENSE_PRESETS: readonly BeatLicensePreset[] = [
  {
    code: "basic",
    name: "Basic Lease",
    defaultPriceCents: 2999,
    summary: "A simple starting license for one commercial release.",
    highlights: ["1 commercial release", "Up to 5,000 copies", "1 music video", "MP3 + WAV delivery"],
    distributionLimit: 5_000,
    videoLimit: 1,
    monetizedViewLimit: 100_000,
    includesStems: false,
    isExclusive: false,
  },
  {
    code: "premium",
    name: "Premium Lease",
    defaultPriceCents: 7999,
    summary: "More room to distribute, promote, and grow a release.",
    highlights: ["1 commercial release", "Up to 100,000 copies", "2 music videos", "MP3 + WAV delivery"],
    distributionLimit: 100_000,
    videoLimit: 2,
    monetizedViewLimit: 1_000_000,
    includesStems: false,
    isExclusive: false,
  },
  {
    code: "exclusive",
    name: "Exclusive License",
    defaultPriceCents: 29999,
    summary: "The beat is taken off the market for future buyers after this sale.",
    highlights: ["Future licensing closes after purchase", "Unlimited distribution", "Unlimited music videos", "Master delivery + included stems when offered"],
    distributionLimit: null,
    videoLimit: null,
    monetizedViewLimit: null,
    includesStems: true,
    isExclusive: true,
  },
] as const;

export function getBeatLicensePreset(code: string): BeatLicensePreset {
  const preset = BEAT_LICENSE_PRESETS.find((item) => item.code === code);
  if (!preset) throw new Error(`Unknown beat license: ${code}`);
  return preset;
}

export type BeatLicenseTermsInput = {
  code: BeatLicenseCode;
  name?: string;
  priceCents: number;
  includesStems?: boolean;
  distributionLimit?: number | null;
  videoLimit?: number | null;
  monetizedViewLimit?: number | null;
  customTerms?: string | null;
};

/** Starts with a clear Marketplace preset, then applies the producer's specific lease choices. */
export function createBeatLicenseTerms(input: BeatLicenseTermsInput): BeatLicensePreset {
  const preset = getBeatLicensePreset(input.code);
  const name = input.name?.trim() || preset.name;
  const distributionLimit = input.distributionLimit === undefined ? preset.distributionLimit : input.distributionLimit;
  const videoLimit = input.videoLimit === undefined ? preset.videoLimit : input.videoLimit;
  const monetizedViewLimit = input.monetizedViewLimit === undefined ? preset.monetizedViewLimit : input.monetizedViewLimit;
  const includesStems = input.includesStems ?? preset.includesStems;
  const highlights = [
    "1 commercial release",
    formatLicenseLimit(distributionLimit, "copies"),
    formatLicenseLimit(videoLimit, "music videos"),
    includesStems ? "MP3 + WAV + stems delivery" : "MP3 + WAV delivery",
  ];
  if (preset.isExclusive) highlights.unshift("Future licensing closes after purchase");
  return {
    ...preset,
    name,
    defaultPriceCents: input.priceCents,
    summary: preset.isExclusive ? "A producer-defined exclusive license that closes future sales after purchase." : "A producer-defined non-exclusive license with clear usage limits.",
    highlights,
    distributionLimit,
    videoLimit,
    monetizedViewLimit,
    includesStems,
    customTerms: input.customTerms?.trim() || null,
  };
}

/** Safely supports historic preset JSON and newer producer-customized lease JSON. */
export function parseBeatLicenseTerms(terms: string, fallback: { code: string; name: string; priceCents: number; includesStems: boolean }): BeatLicensePreset {
  try {
    const parsed = JSON.parse(terms) as Partial<BeatLicensePreset>;
    if (parsed && parsed.code && parsed.name && Array.isArray(parsed.highlights)) {
      return { ...getBeatLicensePreset(parsed.code), ...parsed, defaultPriceCents: fallback.priceCents, name: parsed.name || fallback.name, includesStems: parsed.includesStems ?? fallback.includesStems };
    }
  } catch {
    // Historic malformed rows fall back to the corresponding stock license below.
  }
  return createBeatLicenseTerms({ code: fallback.code as BeatLicenseCode, name: fallback.name, priceCents: fallback.priceCents, includesStems: fallback.includesStems });
}

export function getProducerSharePercent(isPro: boolean) {
  return isPro ? PRO_PRODUCER_SHARE_PERCENT : FREE_PRODUCER_SHARE_PERCENT;
}

export function getProducerUploadLimit(isPro: boolean) {
  return isPro ? null : FREE_PRODUCER_UPLOAD_LIMIT;
}

export function calculateBeatSaleSplit(amountCents: number, isPro: boolean) {
  const producerSharePercent = getProducerSharePercent(isPro);
  const producerEarningsCents = Math.round(amountCents * producerSharePercent / 100);
  return {
    producerSharePercent,
    producerEarningsCents,
    platformFeeCents: amountCents - producerEarningsCents,
  };
}

/**
 * Producer earnings are not withdrawable until Stripe has made the underlying
 * charge available. The five-day floor keeps a consistent marketplace hold;
 * Stripe's later availability date wins, and seven days is used if Stripe does
 * not expose a balance transaction yet.
 */
export function getProducerSettlementAvailableAt(paidAt: Date, stripeAvailableOn?: Date | null) {
  const minimumHold = paidAt.getTime() + PRODUCER_SETTLEMENT_MINIMUM_DAYS * 24 * 60 * 60 * 1000;
  const fallbackHold = paidAt.getTime() + PRODUCER_SETTLEMENT_FALLBACK_DAYS * 24 * 60 * 60 * 1000;
  const stripeAvailability = stripeAvailableOn?.getTime();
  return new Date(Math.max(minimumHold, stripeAvailability ?? fallbackHold));
}

export function formatLicenseLimit(limit: number | null, label: string) {
  return limit === null ? `Unlimited ${label}` : `Up to ${limit.toLocaleString()} ${label}`;
}

export function getMonthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export type ContractSnapshot = {
  contractNumber: string;
  effectiveDate: string;
  buyerName: string;
  buyerEmail: string;
  producerName: string;
  producerEmail: string;
  beatTitle: string;
  license: BeatLicensePreset;
  amountCents: number;
};

/** Creates the human-readable terms included in every generated license document. */
export function buildBeatLicenseContractText(snapshot: ContractSnapshot) {
  const { license } = snapshot;
  const distribution = license.distributionLimit === null
    ? "unlimited units"
    : `up to ${license.distributionLimit.toLocaleString()} distributed units`;
  const videos = license.videoLimit === null
    ? "unlimited music videos"
    : `up to ${license.videoLimit} music video${license.videoLimit === 1 ? "" : "s"}`;
  const monetizedViews = license.monetizedViewLimit === null
    ? "unlimited monetized audiovisual views"
    : `up to ${license.monetizedViewLimit.toLocaleString()} monetized audiovisual views`;

  const exclusivity = license.isExclusive
    ? "Following this paid exclusive sale, the Producer will remove the Beat from future licensing on the Marketplace. Licenses granted before this sale remain valid under their own terms."
    : "This is a non-exclusive license. The Producer may continue licensing the Beat to other customers.";

  return [
    "LICENSE GRANT.",
    `${snapshot.producerName} (the Producer) grants ${snapshot.buyerName} (the Artist) a ${license.name} to use the instrumental titled \"${snapshot.beatTitle}\" in one new commercial musical work, subject to this agreement.`,
    "PERMITTED USE.",
    `The Artist may distribute the resulting work for ${distribution}, create ${videos}, and use it in audiovisual content with ${monetizedViews}. The Artist may perform the resulting work live and may monetize the work within these limits.`,
    "DELIVERY.",
    `The Artist receives MP3 and WAV files for the licensed Beat.${license.includesStems ? " Stems are included only when the Producer supplied them with this exclusive listing." : " Stems are not included unless the Producer separately agrees in writing."}`,
    "CREDIT AND OWNERSHIP.",
    "The Producer retains ownership of the underlying Beat and all producer/composer rights not expressly licensed here. The Artist must credit the Producer in reasonable metadata and release credits. This agreement does not transfer the Producer's writer share or publishing interest unless both parties later sign a separate written agreement.",
    "RESTRICTIONS.",
    "The Artist may not resell, sublicense, transfer, sample, or register the Beat itself as standalone content. The Artist may not claim authorship of the Beat or use it in hate, defamatory, or unlawful content.",
    "EXCLUSIVITY.",
    exclusivity,
    ...(license.customTerms ? ["PRODUCER-SPECIFIC TERMS.", license.customTerms] : []),
    "PAYMENT AND RECORD.",
    `The license price is $${(snapshot.amountCents / 100).toFixed(2)} USD. Payment through Murder Mitten Media is the Artist's acceptance of this license. This PDF is the marketplace record of the issued license.`,
    "NOTICE.",
    "This marketplace template is provided for transaction documentation and is not legal advice. Producers and artists should obtain advice from a qualified attorney for releases, split sheets, publishing, samples, or terms that need to be tailored to a particular project.",
  ];
}
