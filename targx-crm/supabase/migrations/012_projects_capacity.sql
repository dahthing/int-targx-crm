-- Migration 012: Add daily_capacity_hours to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS daily_capacity_hours NUMERIC(4,1) NOT NULL DEFAULT 8;
