import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { createClientLimiter } from '../utils/rateLimiters';
import { contactMessageSchema } from '../validations/contact';
import { sendContactEmail } from '../services/mailer';

const router = Router();

// 5 messages par IP et par tranche de 15 minutes : largement suffisant pour
// un formulaire de contact, suffisant pour limiter le spam (avec le pot de
// miel `website`, aucune dépendance anti-robot tierce).
const contactLimiter = createClientLimiter({ limit: 5 });

router.post('/', contactLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = contactMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({ error: issue?.message ?? 'Formulaire invalide.' });
    }
    const data = parsed.data;

    // Pot de miel : un humain laisse le champ vide. On répond comme un
    // succès pour ne pas instruire le robot, sans écrire ni envoyer.
    if (data.website) {
      return res.status(201).json({ message: 'Votre message a bien été envoyé.' });
    }

    const id = randomUUID();
    const { error: insertError } = await supabaseAdmin.from('contact_messages').insert({
      id,
      nom: data.nom,
      prenom: data.prenom || null,
      email: data.email,
      telephone: data.telephone || null,
      pays: data.pays,
      sujet: data.sujet,
      message: data.message,
      market: data.market ?? null,
      status: 'pending',
    });
    if (insertError) throw insertError;

    try {
      await sendContactEmail(data);
    } catch (err) {
      // L'utilisateur ne doit jamais croire qu'un mail est parti alors
      // qu'il ne l'est pas : 502 + historique `failed` (renvoi possible).
      const reason = err instanceof Error ? err.message : 'Erreur inconnue';
      const { error: failError } = await supabaseAdmin
        .from('contact_messages')
        .update({ status: 'failed', error: reason })
        .eq('id', id);
      if (failError) {
        console.error(`[contact] marquage failed impossible (${id}) :`, failError.message);
      }
      return res.status(502).json({ error: "L'envoi a échoué. Veuillez réessayer." });
    }

    // Best-effort : le mail est déjà parti, un échec de mise à jour ne doit
    // pas renvoyer une erreur (le client réessaierait → double envoi).
    const { error: sentError } = await supabaseAdmin
      .from('contact_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);
    if (sentError) {
      console.error(`[contact] marquage sent impossible (${id}) :`, sentError.message);
    }

    return res.status(201).json({ message: 'Votre message a bien été envoyé.', id });
  } catch (err) {
    next(err);
  }
});

export default router;
