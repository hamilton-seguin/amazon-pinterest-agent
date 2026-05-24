import type { Category, ProductCandidate } from '../../types.js'

export interface AmazonSearchOptions {
  category: Category
  limit: number
}

export interface AmazonProvider {
  name: string
  search(opts: AmazonSearchOptions): Promise<ProductCandidate[]>
}

export interface RawAmazonItem {
  asin: string
  title: string
  imageUrl: string
  productUrl: string
  price?: string
  rating?: number
  reviewCount?: number
  bestsellerRank?: number
}
