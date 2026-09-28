import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { createClientLimiter } from '../utils/rateLimiters';
import { newsletterSubscribeSchema } from '../validations/newsletter';

const router = Router();
const newsletterLimiter = createClientLimiter({ limit: 10 });

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
}

router.post('/', newsletterLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = newsletterSubscribeSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }

    const { email, market } = parsedBody.data;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('id, unsubscribed_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (existing && !existing.unsubscribed_at) {
      return res.status(200).json({ message: 'Vous êtes déjà inscrit.' });
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from('newsletter_subscribers')
        .update({
          unsubscribed_at: null,
          consent_at: new Date().toISOString(),
          market: market ?? null,
        })
        .eq('id', existing.id);
      if (error) throw error;
      return res.status(200).json({ message: 'Merci ! Vous recevrez nos prochaines offres.' });
    }

    const { data, error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({
        id: randomUUID(),
        email,
        market: market ?? null,
        source: 'footer',
      })
      .select('id, email, created_at')
      .single();
    if (error) {
      if (isUniqueViolation(error)) {
        return res.status(200).json({ message: 'Vous êtes déjà inscrit.' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
