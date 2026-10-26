-- Remédiation des URL Maps déjà persistées avant le contrôle d'écriture.
-- Toute valeur qui n'est pas un lien Google Maps naviguable (http/https) est
-- remplacée par l'URL canonique dérivée des coordonnées, ou supprimée si les
-- coordonnées manquent. Évite qu'un ancien lien arbitraire (hameçonnage)
-- reste affiché aux clients et aux admins.
UPDATE public.gerants
SET property_maps_url = CASE
  WHEN property_lat IS NOT NULL AND property_lng IS NOT NULL
    THEN 'https://www.google.com/maps?q=' || property_lat || ',' || property_lng
  ELSE NULL
END
WHERE property_maps_url IS NOT NULL
  AND property_maps_url !~* '^https?://([a-z0-9-]+\.)*(google\.[a-z]{2,3}(\.[a-z]{2})?|goo\.gl|maps\.app\.goo\.gl)([/:?#]|$)';
