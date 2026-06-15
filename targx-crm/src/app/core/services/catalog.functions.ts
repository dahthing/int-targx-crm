import type { CatalogItem } from '../models/quote.model';

export function filterCatalogItems(
  items: CatalogItem[],
  query: string,
  projectTypeSlug?: string
): CatalogItem[] {
  const lowerQuery = query.toLowerCase();

  return items.filter(item => {
    const matchesQuery =
      query === '' || item.name.toLowerCase().includes(lowerQuery);

    if (!matchesQuery) return false;

    if (projectTypeSlug !== undefined) {
      if (!item.active) return false;
      if (!item.applicable_project_types) return false;
      return item.applicable_project_types.includes(projectTypeSlug);
    }

    return true;
  });
}

export function sortByUsage(items: CatalogItem[]): CatalogItem[] {
  return [...items].sort((a, b) => b.usage_count - a.usage_count);
}
