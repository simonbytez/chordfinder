import type {
  AlertChannel,
  BatteryType,
  BodyMaterial,
  CollectionStatus,
  CommunityPlatform,
  DigestSchedule,
  DriverType,
  Firmware,
  FormFactor,
  IpRating,
  OpticType,
  ReleaseStatus,
  TriggerEvent,
} from "./constants";

/** Serializable shapes passed from server components to client components. */

export type PricePointDTO = { t: string; p: number | null; s: boolean };

export type EmitterDTO = {
  id: string;
  emitterModel: string;
  ledCount: number;
  cctKelvin: number | null;
  cri: number | null;
  tintDuvNotes: string | null;
};

export type ListingDTO = {
  id: string;
  sourceId: string;
  sourceName: string;
  productUrl: string;
  title: string | null;
  priceUsd: number | null;
  inStock: boolean;
  /** null → never verified by a crawler (seed/manual estimate). */
  lastCheckedAt: string | null;
  priceHistory: PricePointDTO[];
};

export type BestPrice = {
  price: number;
  verified: boolean;
  inStock: boolean;
  url: string;
  sourceName: string;
};

export type LightDTO = {
  id: string;
  slug: string;
  brand: string;
  modelName: string;
  releaseStatus: ReleaseStatus;
  firstSeenAt: string;
  lastEventAt: string | null;
  releaseYear: number | null;
  imageUrls: string[];
  description: string | null;
  formFactor: FormFactor | null;
  batteryTypes: BatteryType[];
  maxLumens: number | null;
  maxCandela: number | null;
  throwMeters: number | null;
  opticType: OpticType | null;
  driverType: DriverType;
  firmware: Firmware | null;
  ipRating: IpRating | null;
  bodyMaterials: BodyMaterial[];
  hasUsbC: boolean;
  hasMagneticTail: boolean;
  hasAuxLeds: boolean;
  hasHighCriOption: boolean;
  weightGrams: number | null;
  lengthMm: number | null;
  specSource: string;
  specNotes: string | null;
  emitters: EmitterDTO[];
  listings: ListingDTO[];
  bestPrice: BestPrice | null;
  collectionStatus: CollectionStatus | null;
  watched: boolean;
  latestEvent: { type: TriggerEvent; at: string; oldPrice: number | null; newPrice: number | null } | null;
};

export type MentionDTO = {
  id: string;
  title: string;
  url: string;
  platform: CommunityPlatform;
  flair: string | null;
  author: string | null;
  excerpt: string | null;
  publishedAt: string;
  light: { slug: string; brand: string; modelName: string } | null;
};

export type BrandFacet = { brand: string; count: number };

export type AlertRuleDTO = {
  id: string;
  name: string;
  filters: Record<string, string>;
  chips: string[];
  triggerEvents: TriggerEvent[];
  channels: AlertChannel[];
  isActive: boolean;
  watchFlashlightId: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  matchCount: number;
};

export type MatchHistoryDTO = {
  id: string;
  ruleName: string;
  eventType: TriggerEvent;
  createdAt: string;
  light: { slug: string; brand: string; modelName: string };
  deliveries: { channel: string; ok: boolean; detail: string }[];
  digestPending: boolean;
};

export type NotificationSettingsDTO = {
  ntfyTopicUrl: string | null;
  discordWebhookUrl: string | null;
  emailAddress: string | null;
  digestSchedule: DigestSchedule;
  pushSubscriptionCount: number;
  vapidConfigured: boolean;
  resendConfigured: boolean;
};

export type DeliveryResultDTO = { channel: string; ok: boolean; detail: string };
