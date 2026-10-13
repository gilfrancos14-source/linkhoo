-- Migration: RLS sur contact_messages (seule table du schéma sans Row Level Security).
--
-- Problème: 0010 crée la table et un index sans ENABLE ROW LEVEL SECURITY.
-- Avec la clé anon Supabase (publique par conception), un tiers peut
-- SELECT/INSERT/DELETE via PostgREST → fuite de nom, email, téléphone et
-- message des formulaires de contact, et spam injectable.
--
-- Motif identique au reste du schéma (0001:317-336) : table fermée au rôle
-- anon ; les écritures et lectures passent par le service role (backend).
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

ALTER TABLE IF EXISTS contact_messages ENABLE ROW LEVEL SECURITY;

-- Aucune policy publique : le rôle anon n'a aucun accès (pas de
-- DROP/CREATE de policy — la table n'en a jamais eu).
