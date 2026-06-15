import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import type { CatalogItem } from '../models/quote.model';
import { filterCatalogItems, sortByUsage } from './catalog.functions';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

export { filterCatalogItems, sortByUsage } from './catalog.functions';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  filterCatalogItems(
    items: CatalogItem[],
    query: string,
    projectTypeSlug?: string
  ): CatalogItem[] {
    return filterCatalogItems(items, query, projectTypeSlug);
  }

  sortByUsage(items: CatalogItem[]): CatalogItem[] {
    return sortByUsage(items);
  }

  searchItems(query: string, projectTypeSlug?: string): Observable<CatalogItem[]> {
    return from(
      this.#supabase
        .from('catalog_items')
        .select('*')
        .eq('active', true)
        .ilike('name', `%${query}%`)
        .then(({ data }) => {
          const items = (data ?? []) as CatalogItem[];
          return projectTypeSlug
            ? filterCatalogItems(items, '', projectTypeSlug)
            : items;
        })
    );
  }

  saveItem(item: Partial<CatalogItem>): Observable<CatalogItem> {
    return from(
      this.#supabase
        .from('catalog_items')
        .upsert(item)
        .select()
        .single()
        .then(({ data }) => data as CatalogItem)
    );
  }
}
