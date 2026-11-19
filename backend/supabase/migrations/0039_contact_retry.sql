-- Migration : reprise automatique des messages de contact en échec.
--
-- Le formulaire marque les messages `failed` quand Resend refuse/timeout.
-- Jusqu'ici ils restaient en base sans relance. Ce job (services/contactRetry)
-- les reprend avec backoff borné, verrou et idempotence.
--
-- Exécuter via `npm run migrate -- --yes` (pré-vol : `npm run migrate:check`).

-- 1. Colonnes de pilotage de la reprise.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 2. État transitoire « processing » : une ligne réservée par un worker ne
--    peut pas être reprise par un second (multi-instances). Le nom de la
--    contrainte inline de 0010 est retrouvé dynamiquement pour rester robuste.
DO $$
DECLARE
  c TEXT;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.contact_messages'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.contact_messages DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed')) NOT VALID;
ALTER TABLE public.contact_messages VALIDATE CONSTRAINT contact_messages_status_check;

-- 3. Index ciblé pour la requête du job (statut + prochaine échéance).
CREATE INDEX IF NOT EXISTS idx_contact_messages_retry
  ON public.contact_messages (status, next_retry_at)
  WHERE status IN ('failed', 'processing');

-- 4. RLS déjà activée en 0019 : aucune policy publique ajoutée. Le job passe
--    par service_role, comme la route POST /api/contact.
