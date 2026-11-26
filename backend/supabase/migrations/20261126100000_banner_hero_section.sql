-- La section « hero » alimente l'espace publicitaire circulaire à droite du
-- hero (landing et pages marché), géré depuis /admin/banners.
ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_section_check;
ALTER TABLE banners ADD CONSTRAINT banners_section_check
  CHECK (section IN ('popular', 'promos', 'categories', 'events', 'hero')) NOT VALID;
ALTER TABLE banners VALIDATE CONSTRAINT banners_section_check;
