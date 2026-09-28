import 'dotenv/config';
import { supabaseAdmin } from './config/supabase';

/**
 * Seed de démonstration du parcours CLIENT (réservations → avis).
 *
 * Il se base sur l'ID Clerk du client déjà inscrit dans l'app : impossible de
 * le deviner avant connexion, d'où ce second script.
 *
 *   1. npm run seed           → catégories + chambres + événements
 *   2. s'inscrire comme CLIENT dans l'app (crée la ligne `clients`)
 *   3. npm run seed:demo      → réservations + avis rattachés à CE compte
 *
 * Idempotent : n'insère que les IDs absents, ne réécrit jamais une ligne
 * existante (un avis publié depuis l'app n'est pas écrasé).
 */

function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoInstantInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Chambres CI utilisées par le scénario (le site d'exemple est /ci/compte).
const ROOM_IDS = [
  'abidjan-plateau-moderne',
  'abidjan-cocody-studio',
  'abidjan-marcoral-ville',
  'abidjan-treichville-studio',
  'bouake-centre-appart',
  'yamoussoukro-paix-chambre',
];

type Room = { id: string; title: string; price_num: number | null };

// L'avis déjà publié pour le compte de test (table `reviews` = UUID).
const REV_ME_ID = '00000000-0000-4000-8000-000000000001';

async function loadRooms(): Promise<Room[]> {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, title, price_num')
    .in('id', ROOM_IDS);
  if (error) throw error;
  return data ?? [];
}

async function pickClient(): Promise<{ id: string; email: string; name: string } | null> {
  const wanted = (process.env.SEED_CLIENT_EMAIL || '').trim().toLowerCase();

  let query = supabaseAdmin
    .from('clients')
    .select('id, email, nom, prenom, created_at');
  if (wanted) query = query.eq('email', wanted);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;

  const name = [row.prenom, row.nom].filter(Boolean).join(' ')
    || String(row.email).split('@')[0];
  return { id: row.id, email: row.email, name };
}

async function insertMissing<T extends { id: string }>(
  table: 'reservations' | 'reviews',
  rows: T[],
  label: string,
): Promise<void> {
  const { data: existing, error: checkError } = await supabaseAdmin
    .from(table)
    .select('id')
    .in('id', rows.map((r) => r.id));
  if (checkError) throw checkError;

  const present = new Set((existing ?? []).map((r) => r.id));
  const toInsert = rows.filter((r) => !present.has(r.id));

  if (toInsert.length === 0) {
    console.log(`  ${label} déjà présents — inchangé`);
    return;
  }

  const { error } = await supabaseAdmin.from(table).insert(toInsert);
  if (error) throw error;
  console.log(`  ${toInsert.length} ${label} créés (${rows.length - toInsert.length} existants conservés)`);
}

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    console.error('[seed:demo] Refusé : NODE_ENV=production sans ALLOW_SEED=true.');
    process.exit(1);
  }

  console.log('Seeding demo (parcours client)...');

  const rooms = await loadRooms();
  if (rooms.length < ROOM_IDS.length) {
    const found = new Set(rooms.map((r) => r.id));
    const missing = ROOM_IDS.filter((id) => !found.has(id));
    console.error(`[seed:demo] Chambres introuvables : ${missing.join(', ')}`);
    console.error('[seed:demo] Lancez d\'abord : npm run seed');
    process.exit(1);
  }
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const client = await pickClient();
  if (!client) {
    console.error('[seed:demo] Aucun compte client trouvé.');
    console.error('[seed:demo] Inscrivez-vous comme CLIENT dans l\'app, puis relancez.');
    console.error('[seed:demo] (ou definez SEED_CLIENT_EMAIL dans backend/.env)');
    process.exit(1);
  }
  console.log(`  client cible : ${client.name} <${client.email}>`);

  // Réservations : la 2e est confirmée ET non notée → bouton « Laisser un avis ».
  const reservations = [
    {
      id: 'demo-res-plateau',
      client_name: client.name,
      client_email: client.email,
      room_id: 'abidjan-plateau-moderne',
      room_title: roomById.get('abidjan-plateau-moderne')!.title,
      date_debut: isoDateInDays(-75),
      date_fin: isoDateInDays(-45),
      montant: roomById.get('abidjan-plateau-moderne')!.price_num,
      message: 'Séjour de démonstration',
      statut: 'confirmee',
      created_at: isoInstantInDays(-76),
      responded_at: isoInstantInDays(-74),
    },
    {
      id: 'demo-res-cocody',
      client_name: client.name,
      client_email: client.email,
      room_id: 'abidjan-cocody-studio',
      room_title: roomById.get('abidjan-cocody-studio')!.title,
      date_debut: isoDateInDays(-30),
      date_fin: isoDateInDays(-5),
      montant: roomById.get('abidjan-cocody-studio')!.price_num,
      message: 'Séjour de démonstration',
      statut: 'confirmee',
      created_at: isoInstantInDays(-31),
      responded_at: isoInstantInDays(-29),
    },
    {
      id: 'demo-res-marcory',
      client_name: client.name,
      client_email: client.email,
      room_id: 'abidjan-marcoral-ville',
      room_title: roomById.get('abidjan-marcoral-ville')!.title,
      date_debut: isoDateInDays(10),
      date_fin: isoDateInDays(40),
      montant: roomById.get('abidjan-marcoral-ville')!.price_num,
      message: 'Réservation en attente de confirmation',
      statut: 'en_attente',
      created_at: isoInstantInDays(-2),
      responded_at: null,
    },
    // Réservations d'autres clients : elles portent les avis affichés sur
    // l'accueil (« Ce qu'ils en disent »).
    {
      id: 'demo-res-fake-1',
      client_name: 'Fatou Diabaté',
      client_email: 'fatou.diabate@example.ci',
      room_id: 'abidjan-treichville-studio',
      room_title: roomById.get('abidjan-treichville-studio')!.title,
      date_debut: isoDateInDays(-120),
      date_fin: isoDateInDays(-90),
      montant: roomById.get('abidjan-treichville-studio')!.price_num,
      statut: 'confirmee',
      created_at: isoInstantInDays(-121),
      responded_at: isoInstantInDays(-119),
    },
    {
      id: 'demo-res-fake-2',
      client_name: 'Moussa Traoré',
      client_email: 'moussa.traore@example.ci',
      room_id: 'bouake-centre-appart',
      room_title: roomById.get('bouake-centre-appart')!.title,
      date_debut: isoDateInDays(-95),
      date_fin: isoDateInDays(-70),
      montant: roomById.get('bouake-centre-appart')!.price_num,
      statut: 'confirmee',
      created_at: isoInstantInDays(-96),
      responded_at: isoInstantInDays(-94),
    },
    {
      id: 'demo-res-fake-3',
      client_name: 'Awa Kouassi',
      client_email: 'awa.kouassi@example.ci',
      room_id: 'yamoussoukro-paix-chambre',
      room_title: roomById.get('yamoussoukro-paix-chambre')!.title,
      date_debut: isoDateInDays(-150),
      date_fin: isoDateInDays(-130),
      montant: roomById.get('yamoussoukro-paix-chambre')!.price_num,
      statut: 'confirmee',
      created_at: isoInstantInDays(-151),
      responded_at: isoInstantInDays(-149),
    },
  ];

  await insertMissing('reservations', reservations, 'réservations');

  const reviews = [
    {
      id: REV_ME_ID,
      room_id: 'abidjan-plateau-moderne',
      client_id: client.id,
      client_name: client.name,
      reservation_id: 'demo-res-plateau',
      note_appartement: 5,
      note_gerant: 5,
      commentaire: 'Séjour très agréable, l\'appartement était exactement comme sur les photos. Le gérant a répondu en moins d\'une heure.',
      created_at: isoInstantInDays(-44),
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      room_id: 'abidjan-treichville-studio',
      client_id: null,
      client_name: 'Fatou Diabaté',
      reservation_id: 'demo-res-fake-1',
      note_appartement: 5,
      note_gerant: 5,
      commentaire: 'Studio propre et bien placé, WiFi impeccable pour le télétravail. La réservation a été traitée en une journée.',
      created_at: isoInstantInDays(-60),
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      room_id: 'bouake-centre-appart',
      client_id: null,
      client_name: 'Moussa Traoré',
      reservation_id: 'demo-res-fake-2',
      note_appartement: 4,
      note_gerant: 5,
      commentaire: 'Bel appartement au centre de Bouaké, spacieux et calme. Petit bémol sur la pression de l\'eau, mais le gérant s\'en est occupé.',
      created_at: isoInstantInDays(-40),
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      room_id: 'yamoussoukro-paix-chambre',
      client_id: null,
      client_name: 'Awa Kouassi',
      reservation_id: 'demo-res-fake-3',
      note_appartement: 5,
      note_gerant: 4,
      commentaire: 'Chambre meublée idéale pour un court séjour, tout est à proximité de la basilique. Je reviendrai.',
      created_at: isoInstantInDays(-20),
    },
  ];

  await insertMissing('reviews', reviews, 'avis');

  // On rattache les lignes de démo au compte cible : à relancer si on change
  // de compte de test. Seules les lignes `demo-res-*` (hors `demo-res-fake-*`)
  // sont touchées — jamais une donnée réelle.
  const demoOwnedIds = reservations
    .filter((r) => r.id.startsWith('demo-res-') && !r.id.startsWith('demo-res-fake-'))
    .map((r) => r.id);

  const { error: reattachRes } = await supabaseAdmin
    .from('reservations')
    .update({ client_email: client.email, client_name: client.name })
    .in('id', demoOwnedIds);
  if (reattachRes) throw reattachRes;

  const { error: reattachRev } = await supabaseAdmin
    .from('reviews')
    .update({ client_id: client.id, client_name: client.name })
    .eq('id', REV_ME_ID);
  if (reattachRev) throw reattachRev;

  console.log(`  lignes de démo rattachées à ${client.email}`);

  console.log('[seed:demo] Terminé.');
  console.log('[seed:demo] → /ci/compte : « demo-res-cocody » affiche le bouton « Laisser un avis ».');
}

seed().catch((err) => {
  console.error('[seed:demo] Échec:', err instanceof Error ? err.message : err);
  process.exit(1);
});
