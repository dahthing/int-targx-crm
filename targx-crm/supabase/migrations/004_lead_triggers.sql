-- Trigger 1: actualizar leads.last_activity_at em INSERT em lead_activities
create or replace function fn_update_lead_on_activity()
returns trigger language plpgsql as $$
begin
  update leads
  set
    last_activity_at = new.activity_at,
    silence_alerted  = false,
    updated_at       = now()
  where id = new.lead_id;
  return new;
end;
$$;

drop trigger if exists trg_lead_activity_update on lead_activities;
create trigger trg_lead_activity_update
  after insert on lead_activities
  for each row execute function fn_update_lead_on_activity();

-- Trigger 2: notificação de silêncio — silence_alerted já é reset pelo trigger acima
-- (mantido separado para clareza e possível extensão futura)
