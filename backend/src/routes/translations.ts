import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { saveCorrection } from '../i18n/corrections';

const router = Router();

const reportSchema = z
  .object({
    entityType: z.enum(['room', 'category', 'banner', 'event', 'destination', 'escapade']),
    entityId: z.string().trim().min(1).max(200),
    locale: z.enum(['en', 'es']),
    field: z.string().trim().min(1).max(50),
    value: z.string().trim().min(1).max(2000),
  })
  .strict();

/** Signalement d'une traduction douteuse par un visiteur. */
router.post('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Signalement invalide' });
    }
    await saveCorrection(
      parsed.data.entityType,
      parsed.data.entityId,
      parsed.data.locale,
      parsed.data.field,
      parsed.data.value,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
