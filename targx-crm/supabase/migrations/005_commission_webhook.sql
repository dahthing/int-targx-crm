-- Migration 005: Commission performance indexes + webhook notes
-- Supabase DB webhooks for commission calculation are configured via the
-- Supabase Dashboard (Database → Webhooks) or via supabase/config.toml.
-- When project_tranches.received changes to TRUE  → call calculate-commission EF
-- When project_tranches.received changes to FALSE → call remove-commission EF
-- These are handled at the application layer (ProjectTrancheService) as well.

-- Performance indexes for commission queries
CREATE INDEX IF NOT EXISTS idx_commissions_partner_year
  ON commissions(partner_id, year);

CREATE INDEX IF NOT EXISTS idx_commissions_tranche
  ON commissions(tranche_id);

CREATE INDEX IF NOT EXISTS idx_commissions_project
  ON commissions(project_id);

CREATE INDEX IF NOT EXISTS idx_annual_bonuses_partner_year
  ON annual_bonuses(partner_id, year);

CREATE INDEX IF NOT EXISTS idx_annual_snapshots_partner_year
  ON annual_snapshots(partner_id, year);

-- Index for email_logs idempotency lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_event_key
  ON email_logs(event_key);

-- Index for project_tranches received_date (used in volume calculations)
CREATE INDEX IF NOT EXISTS idx_project_tranches_received_date
  ON project_tranches(received_date)
  WHERE received = true;

-- Helper RPC: increment catalog item usage count
CREATE OR REPLACE FUNCTION increment_catalog_item_usage(item_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE catalog_items
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at  = now()
  WHERE id = item_id;
$$;

-- Helper RPC: increment quote template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE quote_templates
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at  = now()
  WHERE id = template_id;
$$;
