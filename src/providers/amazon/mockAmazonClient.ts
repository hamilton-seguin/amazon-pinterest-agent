import type { Category, ProductCandidate } from '../../types.js';
import { buildAffiliateUrl } from '../../services/affiliateLinkBuilder.js';
import type { AmazonProvider, AmazonSearchOptions, RawAmazonItem } from './amazon.types.js';

const FIXTURES: Record<Category, RawAmazonItem[]> = {
  travel: [
    {
      asin: 'B0MOCK0001',
      title: '8-Piece Compression Packing Cubes Set for Carry-On Luggage',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-packing-cubes.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0001',
      price: '$29.99',
      rating: 4.6,
      reviewCount: 12450,
      bestsellerRank: 12,
    },
    {
      asin: 'B0MOCK0002',
      title: 'Hanging Toiletry Bag with 4 Compartments — Water-Resistant',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-toiletry-bag.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0002',
      price: '$24.50',
      rating: 4.7,
      reviewCount: 8800,
    },
    {
      asin: 'B0MOCK0003',
      title: '10,000mAh Slim Portable Charger with USB-C',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-charger.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0003',
      price: '$22.99',
      rating: 4.5,
      reviewCount: 35000,
    },
  ],
  fashion: [
    {
      asin: 'B0MOCK0101',
      title: 'Quilted Crossbody Bag — Vegan Leather, Adjustable Strap',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-crossbody.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0101',
      price: '$34.00',
      rating: 4.5,
      reviewCount: 4200,
    },
    {
      asin: 'B0MOCK0102',
      title: 'Classic Ribbed Knit Beanie — Soft Acrylic, Unisex',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-beanie.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0102',
      price: '$14.99',
      rating: 4.6,
      reviewCount: 9100,
    },
  ],
  beauty: [
    {
      asin: 'B0MOCK0201',
      title: 'LED Lighted Travel Makeup Mirror with 3 Brightness Settings',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-mirror.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0201',
      price: '$28.00',
      rating: 4.6,
      reviewCount: 6700,
    },
    {
      asin: 'B0MOCK0202',
      title: 'Acrylic Skincare Organizer — Clear Vanity Storage with Drawers',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-organizer.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0202',
      price: '$32.00',
      rating: 4.7,
      reviewCount: 5200,
    },
  ],
  baby: [
    {
      asin: 'B0MOCK0301',
      title: 'Nursery Closet Dividers — Set of 16, Wood Hanging Organizers',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-dividers.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0301',
      price: '$18.99',
      rating: 4.8,
      reviewCount: 14000,
    },
    {
      asin: 'B0MOCK0302',
      title: 'Compact Diaper Caddy Organizer — Felt, Portable',
      imageUrl: 'https://m.media-amazon.com/images/I/mock-caddy.jpg',
      productUrl: 'https://www.amazon.com/dp/B0MOCK0302',
      price: '$26.00',
      rating: 4.7,
      reviewCount: 11200,
    },
  ],
};

export class MockAmazonClient implements AmazonProvider {
  readonly name = 'mock';

  constructor(
    private readonly associateTag: string,
    private readonly marketplace: string = 'www.amazon.com',
  ) {}

  async search(opts: AmazonSearchOptions): Promise<ProductCandidate[]> {
    const items = FIXTURES[opts.category] ?? [];
    const now = new Date().toISOString();
    return items.slice(0, opts.limit).map((it) => {
      const candidate: ProductCandidate = {
        asin: it.asin,
        title: it.title,
        imageUrl: it.imageUrl,
        productUrl: it.productUrl,
        affiliateUrl: buildAffiliateUrl(it.asin, this.associateTag, this.marketplace),
        category: opts.category,
        fetchedAt: now,
      };
      if (it.price !== undefined) candidate.price = it.price;
      if (it.rating !== undefined) candidate.rating = it.rating;
      if (it.reviewCount !== undefined) candidate.reviewCount = it.reviewCount;
      if (it.bestsellerRank !== undefined) candidate.bestsellerRank = it.bestsellerRank;
      return candidate;
    });
  }
}
