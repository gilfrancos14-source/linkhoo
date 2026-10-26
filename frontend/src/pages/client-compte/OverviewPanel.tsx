import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { ClientMineReservationData } from '../../lib/api';
import { statutLabels, statutColors } from '../../lib/reservations';
import { formatPrice } from '../../lib/roomDisplay';
import Glyph, { glyphCalendar, glyphChat, glyphStar } from './Glyph';
import { formatStayDates } from './stayDates';

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Vue « Vue d'ensemble » : salutation, indicateurs, activité et raccourcis. */
export default function OverviewPanel({
  displayName,
  todayLabel,
  reservations,
  reviewableCount,
  unreadMessages,
  homePath,
  onGoToStays,
  onGoToProfile,
}: {
  displayName: string;
  todayLabel: string;
  reservations: ClientMineReservationData[];
  reviewableCount: number;
  unreadMessages: number;
  homePath: string;
  onGoToStays: () => void;
  onGoToProfile: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = reservations
    .filter((r) => r.statut !== 'annulee' && r.date_debut >= todayIso)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));
  const nextStay = upcoming[0];

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('fr-FR', { month: 'short' }),
    };
  }).map((month) => ({
    ...month,
    count: reservations.filter((r) => monthKey(r.date_debut) === month.key).length,
  }));
  const maxMonth = Math.max(1, ...months.map((m) => m.count));

  const recent = [...reservations]
    .sort((a, b) => b.date_debut.localeCompare(a.date_debut))
    .slice(0, 4);

  return (
    <div className="cdash-overview">
      <section className="cdash-hero">
        <div className="cdash-hero__glow" aria-hidden="true" />
        <div className="cdash-hero__pattern" aria-hidden="true" />
        <div className="cdash-hero__copy">
          <span className="cdash-hero__eyebrow">
            <span className="cdash-hero__eyebrow-dot" aria-hidden="true" />
            Espace client
          </span>
          <p className="cdash-hero__greeting">Bonjour {displayName}</p>
          <p className="cdash-hero__lead">
            Suivez vos séjours, publiez vos avis et gardez un œil sur vos échanges.
          </p>
          <span className="cdash-hero__date">
            <Glyph>{glyphCalendar}</Glyph>
            {todayLabel}
          </span>
        </div>
      </section>

      <div className="cdash-grid">
        <section className="cdash-card cdash-card--chart">
          <div className="cdash-card__head">
            <h2 className="cdash-card__title">Activité des séjours</h2>
            <span className="cdash-card__hint">6 derniers mois</span>
          </div>
          <div className="cdash-chart" role="img" aria-label="Nombre de séjours réservés par mois">
            {months.map((month) => (
              <div className="cdash-chart__col" key={month.key}>
                <span className="cdash-chart__value">{month.count}</span>
                <span
                  className="cdash-chart__bar"
                  style={{ height: `${Math.round((month.count / maxMonth) * 100)}%` }}
                />
                <span className="cdash-chart__label">{month.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="cdash-card cdash-card--next">
          <div className="cdash-card__head">
            <h2 className="cdash-card__title">Prochain séjour</h2>
          </div>
          {nextStay ? (
            <div className="cdash-next">
              <div className="cdash-next__media">
                {nextStay.room?.img ? (
                  <img
                    src={nextStay.room.img}
                    alt={nextStay.room.alt || nextStay.room_title}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span className="cdash-next__fallback" aria-hidden="true">
                    <Glyph>{glyphCalendar}</Glyph>
                  </span>
                )}
              </div>
              <p className="cdash-next__title">{nextStay.room_title}</p>
              <p className="cdash-next__dates">
                <Glyph>{glyphCalendar}</Glyph>
                {formatStayDates(nextStay.date_debut, nextStay.date_fin)}
              </p>
              <span
                className="cdash-next__status"
                style={{ '--statut': statutColors[nextStay.statut] || 'var(--ink-soft)' } as CSSProperties}
              >
                <span className="cdash-next__dot" />
                {statutLabels[nextStay.statut] || nextStay.statut}
              </span>
            </div>
          ) : (
            <div className="cdash-empty">
              <span className="cdash-empty__icon" aria-hidden="true"><Glyph>{glyphCalendar}</Glyph></span>
              <p className="cdash-empty__text">Aucun séjour à venir pour le moment.</p>
              <Link to={homePath} className="cdash-btn cdash-btn--primary">Parcourir les appartements</Link>
            </div>
          )}
        </section>

        <section className="cdash-card cdash-card--recent">
          <div className="cdash-card__head">
            <h2 className="cdash-card__title">Derniers séjours</h2>
            <button type="button" className="cdash-card__link" onClick={onGoToStays}>
              Voir tout
            </button>
          </div>
          {recent.length > 0 ? (
            <ul className="cdash-list">
              {recent.map((r) => (
                <li className="cdash-list__row" key={r.id}>
                  <span className="cdash-list__thumb" aria-hidden="true">
                    {r.room?.img ? <img src={r.room.img} alt="" loading="lazy" /> : <Glyph>{glyphCalendar}</Glyph>}
                  </span>
                  <span className="cdash-list__body">
                    <span className="cdash-list__title">{r.room_title}</span>
                    <span className="cdash-list__sub">{formatStayDates(r.date_debut, r.date_fin)}</span>
                  </span>
                  <span className="cdash-list__end">
                    <span
                      className="cdash-list__status"
                      style={{ '--statut': statutColors[r.statut] || 'var(--ink-soft)' } as CSSProperties}
                    >
                      {statutLabels[r.statut] || r.statut}
                    </span>
                    {r.montant ? (
                      <span className="cdash-list__amount">{formatPrice(r.montant)} FCFA</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cdash-card__empty">Aucune réservation enregistrée.</p>
          )}
        </section>

        <section className="cdash-card cdash-card--side">
          <div className="cdash-card__head">
            <h2 className="cdash-card__title">Messages</h2>
            {unreadMessages > 0 && <span className="cdash-pill">{unreadMessages} non lus</span>}
          </div>
          <p className="cdash-card__empty">
            {unreadMessages > 0
              ? 'Vous avez des messages non lus de la part des gérants.'
              : 'Aucun message non lu. Échangez avec les gérants depuis vos séjours.'}
          </p>
          <Link to={`${homePath}/messages`} className="cdash-btn cdash-btn--ghost">
            <Glyph>{glyphChat}</Glyph>
            Ouvrir la messagerie
          </Link>

          {reviewableCount > 0 && (
            <div className="cdash-nudge">
              <span className="cdash-nudge__icon" aria-hidden="true"><Glyph>{glyphStar}</Glyph></span>
              <p className="cdash-nudge__text">
                {reviewableCount} séjour(s) confirmé(s) à noter.
              </p>
              <button type="button" className="cdash-btn cdash-btn--primary" onClick={onGoToStays}>
                Laisser un avis
              </button>
            </div>
          )}

          <button type="button" className="cdash-btn cdash-btn--ghost" onClick={onGoToProfile}>
            Modifier mon profil
          </button>
        </section>
      </div>
    </div>
  );
}
