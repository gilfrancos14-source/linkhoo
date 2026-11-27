-- Chambres créées par l'administration (ou par un membre de l'équipe à qui
-- la permission a été déléguée) : elles n'appartiennent pas à un gérant
-- sélectionné mais au compte admin qui les publie.
--
-- `admin_owner_id` = admins.id du créateur ; `is_admin_owned` permet de
-- marquer ces annonces comme déjà vérifiées/fiables (pas de KYC gérant).

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS admin_owner_id UUID,
  ADD COLUMN IF NOT EXISTS is_admin_owned BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rooms.admin_owner_id IS
  'Administrateur (ou délégué) propriétaire de la chambre créée depuis le back-office.';
COMMENT ON COLUMN public.rooms.is_admin_owned IS
  'Annonce publiée par l''administration : réputée vérifiée et fiable, sans KYC gérant.';

CREATE INDEX IF NOT EXISTS idx_rooms_admin_owner ON public.rooms(admin_owner_id);
