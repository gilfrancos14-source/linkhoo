-- Migration: Table newsletter_subscribers
-- Execute manually via Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  market TEXT CHECK (market IN ('CI', 'BJ')),
  source TEXT DEFAULT 'footer',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON newsletter_subscribers (lower(email)) WHERE unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
  ON newsletter_subscribers (created_at);
