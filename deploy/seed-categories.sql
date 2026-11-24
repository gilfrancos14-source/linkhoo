-- Catégories éditoriales pour TOUS les marchés de l'application.
--
-- 4 catégories × 12 marchés = 48 lignes. Aucune chambre, aucun événement,
-- aucune destination : uniquement les catégories demandées.
-- Idempotent : relancer le fichier ne crée aucun doublon.

INSERT INTO public.categories (id, title, img, alt, market)
SELECT
  m.slug || '-' || c.suffix,
  c.title,
  c.img,
  c.alt,
  m.code
FROM (VALUES
  ('CI', 'ci'), ('BJ', 'bj'), ('SN', 'sn'), ('TG', 'tg'),
  ('CM', 'cm'), ('BF', 'bf'), ('CG', 'cg'), ('GA', 'ga'),
  ('GN', 'gn'), ('ML', 'ml'), ('NE', 'ne'), ('CD', 'cd')
) AS m(code, slug)
CROSS JOIN (VALUES
  ('chambres-moins-cheres', 'Chambres moins chères', '/images/pexels-fotoaibe-1571460.jpg', 'Chambre simple et abordable'),
  ('chambres-premium',      'Chambres premium',      '/images/pexels-artbovich-6782567.jpg', 'Chambre premium bien équipée'),
  ('appartements',          'Appartements',          '/images/pexels-artbovich-7214173.jpg', 'Appartement spacieux'),
  ('hotel',                 'Hôtel',                 '/images/pexels-artbovich-7045712.jpg', 'Suite hôtelière')
) AS c(suffix, title, img, alt)
ON CONFLICT (id) DO NOTHING;

-- Contrôle : 4 catégories par marché.
SELECT market, count(*) AS categories
FROM public.categories
GROUP BY market
ORDER BY market;
