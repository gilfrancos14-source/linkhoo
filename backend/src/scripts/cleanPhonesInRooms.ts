// Audit (par défaut) puis nettoyage (--write) des annonces dont la description
// ou les conditions contiennent un numéro de téléphone. La règle de validation
// arrive après coup : ce script assainit l'existant, le serveur refuse les
// nouvelles saisies.
//
// Usage (depuis backend/, SUPABASE_URL / SUPABASE_SERVICE_KEY requises) :
//   npm run clean:rooms:phones           → audit seul, rien n'est modifié
//   npm run clean:rooms:phones -- --write → retire les coordonnées détectées
import 'dotenv/config';
import { supabaseAdmin } from '../config/supabase';
import { containsPhoneNumber, stripPhoneFromText } from '../utils/phoneInText';

const PAGE_SIZE = 500;
const FIELDS = ['description', 'conditions'] as const;

async function main() {
  const write = process.argv.includes('--write');
  let from = 0;
  let flagged = 0;
  let rooms = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('id, title, description, conditions')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    if (batch.length === 0) break;

    for (const room of batch) {
      const patch: Record<string, string> = {};
      for (const field of FIELDS) {
        const value = room[field];
        if (typeof value !== 'string' || !containsPhoneNumber(value)) continue;
        flagged += 1;
        const { text, changed } = stripPhoneFromText(value);
        console.log(`[téléphone] room ${room.id} (${room.title}) · ${field}`);
        console.log(`  avant : ${value}`);
        console.log(`  après : ${changed ? text : '(nettoyage impossible, à corriger à la main)'}`);
        if (write && changed) patch[field] = text;
      }
      if (Object.keys(patch).length > 0) {
        rooms += 1;
        if (write) {
          const { error: updateError } = await supabaseAdmin.from('rooms').update(patch).eq('id', room.id);
          if (updateError) throw new Error(`${room.id} : ${updateError.message}`);
        }
      }
    }

    from += PAGE_SIZE;
    if (batch.length < PAGE_SIZE) break;
  }

  console.log(`\n${flagged} champ(s) concerné(s) dans ${rooms} annonce(s).`);
  if (write) console.log('Nettoyage appliqué.');
  else if (flagged > 0) console.log('Audit seul : relancez avec --write pour appliquer le nettoyage.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
