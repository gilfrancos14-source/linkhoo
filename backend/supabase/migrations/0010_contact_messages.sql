-- Migration: Table contact_messages (messages du formulaire de contact)
-- Exécuter manuellement via le SQL Editor du dashboard Supabase.

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT,
  email TEXT NOT NULL,
  telephone TEXT,
  pays TEXT NOT NULL CHECK (pays IN (
    'Bénin', 'Burkina Faso', 'Cameroun', 'Congo', 'Côte d''Ivoire', 'Gabon',
    'Guinée', 'Mali', 'Niger', 'RDC', 'Sénégal', 'Togo'
  )),
  sujet TEXT NOT NULL CHECK (sujet IN (
    'reservation', 'compte-gerant', 'partenariat', 'presse', 'autre'
  )),
  message TEXT NOT NULL,
  market TEXT CHECK (market IN ('CI', 'BJ')),
  -- pending : enregistré, mail non encore confirmé ; sent : mail accepté par
  -- le fournisseur ; failed : envoi en échec (à renvoyer depuis l'historique).
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON contact_messages (created_at DESC);
