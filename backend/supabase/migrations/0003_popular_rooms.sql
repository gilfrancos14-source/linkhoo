-- Migration: Add is_popular column to rooms
-- Execute manually via Supabase Dashboard SQL Editor

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_rooms_is_popular ON rooms(is_popular);
