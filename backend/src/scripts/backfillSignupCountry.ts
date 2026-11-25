/**
 * Backfill PONCTUEL des gérants inscrits avant la migration
 * `20261125130000_gerant_signup_country.sql` : `signup_ip` existe mais le pays
 * n'a jamais été stocké.
 *
 *   npx tsx src/scripts/backfillSignupCountry.ts
 *
 * Les nouveaux inscribed sont enrichis directement dans routes/auth.ts ; ce
 * script ne traite que les lignes historiques. Les IP privées (localhost,
 * VPN interne) restent vides : aucun pays fiable à en tirer.
 *
 * Rythme volontairement lent pour rester sous les quotas des services geoIP
 * gratuits (~45 req/min) même si le fournisseur change.
 */
import 'dotenv/config';
import { supabaseAdmin } from '../config/supabase';
import { fetchAllRows } from '../utils/fetchAll';
import { countryOfIp } from '../utils/geoIp';

const DELAY_MS = 1_500; // 60 / 45 ≈ 1,33 s entre deux résolutions réseau.
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface GerantGeoRow {
  id: string;
  signup_ip: string | null;
  signup_country: string | null;
}

async function main(): Promise<void> {
  const rows = await fetchAllRows<GerantGeoRow>((from, to) =>
    supabaseAdmin
      .from('gerants')
      .select('id, signup_ip, signup_country')
      .order('id', { ascending: true })
      .range(from, to),
  );

  const targets = rows.filter((row) => row.signup_ip && !row.signup_country);
  console.log(`${rows.length} gérant(s), ${targets.length} à enrichir.`);

  let enriched = 0;
  let failed = 0;
  for (const row of targets) {
    const geo = await countryOfIp(row.signup_ip);
    if (!geo) {
      failed += 1;
      console.warn(`[geo] non résolu pour ${row.id}`);
      await sleep(DELAY_MS);
      continue;
    }

    const { error } = await supabaseAdmin
      .from('gerants')
      .update({
        signup_country: geo.countryCode,
        signup_country_name: geo.country,
      })
      .eq('id', row.id);

    if (error) {
      failed += 1;
      console.error(`[geo] échec d'écriture pour ${row.id} : ${error.message}`);
    } else {
      enriched += 1;
      console.log(`[geo] ${row.id} -> ${geo.countryCode} (${geo.country})`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Terminé : ${enriched} enrichi(s), ${failed} en échec.`);
}

void main().catch((error: unknown) => {
  console.error('[backfill] erreur fatale :', error);
  process.exitCode = 1;
});
