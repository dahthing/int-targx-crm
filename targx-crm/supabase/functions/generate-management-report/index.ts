import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // current month index (0-based)
  const monthLabel = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1));

  const [leadsRes, quotesRes, projectsRes, commissionsRes, partnersRes] = await Promise.all([
    supabase.from('leads')
      .select('id, title, status, estimated_value, partner_id')
      .not('status', 'in', '(fechada_ganha,fechada_perdida)'),
    supabase.from('quotes')
      .select('id, title, status, total_before_tax, sent_at')
      .gte('sent_at', startOfMonth(year, month - 1).toISOString())
      .lt('sent_at', startOfMonth(year, month).toISOString()),
    supabase.from('projects')
      .select('id, title, contract_value, status, partner_id')
      .eq('status', 'em_curso'),
    supabase.from('commissions')
      .select('id, commission_amount, partner_id')
      .gte('created_at', startOfMonth(year, month - 1).toISOString())
      .lt('created_at', startOfMonth(year, month).toISOString()),
    supabase.from('profiles')
      .select('id, full_name')
      .eq('role', 'partner')
      .eq('active', true),
  ]);

  const leads = leadsRes.data ?? [];
  const quotes = quotesRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const commissions = commissionsRes.data ?? [];

  const kpis = {
    leads_abertas: leads.length,
    pipeline_value: leads.reduce((s, l) => s + (l.estimated_value || 0), 0),
    orcamentos_enviados: quotes.length,
    orcamentos_aceites: quotes.filter(q => q.status === 'aceite').length,
    taxa_conversao: quotes.length
      ? Math.round((quotes.filter(q => q.status === 'aceite').length / quotes.length) * 100)
      : 0,
    projectos_em_curso: projects.length,
    volume_em_curso: projects.reduce((s, p) => s + p.contract_value, 0),
    comissoes_pagas: commissions.reduce((s, c) => s + c.commission_amount, 0),
  };

  const fmt = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
    <style>
      body { font-family: Inter, sans-serif; color: #1F2533; font-size: 10pt; margin: 0; }
      .cover { background: #0A1628; color: white; padding: 48pt; min-height: 297mm; }
      .cover h1 { font-size: 28pt; font-weight: 700; margin-top: auto; }
      .cover p { color: rgba(255,255,255,0.5); }
      .page { padding: 28pt 36pt; page-break-after: always; }
      h2 { font-size: 12pt; font-weight: 600; color: #00B899; margin-bottom: 16pt; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      th { text-align: left; padding: 6pt 8pt; background: #F9FAFB; font-weight: 600; border-bottom: 1pt solid #E5E7EB; }
      td { padding: 5pt 8pt; border-bottom: 0.5pt solid #F3F4F6; }
      .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16pt; }
      .kpi-box { background: #F9FAFB; border: 1pt solid #E5E7EB; border-radius: 8pt; padding: 14pt; }
      .kpi-label { font-size: 8pt; color: #9CA3AF; margin-bottom: 4pt; }
      .kpi-value { font-size: 18pt; font-weight: 700; color: #0A1628; }
    </style>
    </head><body>
    <div class="cover">
      <div style="color:#00B899;font-size:8pt;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8pt">Relatório de Gestão</div>
      <h1>TargX CRM<br>${monthLabel}</h1>
      <p>Gerado em ${now.toLocaleDateString('pt-PT')}</p>
    </div>
    <div class="page">
      <h2>KPIs do Mês</h2>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Leads abertas</div><div class="kpi-value">${kpis.leads_abertas}</div></div>
        <div class="kpi-box"><div class="kpi-label">Pipeline</div><div class="kpi-value">${fmt(kpis.pipeline_value)}</div></div>
        <div class="kpi-box"><div class="kpi-label">Orçamentos enviados</div><div class="kpi-value">${kpis.orcamentos_enviados}</div></div>
        <div class="kpi-box"><div class="kpi-label">Taxa conversão</div><div class="kpi-value">${kpis.taxa_conversao}%</div></div>
        <div class="kpi-box"><div class="kpi-label">Projectos em curso</div><div class="kpi-value">${kpis.projectos_em_curso}</div></div>
        <div class="kpi-box"><div class="kpi-label">Comissões pagas</div><div class="kpi-value">${fmt(kpis.comissoes_pagas)}</div></div>
      </div>
    </div>
    </body></html>`;

  // Guardar HTML como ficheiro temporário e enviar por email
  const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'rui@targx.com';
  const resendKey = Deno.env.get('RESEND_API_KEY');

  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'TargX <hello@targx.com>',
        to: adminEmail,
        subject: `Relatório de Gestão TargX — ${monthLabel}`,
        html,
      }),
    });
  }

  return new Response(
    JSON.stringify({ success: true, month: monthLabel, kpis }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
