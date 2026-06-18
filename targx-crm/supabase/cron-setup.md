# Configuração de Crons — TargX CRM

## Local (Supabase CLI)

Os crons estão configurados em `supabase/config.toml` sob `[functions.*]`.
Com `supabase start` activo, os schedules correm automaticamente.

## Produção (Supabase Hosted)

Na plataforma Supabase hosted, os schedules de Edge Functions são configurados
no Dashboard ou via `pg_cron`. Passos:

### Opção A — Dashboard

1. Entrar em supabase.com → projecto TargX CRM
2. Edge Functions → seleccionar a função
3. Separador "Schedule" → adicionar cron expression

| Função                    | Cron expression  | Descrição                        |
|---------------------------|------------------|----------------------------------|
| check-lead-silence        | `0 8 * * *`      | Diário às 08:00                  |
| check-quote-expirations   | `0 8 * * *`      | Diário às 08:00                  |
| send-monthly-digest       | `0 8 1 * *`      | Dia 1 de cada mês às 08:00       |
| annual-reset              | `1 0 1 1 *`      | 1 de Janeiro às 00:01            |
| generate-management-report| `0 7 1 * *`      | Dia 1 de cada mês às 07:00       |

### Opção B — pg_cron (via SQL Editor)

```sql
-- Activar pg_cron se não estiver activo
create extension if not exists pg_cron;

-- check-lead-silence
select cron.schedule(
  'check-lead-silence',
  '0 8 * * *',
  $$select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-lead-silence',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- check-quote-expirations
select cron.schedule(
  'check-quote-expirations',
  '0 8 * * *',
  $$select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-quote-expirations',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- send-monthly-digest
select cron.schedule(
  'send-monthly-digest',
  '0 8 1 * *',
  $$select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-monthly-digest',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- annual-reset
select cron.schedule(
  'annual-reset',
  '1 0 1 1 *',
  $$select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/annual-reset',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);

-- generate-management-report
select cron.schedule(
  'generate-management-report',
  '0 7 1 * *',
  $$select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/generate-management-report',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  )$$
);
```

## Protecção contra execução dupla

Cada Edge Function de cron verifica se já correu no período actual antes de executar.
Padrão implementado em todas as funções cron:

```typescript
// Verificar se já correu hoje / este mês
const { data: recentLog } = await supabase
  .from('email_logs')
  .select('id')
  .eq('type', 'function_name')
  .gte('created_at', startOfPeriod.toISOString())
  .single();

if (recentLog) {
  return new Response(JSON.stringify({ skipped: true, reason: 'already_run' }), { status: 200 });
}
```
