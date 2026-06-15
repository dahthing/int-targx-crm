-- TargX CRM — Audit Trigger para quotes
-- Regista em quote_audit_log sempre que campos financeiros ou status mudam

create or replace function fn_quote_audit_log()
returns trigger language plpgsql as $$
declare
  audited_fields text[] := array[
    'total_before_tax',
    'discount_pct',
    'risk_multiplier_total',
    'calculated_margin_pct',
    'status'
  ];
  field_name text;
  old_val text;
  new_val text;
  actor_id uuid;
begin
  -- Obtém o utilizador actual via auth.uid()
  -- Em triggers disparados por Edge Functions usa a identidade do service role
  actor_id := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  foreach field_name in array audited_fields loop
    execute format('select ($1).%I::text', field_name) into old_val using old;
    execute format('select ($1).%I::text', field_name) into new_val using new;

    if old_val is distinct from new_val then
      insert into quote_audit_log (quote_id, changed_by, field, old_value, new_value)
      values (new.id, actor_id, field_name, old_val, new_val);
    end if;
  end loop;

  return new;
end;
$$;

create trigger trg_quotes_audit
  after update on quotes
  for each row execute function fn_quote_audit_log();
