import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Category } from '../../types.js';

export interface BestSellerSource {
  category: Category;
  url: string;
  label?: string;
}

/**
 * Default Amazon.fr Best Sellers URLs per category.
 * Override by creating data/bestseller-urls.json with the same shape.
 *
 * NOTE: This file (and the Playwright provider) is a temporary fallback
 * until the official Amazon Product Advertising API is available.
 */
export const DEFAULT_BESTSELLER_SOURCES: ReadonlyArray<BestSellerSource> = [
  {
    category: 'travel',
    url: 'https://www.amazon.fr/gp/bestsellers/sports/339808031',
    label: 'Camping et Randonnée',
  },
  {
    category: 'fashion',
    url: 'https://www.amazon.fr/gp/bestsellers/fashion',
    label: 'Mode',
  },
  {
    category: 'beauty',
    url: 'https://www.amazon.fr/gp/bestsellers/beauty',
    label: 'Beauté',
  },
  {
    category: 'baby',
    url: 'https://www.amazon.fr/gp/bestsellers/baby',
    label: 'Bébé et Puériculture',
  },
];

const OVERRIDE_PATH = resolve(process.cwd(), 'data/bestseller-urls.json');

export async function loadBestSellerSources(): Promise<readonly BestSellerSource[]> {
  if (!existsSync(OVERRIDE_PATH)) return DEFAULT_BESTSELLER_SOURCES;
  const raw = await readFile(OVERRIDE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${OVERRIDE_PATH} must be a JSON array of { category, url, label? }`);
  }
  return parsed as BestSellerSource[];
}
