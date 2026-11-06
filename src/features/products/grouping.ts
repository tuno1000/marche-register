import type { Category, Product } from '../../domain/types';

export interface CategoryGroup {
  category: Category;
  products: Product[];
}

/** 商品をカテゴリごとにまとめる。カテゴリも商品も並び順どおり。商品のないカテゴリも含める */
export function groupByCategory(categories: Category[], products: Product[]): CategoryGroup[] {
  const sorted = [...products].sort((a, b) => a.sortOrder - b.sortOrder);
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({
      category,
      products: sorted.filter((p) => p.categoryId === category.id),
    }));
}
