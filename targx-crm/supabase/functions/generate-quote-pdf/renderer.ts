// PDF template renderer — substitutes {{variable}} tokens and processes
// simple {{#each}}/{{/each}} and {{#if}}/{{/if}} blocks.

export interface RendererData {
  [key: string]: string | number | boolean | RendererData | RendererData[] | undefined | null;
}

// ── Simple token substitution ──────────────────────────────────────────────

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Each block: {{#each items}} ... {{this.key}} ... {{/each}} ─────────────

function processEach(html: string, data: RendererData): string {
  return html.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, key: string, block: string) => {
      const items = data[key];
      if (!Array.isArray(items)) return '';
      return items
        .map((item: RendererData, idx: number) => {
          let rendered = block;
          // Replace {{this.key}} with item values
          rendered = rendered.replace(/\{\{this\.(\w+)\}\}/g, (_m: string, k: string) => {
            const v = item[k];
            return v !== undefined && v !== null ? escapeHtml(v as string | number) : '';
          });
          // Replace {{@index}} with current index
          rendered = rendered.replace(/\{\{@index\}\}/g, String(idx));
          // Replace {{../../../@index}} (gantt pattern)
          rendered = rendered.replace(/\{\{\.\.\./g, '{{');
          // {{#unless @last}}...{{/unless}}
          rendered = rendered.replace(
            /\{\{#unless @last\}\}([\s\S]*?)\{\{\/unless\}\}/g,
            (_m: string, inner: string) => (idx < items.length - 1 ? inner : ''),
          );
          // Nested {{#if this.key}}...{{/if}}
          rendered = rendered.replace(
            /\{\{#if this\.(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
            (_m: string, k: string, inner: string) => {
              const v = item[k];
              return v ? inner : '';
            },
          );
          return rendered;
        })
        .join('');
    },
  );
}

// ── If block: {{#if key}} ... {{/if}} ─────────────────────────────────────

function processIf(html: string, data: RendererData): string {
  return html.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, key: string, block: string) => {
      const value = data[key];
      return value ? block : '';
    },
  );
}

// ── Unless block: {{#unless key}} ... {{/unless}} ─────────────────────────

function processUnless(html: string, data: RendererData): string {
  return html.replace(
    /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_match, key: string, block: string) => {
      const value = data[key];
      return !value ? block : '';
    },
  );
}

// ── Token substitution: {{key}} ───────────────────────────────────────────

function processTokens(html: string, data: RendererData): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return '';
    return escapeHtml(value as string | number);
  });
}

// ── Main render function ───────────────────────────────────────────────────

export function renderTemplate(html: string, data: RendererData): string {
  let result = html;
  // Order matters: blocks first, then tokens
  result = processEach(result, data);
  result = processIf(result, data);
  result = processUnless(result, data);
  result = processTokens(result, data);
  return result;
}

// ── Data builder from Quote + DB rows ─────────────────────────────────────

export interface QuotePhaseItem {
  name: string;
  optional: boolean;
  hours: number | null;
  hourly_rate: number | null;
  unit_value: number | null;
  quantity: number;
  pricing_type: string;
}

export interface QuotePhaseRow {
  id: string;
  name: string;
  phase_order: number;
  quote_items: QuotePhaseItem[];
}

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
}

export interface ClientRow {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

export interface QuoteRow {
  id: string;
  version: number;
  title: string;
  description: string | null;
  created_at: string;
  valid_until: string | null;
  total_before_tax: number | null;
  total_with_tax: number | null;
  discount_amount: number | null;
  risk_adjustment: number | null;
  payment_terms: string | null;
  internal_notes: string | null;
}

export interface TemplateData extends RendererData {
  // Cover
  quote_number: string;
  proposal_month: string;
  proposal_date: string;
  project_type_label: string;
  cover_title_line1: string;
  cover_title_line2: string;
  cover_description: string;
  total_with_tax_formatted: string;
  total_before_tax_formatted: string;
  investment_note: string;
  duration_label: string;
  duration_note: string;
  version: string;
  status_label: string;
  // Page 1
  client_name: string;
  client_company: string;
  client_email: string;
  partner_name: string;
  partner_email: string;
  partner_phone: string;
  partner_role_label: string;
  quote_title: string;
  description: string;
  approach_headline: string;
  approach_paragraph: string;
  has_divisions: boolean;
  divisions: RendererData[];
  team_members: RendererData[];
  total_pages: string;
  // Page 2
  summary_scope: string;
  financial_phases: RendererData[];
  quote_phases: RendererData[];
  // Page 3
  team_label: string;
  dist_segments: RendererData[];
  dist_bars: RendererData[];
  milestones: RendererData[];
  // Page 4
  gantt_months: string[];
  gantt_rows: RendererData[];
  opex_start: string;
  opex_items: RendererData[];
  opex_total_monthly: string;
  opex_total_annual: string;
  next_phases: RendererData[];
  client_requirements: string[];
  // Page 5
  payment_plan: RendererData[];
  warranty_text: string;
  not_included_text: string;
  validity_text: string;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

// Builds a full TemplateData object from DB rows.
// Most narrative fields (approach, opex, phases detail) are pre-filled with
// sensible TargX defaults — the CRM can override them via quote.internal_notes
// parsed as JSON or via dedicated DB columns in the future.
export function buildTemplateData(
  quote: QuoteRow,
  client: ClientRow,
  partner: ProfileRow,
  phases: QuotePhaseRow[],
): TemplateData {
  const created = new Date(quote.created_at);
  const totalBefore = quote.total_before_tax ?? 0;
  const totalWith = quote.total_with_tax ?? 0;
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const proposalMonth = `${months[created.getMonth()]} de ${created.getFullYear()}`;
  const proposalDate = created.toLocaleDateString('pt-PT');

  // Financial phases for cover summary
  // Derived from quote phases; group in max 3 buckets
  const financialPhases = phases.map((p, i) => {
    const phaseTotal = p.quote_items.reduce((sum, item) => {
      if (item.pricing_type === 'hourly') {
        return sum + (item.hours ?? 0) * (item.hourly_rate ?? 0) * (item.quantity ?? 1);
      }
      return sum + (item.unit_value ?? 0) * (item.quantity ?? 1);
    }, 0);
    return {
      label: `Fase ${i + 1} — ${p.name}`,
      value_formatted: fmt(phaseTotal),
    };
  });

  // Quote phases detail for page 2
  const quotePhases = phases.map((p, i) => ({
    phase_meta: `Fase ${i + 1}`,
    name: p.name,
    duration: '',
    items: p.quote_items.map((item) => ({
      name: item.optional ? `${item.name} (Opcional)` : item.name,
      description: '',
    })),
  }));

  // Distribution donut segments (CSS SVG stroke-dasharray, circumference = 2π×60 ≈ 377)
  const circ = 377;
  const distValues = phases.map((p) =>
    p.quote_items.reduce((sum, item) => {
      if (item.pricing_type === 'hourly') {
        return sum + (item.hours ?? 0) * (item.hourly_rate ?? 0) * (item.quantity ?? 1);
      }
      return sum + (item.unit_value ?? 0) * (item.quantity ?? 1);
    }, 0),
  );
  const phaseColors = ['#6b7280', '#0D9488', '#0a0e1a', '#14b8a6', '#374151'];
  const distSegments: RendererData[] = [];
  let cumOffset = 0;
  distValues.forEach((val, i) => {
    const pct = totalBefore > 0 ? val / totalBefore : 0;
    const dash = pct * circ;
    distSegments.push({
      color: phaseColors[i % phaseColors.length],
      dash: String(Math.round(dash)),
      gap: String(Math.round(circ - dash)),
      offset: String(Math.round(circ - cumOffset)),
    });
    cumOffset += dash;
  });

  const distBars: RendererData[] = phases.map((p, i) => {
    const val = distValues[i] ?? 0;
    const pct = totalBefore > 0 ? Math.round((val / totalBefore) * 100) : 0;
    return {
      label: `Fase ${i + 1}`,
      description: p.name,
      pct: String(pct),
      value_formatted: fmt(val),
      color: phaseColors[i % phaseColors.length],
      class: String(i === 0 ? '0' : i === 1 ? '1' : '1b'),
    };
  });

  // Milestones: one per phase + conclusion
  const milestones: RendererData[] = phases.map((p, i) => ({
    flex: '1',
    active_bg: '#0D9488',
    month: `Fase ${i + 1}`,
    label: p.name,
  }));
  milestones.push({ flex: '1', active_bg: '#0D9488', month: 'Conclusão', label: 'Entrega final' });

  // Gantt: one row per phase
  const totalMonths = 6;
  const ganttMonths: string[] = Array.from({ length: totalMonths }, (_, i) => String(i + 1));
  const ganttRows: RendererData[] = phases.map((p, i) => {
    const startMonth = i;
    const endMonth = Math.min(startMonth + 2, totalMonths - 1);
    return {
      label: p.name,
      sub: `Fase ${i + 1}`,
      cells: ganttMonths.map((_, m) => ({ active: m >= startMonth && m <= endMonth ? '1' : '' })),
    };
  });

  // Payment plan: divide total into 3 standard milestones
  const p1 = Math.round(totalBefore * 0.30);
  const p2 = Math.round(totalBefore * 0.40);
  const p3 = totalBefore - p1 - p2;
  const paymentPlan: RendererData[] = [
    { milestone: 'Assinatura do contrato', pct: '30%', value_formatted: fmt(p1) },
    { milestone: 'Aprovação do plano técnico', pct: '40%', value_formatted: fmt(p2) },
    { milestone: 'Entrega e lançamento', pct: '30%', value_formatted: fmt(p3) },
  ];

  return {
    // Cover
    quote_number: `${created.getFullYear()}/TX-${quote.id.slice(0, 6).toUpperCase()}`,
    proposal_month: proposalMonth,
    proposal_date: proposalDate,
    project_type_label: 'Desenvolvimento de Software',
    cover_title_line1: quote.title.split('—')[0]?.trim() ?? quote.title,
    cover_title_line2: quote.title.split('—')[1]?.trim() ?? '',
    cover_description: quote.description ?? 'Desenvolvimento e implementação de uma solução digital à medida, com arquitectura robusta e preparada para crescimento.',
    total_with_tax_formatted: fmt(totalWith),
    total_before_tax_formatted: fmt(totalBefore),
    investment_note: 'CAPEX · Sem IVA',
    duration_label: `${phases.length * 2} meses`,
    duration_note: 'Estimativa de entrega',
    version: String(quote.version),
    status_label: 'Proposta',
    // Page 1
    client_name: client.name,
    client_company: client.company ?? '',
    client_email: client.email ?? '',
    partner_name: partner.full_name,
    partner_email: partner.email,
    partner_phone: partner.phone ?? '+351 915 299 193',
    partner_role_label: partner.role === 'admin' ? 'CEO' : 'Parceiro Comercial',
    quote_title: quote.title,
    description: quote.description ?? '',
    approach_headline: 'Uma solução que trabalha. Não um projecto que existe.',
    approach_paragraph: 'O briefing define com clareza o destino. A nossa responsabilidade é garantir que a arquitectura, as decisões técnicas e o modelo de execução chegam lá — sem desvios, sem scope creep.',
    has_divisions: false,
    divisions: [],
    team_members: [
      { role: 'Gestor de Projecto', responsibility: 'Coordenação, interlocutor cliente, risk & scope, reporting semanal' },
      { role: 'Dev Sénior A', responsibility: 'Backend, APIs, integrações e segurança da plataforma' },
      { role: 'Dev Sénior B', responsibility: 'Frontend, UX, componentes e performance' },
    ],
    total_pages: '5',
    // Page 2
    summary_scope: phases.map((p) => p.name).join(', '),
    financial_phases: financialPhases,
    quote_phases: quotePhases,
    // Page 3
    team_label: '3 Devs Sénior + Gestor de Projecto',
    dist_segments: distSegments,
    dist_bars: distBars,
    milestones,
    // Page 4
    gantt_months: ganttMonths,
    gantt_rows: ganttRows,
    opex_start: 'Mês 7',
    opex_items: [
      { name: 'Alojamento e infraestrutura', description: 'Cloud hosting, CDN', monthly: '€200–400', annual: '€2k–5k' },
      { name: 'Monitorização e alertas', description: 'Sentry, logs, uptime', monthly: '€80–150', annual: '€1k–2k' },
      { name: 'Manutenção e suporte', description: 'Suporte técnico, bugs e segurança', monthly: '€500–1.500', annual: '€6k–18k' },
    ],
    opex_total_monthly: '€780–2.050',
    opex_total_annual: '€9k–25k',
    next_phases: [
      { phase: 'Fase 2', focus: 'IA, automação e personalização', estimate: 'A definir' },
      { phase: 'Fase 3', focus: 'Integrações adicionais', estimate: 'A definir' },
    ],
    client_requirements: [
      'Interlocutor de projecto disponível para decisões semanais',
      'Acesso às plataformas e ferramentas de análise actuais',
      'Validação dos conteúdos em paralelo com o desenvolvimento',
    ],
    // Page 5
    payment_plan: paymentPlan,
    warranty_text: `4 semanas de suporte sem custo adicional após o lançamento. Correcção de erros críticos durante 90 dias. Documentação técnica completa na entrega.`,
    not_included_text: quote.internal_notes ?? 'Funcionalidades fora do âmbito definido nesta proposta. Qualquer evolução é orçamentada separadamente.',
    validity_text: `Esta proposta tem validade de 30 dias a partir de ${proposalDate}. Aos valores acresce IVA à taxa legal em vigor.`,
  };
}
