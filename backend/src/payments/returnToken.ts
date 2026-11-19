/**
 * Jeton signé joint à l'URL de retour du checkout pawaPay.
 *
 * Le `reference` seul ne prouve pas que l'appelant vient du parcours de
 * réservation : n'importe qui le connaissant pouvait déclencher la confirmation.
 * Le jeton est lié à la réservation et à son but, signé côté serveur, et ne
 * transite que dans l'URL de retour (jamais exposé dans une réponse API).
 */

import jwt from 'jsonwebtoken';

const TOKEN_TTL = '24h';

function secret(): string {
  const configured = process.env.PAYMENT_RETURN_SECRET || process.env.CLERK_SECRET_KEY;
  // Un secret constant en production rendrait les jetons forgeables : on échoue
  // explicitement plutôt que de signer avec une valeur connue de tous.
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error(
      'PAYMENT_RETURN_SECRET ou CLERK_SECRET_KEY requis pour signer les jetons de retour paiement',
    );
  }
  return configured || 'dev-payment-return-secret';
}

interface ReturnTokenPayload extends jwt.JwtPayload {
  reservation_id: string;
  payment_purpose: 'booking';
}

export function createBookingReturnToken(reservationId: string): string {
  return jwt.sign(
    { reservation_id: reservationId, payment_purpose: 'booking' },
    secret(),
    { expiresIn: TOKEN_TTL },
  );
}

export function verifyBookingReturnToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, secret()) as ReturnTokenPayload;
    if (payload.payment_purpose !== 'booking' || typeof payload.reservation_id !== 'string') {
      return null;
    }
    return payload.reservation_id;
  } catch {
    return null;
  }
}
