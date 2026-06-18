import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: tokenRecord } = await supabase
    .from('webhook_tokens')
    .select('*, profiles(id, role)')
    .eq('token', token)
    .eq('active', true)
    .single();

  if (!tokenRecord) {
    return new Response(JSON.stringify({ error: 'Token inválido ou inactivo' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    if (!body.name) {
      return new Response(JSON.stringify({ error: 'Campo name é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Actualizar last_used_at do token
    await supabase
      .from('webhook_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Criar/actualizar cliente
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .upsert(
        {
          name: body.name,
          email: body.email || null,
          phone: body.phone || null,
          website: body.website || null,
          sector: body.sector || null,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select('id')
      .single();
    if (clientErr) throw clientErr;

    // Resolver project_type_id
    let projectTypeId: string | null = null;
    if (body.project_type) {
      const { data: pt } = await supabase
        .from('project_types')
        .select('id')
        .eq('slug', body.project_type)
        .single();
      projectTypeId = pt?.id || null;
    }

    const partnerId = body.partner_id || tokenRecord.profiles.id;

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        client_id: client!.id,
        partner_id: partnerId,
        title: body.title || `[${body.source || 'Webhook'}] ${body.name}`,
        description: body.description || null,
        status: 'nova',
        estimated_value: body.estimated_value || null,
        source: body.source || 'webhook',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (leadErr) throw leadErr;

    // Log da chamada
    await supabase.from('webhook_logs').insert({
      token_id: tokenRecord.id,
      lead_id: lead!.id,
      payload: body,
    });

    // Notificar parceiro
    await supabase.from('notifications').insert({
      user_id: partnerId,
      type: 'lead_assigned',
      title: 'Nova lead via webhook',
      body: `${body.name}${body.source ? ` (${body.source})` : ''}`,
      link: `/leads/${lead!.id}`,
    });

    return new Response(
      JSON.stringify({ success: true, lead_id: lead!.id, client_id: client!.id }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
