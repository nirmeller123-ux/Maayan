-- Migration: give standalone tasks an optional start date (multi-day, all-day tasks)
-- Run once in the Supabase SQL Editor. Safe to re-run (guarded by "if not exists").
-- Existing tasks get start_date = null, meaning "single day" (starts and ends on
-- due_date) — nothing changes for them.

alter table tasks add column if not exists start_date date;
