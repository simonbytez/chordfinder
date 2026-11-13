import type { CommunityPlatform } from "../constants";

export type RawVariant = {
  id: string;
  title: string;
  price: number | null;
  available: boolean;
  compareAtPrice: number | null;
};

/** Store-agnostic product snapshot produced by every store adapter. */
export type RawProduct = {
  externalId: string;
  url: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  descriptionText: string;
  images: string[];
  variants: RawVariant[];
  priceUsd: number | null;
  inStock: boolean;
  preOrder: boolean;
  publishedAt: string | null;
};

export type RawMention = {
  title: string;
  url: string;
  platform: CommunityPlatform;
  flair: string | null;
  author: string | null;
  excerpt: string | null;
  publishedAt: Date;
};

export type SitemapEntry = { loc: string; lastmod: string | null };
