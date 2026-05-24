export const CATEGORIES = ['travel', 'fashion', 'beauty', 'baby'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PIN_STATUSES = [
  'drafted',
  'approved',
  'published',
  'skipped',
  'failed',
] as const;
export type PinStatus = (typeof PIN_STATUSES)[number];

export interface ProductCandidate {
  asin: string;
  title: string;
  imageUrl: string;
  productUrl: string;
  affiliateUrl: string;
  category: Category;
  price?: string;
  rating?: number;
  reviewCount?: number;
  bestsellerRank?: number;
  fetchedAt: string;
}

export interface PinDraft {
  asin: string;
  pinTitle: string;
  pinDescription: string;
  imageUrl: string;
  affiliateUrl: string;
  category: Category;
  score: number;
  status: PinStatus;
  createdAt: string;
  publishedAt?: string;
  pinterestPinId?: string;
  failureReason?: string;
}
