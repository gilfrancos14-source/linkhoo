import { z } from 'zod';

/**
 * Référence interne d'un paiement (`PAY-2026-A1B2C3D4E5F6`).
 *
 * Le format est celui du CHECK de `payments.reference` (migration 0030) : le
 * valider ici évite d'envoyer une chaîne arbitraire à PostgREST.
 */
export const paymentReferenceSchema = z
  .string()
  .trim()
  .regex(/^PAY-[A-Z0-9-]{6,40}$/, 'Référence de paiement invalide');

export const paymentReferenceParamsSchema = z.object({
  reference: paymentReferenceSchema,
});

const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Numéro trop court')
  .max(24, 'Numéro trop long')
  .regex(/^\+?[0-9 ().-]+$/, 'Numéro invalide');

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

/**
 * Coordonnées de reversement déclarées par le gérant.
 *
 * Les champs sont validés par moyen de paiement : un transfert mobile money
 * sans opérateur, ou un virement sans banque, serait refusé par Hub2 après
 * avoir bloqué le payout. Mieux vaut refuser à la saisie.
 */
export const payoutSettingsSchema = z
  .object({
    method: z.enum(['mobile_money', 'bank_transfer']),
    phone: phoneSchema.nullable().optional(),
    provider: optionalText(30),
    bank_code: optionalText(20),
    bank_name: optionalText(80),
    account_number: optionalText(40),
    holder_name: z.string().trim().min(2, 'Nom du titulaire requis').max(120),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.method === 'mobile_money') {
      if (!value.phone) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Numéro mobile money requis' });
      }
      if (!value.provider) {
        ctx.addIssue({ code: 'custom', path: ['provider'], message: 'Opérateur requis' });
      }
      return;
    }

    if (!value.phone) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Numéro du bénéficiaire requis',
      });
    }
    if (!value.bank_code) {
      ctx.addIssue({ code: 'custom', path: ['bank_code'], message: 'Code banque requis' });
    }
    if (!value.bank_name) {
      ctx.addIssue({ code: 'custom', path: ['bank_name'], message: 'Nom de la banque requis' });
    }
    if (!value.account_number) {
      ctx.addIssue({
        code: 'custom',
        path: ['account_number'],
        message: 'Numéro de compte requis',
      });
    }
  });

export const payoutVerificationSchema = z.object({ verified: z.boolean() }).strict();
