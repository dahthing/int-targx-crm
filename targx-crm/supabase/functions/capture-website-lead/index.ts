import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (!body.name || !body.email || !body.project_type) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios em falta: name, email, project_type' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Criar ou encontrar cliente por email
    let clientId: string;
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', body.email)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert({ name: body.company || body.name, email: body.email, phone: body.phone || null })
        .select('id')
        .single();
      if (clientErr) throw clientErr;
      clientId = newClient!.id;
    }

    // 2. Obter admin para triagem
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .single();

    // 3. Criar lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        client_id: clientId,
        partner_id: adminProfile!.id,
        title: `[Website] ${body.project_type} — ${body.company || body.name}`,
        description: body.message || null,
        status: 'nova',
        estimated_value: null,
        source: 'website',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (leadErr) throw leadErr;

    // 4. Notificar admin
    await supabase.from('notifications').insert({
      user_id: adminProfile!.id,
      type: 'lead_assigned',
      title: 'Nova lead do website',
      body: `${body.name} (${body.company || 'Particular'}) — ${body.project_type}`,
      link: `/leads/${lead!.id}`,
    });

    // 5. Email de confirmação ao cliente
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'TargX <hello@targx.com>',
          to: body.email,
          subject: 'Recebemos o vosso pedido — TargX',
          html: `<p>Olá ${body.name},</p><p>Recebemos o vosso pedido e entraremos em contacto brevemente.</p><p>Equipa TargX</p>`,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: lead!.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
