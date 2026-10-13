-- 0017 : section « Escapade weekend » dynamique.
--
-- Jusqu'ici les 60 cartes (12 marchés × 5) sont codées en dur dans
-- frontend/src/components/EscapadeSection.tsx. On les externalise dans une
-- table dédiée pour que le back-office les administre (même parcours que
-- tourism_destinations, mais sans partition grosse/petite carte ni règle
-- d'éligibilité liée aux événements).
--
-- Une ligne = une carte du rail horizontal :
--   lieu        nom du lieu affiché (« Ouidah »), sert aussi de requête de
--               recherche si on l'ajoute plus tard ;
--   description accroche courte (~50-200 car.), tronquée en carte,
--               affichée en entier dans le panneau de détails ;
--   images      1 à 5 photos, images[1] = couverture de la carte (tableau
--               Postgres ordonné, même convention que rooms.images).
--
-- La section est volontairement SANS fallback : liste vide ⇒ le composant
-- rend null et la section disparaît de la home (décision produit).
--
-- L'insertion en bas de fichier reprend le contenu historique du CONTENT
-- codé en dur, idempotente via ON CONFLICT (id) DO NOTHING : relancer la
-- migration ne duplique pas et ne réinitialise pas les lignes éditées.
--
-- Exécuter manuellement via le SQL Editor du dashboard Supabase ou
-- `npm run migrate` (pré-vol : `npm run migrate:check`).

CREATE TABLE IF NOT EXISTS escapades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  market TEXT NOT NULL CHECK (market IN (
    'CI', 'BJ', 'SN', 'TG', 'CM', 'BF',
    'CG', 'GA', 'GN', 'ML', 'NE', 'CD'
  )),
  lieu TEXT NOT NULL,
  description TEXT NOT NULL,
  images TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escapades_market ON escapades(market);

-- Lecture publique uniquement : les écritures passent par le service role
-- (routes admin), qui ignore RLS. Même modèle que tourism_destinations.
ALTER TABLE escapades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_select_escapades ON escapades;
CREATE POLICY public_select_escapades ON escapades FOR SELECT USING (true);

-- ============================================================
-- Seed : les 60 cartes historiques (12 marchés × 5), telles quelles.
-- Les images sont locales (pool /images/ déjà dans le repo) : aucun
-- téléversement requis au déploiement.
-- ============================================================
INSERT INTO escapades (id, market, lieu, description, images) VALUES
  -- Bénin
  ('esc-bj-ouidah', 'BJ', 'Ouidah', 'Plages, musée d''histoire et balades en famille.', ARRAY['/images/ouidah.jpg']),
  ('esc-bj-ganvie', 'BJ', 'Ganvié', 'Pirogue sur le lac, marchés flottants et découvertes.', ARRAY['/images/pexels-artbovich-7045712.jpg']),
  ('esc-bj-grand-popo', 'BJ', 'Grand Popo', 'Lagune, plage sauvage et pique-nique au bord de l''eau.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-bj-abomey', 'BJ', 'Abomey', 'Palais royaux, art et histoire du Dahomey.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  ('esc-bj-tori-bossito', 'BJ', 'Tori Bossito', 'Nature, randonnée et villages authentiques.', ARRAY['/images/tori.jpg']),
  -- Côte d'Ivoire
  ('esc-ci-assinie', 'CI', 'Assinie', 'Plages, lagunes et balades entre cocotiers.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-ci-grand-bassam', 'CI', 'Grand-Bassam', 'Front de mer, musées et patrimoine classé à l''UNESCO.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-ci-yamoussoukro', 'CI', 'Yamoussoukro', 'Basilique de la Paix, jardins et grands axes.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  ('esc-ci-korhogo', 'CI', 'Korhogo', 'Savanes du nord, tissages et villages authentiques.', ARRAY['/images/ouidah.jpg']),
  ('esc-ci-parc-comoe', 'CI', 'Parc de la Comoé', 'Nature, randonnée et réserve de biosphère.', ARRAY['/images/tori.jpg']),
  -- Sénégal
  ('esc-sn-dakar', 'SN', 'Dakar', 'Caps, plages et marché des arts de la Corniche.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-sn-goree', 'SN', 'Île de Gorée', 'Mémoire, maisons colorées et musée de la traite.', ARRAY['/images/ouidah.jpg']),
  ('esc-sn-saly', 'SN', 'Saly', 'Plages de la côte atlantique et balades en bateau.', ARRAY['/images/tori.jpg']),
  ('esc-sn-saint-louis', 'SN', 'Saint-Louis', 'Île coloniale, pont Faidherbe et pêche traditionnelle.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-sn-lac-rose', 'SN', 'Lac Rose', 'Eaux salines, cueillette et lagunes de la Langue de Barbarie.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Togo
  ('esc-tg-lome', 'TG', 'Lomé', 'Grand marché, Quartier allemand et front de mer.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-tg-kpalime', 'TG', 'Kpalimé', 'Chutes, forêt et randonnées dans les montagnes.', ARRAY['/images/ouidah.jpg']),
  ('esc-tg-anho', 'TG', 'Aného', 'Lagon, maisons coloniales et plages tranquilles.', ARRAY['/images/tori.jpg']),
  ('esc-tg-kara', 'TG', 'Kara', 'Plateaux du nord et culture kabyè.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-tg-togoville', 'TG', 'Togoville', 'Case du roi et rives du lagon Togo.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Cameroun
  ('esc-cm-douala', 'CM', 'Douala', 'Marché du Wouri, Bonanjo et vie nocturne.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-cm-yaounde', 'CM', 'Yaoundé', 'Collines, musées et marché Mvog-Mbi.', ARRAY['/images/ouidah.jpg']),
  ('esc-cm-kribi', 'CM', 'Kribi', 'Plages et chutes de la Lobé dans l''océan.', ARRAY['/images/tori.jpg']),
  ('esc-cm-bafoussam', 'CM', 'Bafoussam', 'Hauts-Plateaux, marchés et royautés bamiléké.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-cm-limbe', 'CM', 'Limbe', 'Sable noir, océan et parc zoologique.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Burkina Faso
  ('esc-bf-ouaga', 'BF', 'Ouagadougou', 'Grande Mosquée, marchés et artisanat du zoma.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-bf-bobo', 'BF', 'Bobo-Dioulasso', 'Grande mosquée en banco et ruelles du vieux quartier.', ARRAY['/images/ouidah.jpg']),
  ('esc-bf-banfora', 'BF', 'Banfora', 'Cascades de Karfiguéla et plantations de canne.', ARRAY['/images/tori.jpg']),
  ('esc-bf-gorom', 'BF', 'Gorom-Gorom', 'Marché du jeudi touareg au cœur du Sahel.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-bf-sindou', 'BF', 'Pics de Sindou', 'Roches sculptées et randonnées au pays kassena.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Congo
  ('esc-cg-brazzaville', 'CG', 'Brazzaville', 'Basilique Sainte-Anne et marchés de Bacongo.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-cg-pointe-noire', 'CG', 'Pointe-Noire', 'Plage de La Pointe et vie du port.', ARRAY['/images/ouidah.jpg']),
  ('esc-cg-sibiti', 'CG', 'Sibiti', 'Case à palabres et chutes de Kondoro.', ARRAY['/images/tori.jpg']),
  ('esc-cg-oyo', 'CG', 'Oyo', 'Plateau du centre, rivières et bains de pierre.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-cg-ouesso', 'CG', 'Ouesso', 'Porte du parc de Nouabalé-Ndoki et forêt primaire.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Gabon
  ('esc-ga-libreville', 'GA', 'Libreville', 'Batterie IV, aquarium et estuaire.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-ga-pongara', 'GA', 'Pongara', 'Forêt mangrove et plage à une heure de la capitale.', ARRAY['/images/ouidah.jpg']),
  ('esc-ga-port-gentil', 'GA', 'Port-Gentil', 'Îles et plages de l''Ogooué-Maritime.', ARRAY['/images/tori.jpg']),
  ('esc-ga-lambarene', 'GA', 'Lambaréné', 'Hôpital Albert Schweitzer et îles de l''Ogooué.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-ga-lope', 'GA', 'Parc de la Lopé', 'Savanes et forêts classées UNESCO.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Guinée
  ('esc-gn-conakry', 'GN', 'Conakry', 'Péninsule de Kaloum, marchés et front de mer.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-gn-los', 'GN', 'Îles de Los', 'Plages rocheuses et baignade à un braquet du continent.', ARRAY['/images/ouidah.jpg']),
  ('esc-gn-labe', 'GN', 'Labé', 'Fouta-Djallon : montagnes, chutes et marchés de bétail.', ARRAY['/images/tori.jpg']),
  ('esc-gn-dalaba', 'GN', 'Dalaba', 'Ville fraîche des montagnes, bains et randonnées.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-gn-kindia', 'GN', 'Kindia', 'Chutes de la Soumba et pays de la mangue.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Mali
  ('esc-ml-bamako', 'ML', 'Bamako', 'Grand marché, musée national et rives du Niger.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-ml-djenne', 'ML', 'Djenné', 'Grande mosquée en banco et cité classée UNESCO.', ARRAY['/images/ouidah.jpg']),
  ('esc-ml-segou', 'ML', 'Ségou', 'Artisanat, Bognokoli et bords du fleuve.', ARRAY['/images/tori.jpg']),
  ('esc-ml-mopti', 'ML', 'Mopti', 'Port fluvial, pirogues et grand marché.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-ml-tombouctou', 'ML', 'Tombouctou', 'Manuscrits, mosquées de sable et histoires de sable.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- Niger
  ('esc-ne-niamey', 'NE', 'Niamey', 'Grand marché, grande mosquée et rives du fleuve.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-ne-agadez', 'NE', 'Agadez', 'Médina de banco et cité caravanière de l''Aïr.', ARRAY['/images/ouidah.jpg']),
  ('esc-ne-zinder', 'NE', 'Zinder', 'Palais du Sultan et grand marché de la médina.', ARRAY['/images/tori.jpg']),
  ('esc-ne-tillaberi', 'NE', 'Tillabéri', 'Rives du Niger et portes du parc W.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-ne-maradi', 'NE', 'Maradi', 'Marché du bétail et dombés du sud.', ARRAY['/images/pexels-artbovich-6283961.jpg']),
  -- République démocratique du Congo
  ('esc-cd-kinshasa', 'CD', 'Kinshasa', 'Corniche, Gombe et marchés de la capitale.', ARRAY['/images/pexels-artbovich-7214173.jpg']),
  ('esc-cd-goma', 'CD', 'Goma', 'Lac Kivu, sable noir et vue sur le Nyiragongo.', ARRAY['/images/ouidah.jpg']),
  ('esc-cd-bukavu', 'CD', 'Bukavu', 'Jardin botanique et rive sud du lac Kivu.', ARRAY['/images/tori.jpg']),
  ('esc-cd-lubumbashi', 'CD', 'Lubumbashi', 'Hauts-Katanga, musées et kifumbu.', ARRAY['/images/pexels-fotoaibe-1571460.jpg']),
  ('esc-cd-matadi', 'CD', 'Matadi', 'Port du Congo et gorges de l''Inga.', ARRAY['/images/pexels-artbovich-6283961.jpg'])
ON CONFLICT (id) DO NOTHING;

-- PostgREST doit recharger son schéma pour voir la nouvelle table.
NOTIFY pgrst, 'reload schema';
