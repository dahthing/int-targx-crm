import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = req.headers.get('X-TX-API-Key');
  const validKey = Deno.env.get('TX_LINKEDIN_API_KEY');
  if (!apiKey || apiKey !== validKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Criar ou encontrar cliente por company_url
    let clientId: string;
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('website', body.company_url || '')
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: body.company_name,
          sector: body.company_sector || null,
          website: body.company_url || null,
          notes: body.contact_name
            ? `Contacto LinkedIn: ${body.contact_name}${body.contact_title ? ` (${body.contact_title})` : ''}`
            : null,
        })
        .select('id')
        .single();
      if (error) throw error;
      clientId = newClient!.id;
    }

    // 2. Criar lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        client_id: clientId,
        partner_id: body.partner_id,
        title: `[LinkedIn] ${body.company_name}${body.contact_title ? ` — ${body.contact_title}` : ''}`,
        description: body.notes || null,
        status: 'nova',
        source: 'linkedin',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (leadErr) throw leadErr;

    // 3. Actividade com dados LinkedIn
    const activityLines = [
      body.contact_name ? `Contacto: ${body.contact_name}` : null,
      body.contact_title ? `Cargo: ${body.contact_title}` : null,
      body.contact_linkedin_url ? `LinkedIn: ${body.contact_linkedin_url}` : null,
      body.company_url ? `Website: ${body.company_url}` : null,
    ].filter(Boolean);

    await supabase.from('lead_activities').insert({
      lead_id: lead!.id,
      author_id: body.partner_id,
      type: 'nota',
      content: activityLines.join('\n'),
    });

    // 4. Notificação ao parceiro
    await supabase.from('notifications').insert({
      user_id: body.partner_id,
      type: 'lead_assigned',
      title: 'Lead LinkedIn criada',
      body: `${body.company_name} adicionada ao pipeline`,
      link: `/leads/${lead!.id}`,
    });

    return new Response(
      JSON.stringify({ success: true, lead_id: lead!.id, client_id: clientId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
