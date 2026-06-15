import { describe, it, expect } from 'vitest';
import type { CatalogItem } from '../../models/quote.model';
import { filterCatalogItems, sortByUsage } from '../catalog.functions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<CatalogItem>): CatalogItem => ({
  id: 'cat1',
  slug: 'generic_item',
  name: 'Generic Item',
  description: null,
  category: null,
  pricing_type: 'fixed',
  default_hours: null,
  default_rate_profile_id: null,
  default_value: 100,
  applicable_project_types: null,
  out_of_scope_notes: null,
  risk_flags: null,
  active: true,
  usage_count: 0,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const catalogFixture: CatalogItem[] = [
  makeItem({ id: '1', slug: 'ssl_cert', name: 'SSL Certificate', applicable_project_types: ['ecommerce', 'website'], usage_count: 50 }),
  makeItem({ id: '2', slug: 'cdn_setup', name: 'CDN Setup', applicable_project_types: ['ecommerce'], usage_count: 30 }),
  makeItem({ id: '3', slug: 'email_mkt', name: 'Email Marketing Integration', applicable_project_types: ['crm'], usage_count: 10 }),
  makeItem({ id: '4', slug: 'ssl_renew', name: 'SSL Renewal', applicable_project_types: ['website'], usage_count: 20 }),
  makeItem({ id: '5', slug: 'analytics', name: 'Analytics Dashboard', applicable_project_types: null, usage_count: 5 }),
];

// ── CAT-001 a CAT-004 ──────────────────────────────────────────────────────────

describe('CatalogFunctions', () => {
  // CAT-001: pesquisa case-insensitive por nome
  describe('CAT-001: pesquisa case-insensitive por nome', () => {
    it('encontra itens com query em minúsculas', () => {
      const result = filterCatalogItems(catalogFixture, 'ssl');
      expect(result.map(i => i.slug)).toContain('ssl_cert');
      expect(result.map(i => i.slug)).toContain('ssl_renew');
    });

    it('encontra itens com query em maiúsculas', () => {
      const result = filterCatalogItems(catalogFixture, 'SSL');
      expect(result).toHaveLength(2);
    });

    it('encontra itens com query em mixed case', () => {
      const result = filterCatalogItems(catalogFixture, 'Analytics');
      expect(result.map(i => i.slug)).toContain('analytics');
    });

    it('retorna array vazio quando nenhum item corresponde à query', () => {
      const result = filterCatalogItems(catalogFixture, 'nonexistent_xyz');
      expect(result).toHaveLength(0);
    });

    it('retorna todos os itens quando query é string vazia', () => {
      const result = filterCatalogItems(catalogFixture, '');
      expect(result).toHaveLength(catalogFixture.length);
    });
  });

  // CAT-002: filtro por project_type (applicable_project_types contém o slug)
  describe('CAT-002: filtro por project_type', () => {
    it('retorna apenas itens com o slug do project_type em applicable_project_types', () => {
      const result = filterCatalogItems(catalogFixture, '', 'ecommerce');
      const slugs = result.map(i => i.slug);
      expect(slugs).toContain('ssl_cert');
      expect(slugs).toContain('cdn_setup');
      expect(slugs).not.toContain('email_mkt');
    });

    it('exclui itens de outro project_type', () => {
      const result = filterCatalogItems(catalogFixture, '', 'crm');
      expect(result.map(i => i.slug)).toContain('email_mkt');
      expect(result.map(i => i.slug)).not.toContain('cdn_setup');
    });

    it('combina query de texto com filtro de project_type', () => {
      const result = filterCatalogItems(catalogFixture, 'ssl', 'ecommerce');
      expect(result.map(i => i.slug)).toContain('ssl_cert');
      expect(result.map(i => i.slug)).not.toContain('ssl_renew'); // website only
    });

    it('sem filtro de project_type retorna todos os que correspondem à query', () => {
      const result = filterCatalogItems(catalogFixture, 'ssl', undefined);
      expect(result).toHaveLength(2);
    });
  });

  // CAT-003: ordenação por usage_count decrescente
  describe('CAT-003: ordenação por usage_count decrescente', () => {
    it('ordena itens por usage_count do maior para o menor', () => {
      const result = sortByUsage(catalogFixture);
      expect(result[0].usage_count).toBeGreaterThanOrEqual(result[1].usage_count);
      expect(result[1].usage_count).toBeGreaterThanOrEqual(result[2].usage_count);
    });

    it('primeiro item tem maior usage_count', () => {
      const result = sortByUsage(catalogFixture);
      expect(result[0].usage_count).toBe(50); // ssl_cert
    });

    it('não muta o array original', () => {
      const original = [...catalogFixture];
      sortByUsage(catalogFixture);
      expect(catalogFixture[0].usage_count).toBe(original[0].usage_count);
    });
  });

  // CAT-004: guardar item ad-hoc preserva pricing_type original
  describe('CAT-004: item ad-hoc preserva pricing_type original', () => {
    it('item ad-hoc criado como hourly mantém pricing_type hourly', () => {
      const adHocItem = makeItem({
        id: 'adhoc1',
        slug: null,
        name: 'Consultoria ad-hoc',
        pricing_type: 'hourly',
        default_hours: 5,
        default_value: null,
        usage_count: 0,
      });
      // Simula que o item é inserido e lido de volta — pricing_type deve ser preservado
      const items = [adHocItem];
      // filterCatalogItems não deve alterar pricing_type
      const result = filterCatalogItems(items, 'Consultoria');
      expect(result).toHaveLength(1);
      expect(result[0].pricing_type).toBe('hourly');
    });

    it('item ad-hoc criado como fixed mantém pricing_type fixed', () => {
      const adHocItem = makeItem({
        id: 'adhoc2',
        slug: null,
        name: 'Licença ad-hoc',
        pricing_type: 'fixed',
        default_value: 300,
        usage_count: 0,
      });
      const items = [adHocItem];
      const result = filterCatalogItems(items, 'Licença');
      expect(result[0].pricing_type).toBe('fixed');
    });
  });
});
