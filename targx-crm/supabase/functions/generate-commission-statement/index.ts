import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── HTML builder (inlined from pdf-generator.functions.ts logic) ────────────

interface StatementRow {
  project: string;
  client: string;
  tranche: string;
  amount: number;
  rate: number;
  commission: number;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function buildCommissionStatementHtml(data: {
  partnerName: string;
  period: string;
  rows: StatementRow[];
  volumeTotal: number;
  commissionTotal: number;
  bonusTotal: number;
}): string {
  const rowsHtml = data.rows
    .map(
      (row) => `<tr>
      <td>${row.project}</td>
      <td>${row.client}</td>
      <td>${row.tranche}</td>
      <td class="amount">${fmt(row.amount)}</td>
      <td class="amount">${(row.rate * 100).toFixed(1)}%</td>
      <td class="amount">${fmt(row.commission)}</td>
    </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Extracto de Comissões — ${data.partnerName} — ${data.period}</title>
  <style>
    body { font-family: Inter, sans-serif; color: #1a202c; }
    h1 { font-size: 22px; }
    .meta { color: #718096; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f7fafc; font-weight: 600; }
    .amount { text-align: right; }
    .totals-row { font-weight: 700; background: #edf2f7; }
    .footer { margin-top: 48px; font-size: 12px; color: #a0aec0; }
  </style>
</head>
<body>
  <header>
    <h1>Extracto de Comissões</h1>
    <div class="meta">
      <p>Parceiro: <strong>${data.partnerName}</strong></p>
      <p>Período: ${data.period}</p>
    </div>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th>Projecto</th>
          <th>Cliente</th>
          <th>Tranche</th>
          <th class="amount">Valor</th>
          <th class="amount">Taxa</th>
          <th class="amount">Comissão</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="totals-row">
          <td colspan="3">Totais</td>
          <td class="amount">${fmt(data.volumeTotal)}</td>
          <td class="amount">—</td>
          <td class="amount">${fmt(data.commissionTotal)}</td>
        </tr>
      </tbody>
    </table>
    ${data.bonusTotal > 0 ? `<p style="margin-top:16px">Bónus: <strong>${fmt(data.bonusTotal)}</strong></p>` : ''}
  </main>
  <footer class="footer">
    <p>Documento gerado automaticamente pelo TargX CRM.</p>
  </footer>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  try {
    const { partnerId, month } = await req.json() as { partnerId?: string; month?: string };

    if (!partnerId || !month) {
      return new Response(JSON.stringify({ error: 'partnerId and month are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // month format: "2026-06"
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthInt = parseInt(monthStr, 10);
    const monthStart = `${year}-${monthStr}-01`;
    const nextMonth = monthInt === 12 ? `${year + 1}-01-01` : `${year}-${String(monthInt + 1).padStart(2, '0')}-01`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fetch partner profile
    const { data: partner, error: partnerError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return new Response(JSON.stringify({ error: `Partner not found: ${partnerError?.message}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const partnerProfile = partner as { full_name: string; email: string };

    // 2. Fetch commissions for partner in that month (joined with project + tranche)
    const { data: commissions, error: commError } = await supabase
      .from('commissions')
      .select(`
        id,
        tranche_amount,
        rate_percent,
        commission_amount,
        project_tranches!inner(description, received_date, projects!inner(title, clients!inner(name)))
      `)
      .eq('partner_id', partnerId)
      .gte('project_tranches.received_date', monthStart)
      .lt('project_tranches.received_date', nextMonth);

    if (commError) throw new Error(`Commissions fetch: ${commError.message}`);

    type CommissionRow = {
      id: string;
      tranche_amount: number;
      rate_percent: number;
      commission_amount: number;
      project_tranches: {
        description: string;
        received_date: string;
        projects: {
          title: string;
          clients: { name: string };
        };
      };
    };

    const rows: StatementRow[] = (commissions ?? []).map((c: CommissionRow) => ({
      project: c.project_tranches.projects.title,
      client: c.project_tranches.projects.clients.name,
      tranche: c.project_tranches.description,
      amount: c.tranche_amount,
      rate: c.rate_percent / 100,
      commission: c.commission_amount,
    }));

    const volumeTotal = rows.reduce((sum, r) => sum + r.amount, 0);
    const commissionTotal = rows.reduce((sum, r) => sum + r.commission, 0);

    // 3. Fetch bonuses for that year
    const { data: bonuses } = await supabase
      .from('annual_bonuses')
      .select('bonus_amount')
      .eq('partner_id', partnerId)
      .eq('year', year);

    const bonusTotal = (bonuses ?? []).reduce(
      (sum: number, b: { bonus_amount: number }) => sum + b.bonus_amount,
      0,
    );

    // 4. Build HTML
    const html = buildCommissionStatementHtml({
      partnerName: partnerProfile.full_name,
      period: month,
      rows,
      volumeTotal,
      commissionTotal,
      bonusTotal,
    });

    // 5. Generate PDF via Puppeteer
    const puppeteerUrl = Deno.env.get('PUPPETEER_ENDPOINT');
    let pdfBuffer: ArrayBuffer;

    if (puppeteerUrl) {
      const pdfRes = await fetch(puppeteerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      });
      pdfBuffer = await pdfRes.arrayBuffer();
    } else {
      // Fallback: return HTML as text if Puppeteer not configured
      return new Response(JSON.stringify({ html, pdfUrl: null, message: 'Puppeteer not configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Upload to Supabase Storage
    const storagePath = `${partnerId}/${month}.pdf`;
    const bucket = Deno.env.get('SUPABASE_STORAGE_BUCKET_COMMISSIONS') ?? 'commissions';

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

    // 7. Get signed URL (1 hour)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);

    if (signedError) throw new Error(`Signed URL: ${signedError.message}`);

    return new Response(JSON.stringify({ pdfUrl: signedData.signedUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
