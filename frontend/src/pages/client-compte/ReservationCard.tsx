import type { CSSProperties } from 'react';
import type { ClientMineReservationData } from '../../lib/api';
import {
  canPayReservation,
  paymentColors,
  paymentLabels,
  statutLabels,
  statutColors,
} from '../../lib/reservations';
import { formatPrice } from '../../lib/roomDisplay';
import Glyph, { glyphCalendar } from './Glyph';
import { formatStayDates } from './stayDates';

/** Carte d'une réservation cliente (visuel, statut, métadonnées, actions). */
export default function ReservationCard({
  reservation: r,
  canReview,
  isReviewed,
  cancellingId,
  payingId,
  onCancel,
  onReview,
  onPay,
}: {
  reservation: ClientMineReservationData;
  canReview: boolean;
  isReviewed: boolean;
  cancellingId: string | null;
  payingId?: string | null;
  onCancel: (id: string) => void;
  onReview: (reservation: ClientMineReservationData) => void;
  onPay?: (reservation: ClientMineReservationData) => void;
}) {
  const statutColor = statutColors[r.statut] || 'var(--ink-soft)';
  const paymentStatus = r.payment_status;
  const paymentColor = paymentStatus ? paymentColors[paymentStatus] : undefined;
  const showPay = Boolean(onPay) && r.statut !== 'annulee' && canPayReservation(paymentStatus);
  return (
    <article className="client-compte__card client-compte__card--res">
      <div className="client-compte__card-media">
        {r.room?.img ? (
          <img
            src={r.room.img}
            alt={r.room.alt || r.room_title}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span className="client-compte__card-media-fallback" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="15" rx="2" />
              <circle cx="8.5" cy="10" r="1.5" />
              <path d="M21 15.5l-4.5-4.5L11 16.5l-2.5-2.5L3 19.5" />
            </svg>
          </span>
        )}
        <span
          className="client-compte__status"
          style={{ '--statut': statutColor } as CSSProperties}
        >
          <span className="client-compte__status-dot" />
          {statutLabels[r.statut] || r.statut}
        </span>
      </div>

      <div className="client-compte__card-body">
        <h3 className="client-compte__card-title">{r.room_title}</h3>

        {r.room?.description && (
          <p className="client-compte__card-desc">{r.room.description}</p>
        )}

        <div className="client-compte__card-meta">
          <span className="client-compte__meta">
            <Glyph>{glyphCalendar}</Glyph>
            {formatStayDates(r.date_debut, r.date_fin)}
          </span>
          <span className="client-compte__chip client-compte__chip--muted">
            {r.duree_nombre ?? 1} {r.duree_unite === 'mois' ? 'mois' : (r.duree_nombre ?? 1) > 1 ? 'nuits' : 'nuit'}
          </span>
          {r.montant ? (
            <span className="client-compte__price">
              {formatPrice(r.montant)}
              <span className="client-compte__price-unit">
                FCFA / {r.duree_unite === 'mois' ? 'mois' : 'nuit'}
              </span>
            </span>
          ) : null}
          {paymentStatus && (
            <span
              className="client-compte__chip client-compte__chip--muted"
              style={paymentColor ? { color: paymentColor, borderColor: paymentColor } : undefined}
            >
              {paymentLabels[paymentStatus]}
            </span>
          )}
          {typeof r.refunded_amount === 'number' && r.refunded_amount > 0 && (
            <span className="client-compte__chip client-compte__chip--muted">
              Remboursé : {formatPrice(r.refunded_amount)} FCFA
            </span>
          )}
        </div>

        <div className="client-compte__card-actions">
          {showPay && (
            <button
              type="button"
              className="client-compte__btn client-compte__btn--primary"
              onClick={() => onPay?.(r)}
              disabled={payingId === r.id}
            >
              {payingId === r.id ? 'Redirection…' : 'Payer'}
            </button>
          )}
          {r.statut !== 'annulee' && (
            <button
              type="button"
              className="client-compte__btn client-compte__btn--danger"
              onClick={() => onCancel(r.id)}
              disabled={cancellingId === r.id}
            >
              {cancellingId === r.id ? 'Annulation…' : 'Annuler'}
            </button>
          )}
          {canReview && (
            <button
              type="button"
              className="client-compte__btn client-compte__btn--primary"
              onClick={() => onReview(r)}
            >
              Laisser un avis
            </button>
          )}
          {isReviewed && (
            <span className="client-compte__chip client-compte__chip--ok">Avis publié</span>
          )}
        </div>
      </div>
    </article>
  );
}
