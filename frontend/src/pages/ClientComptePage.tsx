import { useState, useEffect, useCallback, type FormEvent, type ReactNode, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { setAuthTokenGetter, apiClients, apiReviews, type ClientMineReservationData, type ReviewData } from '../lib/api';
import { getMyReservations, cancelMyReservation, statutLabels, statutColors } from '../lib/reservations';

type Tab = 'reservations' | 'profil';

function formatStayDates(from: string, to: string): string {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };
  const d1 = parse(from);
  const d2 = parse(to);
  if (!d1 || !d2) return `${from} → ${to}`;
  const sameYear = d1.getFullYear() === d2.getFullYear();
  const a = d1.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const b = d2.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${a} → ${b}`;
}

interface ReviewFormState {
  reservationId: string;
  roomTitle: string;
  noteAppartement: number;
  noteGerant: number;
  commentaire: string;
}

function Stars({ value, onChange, label }: {
  value: number;
  onChange?: (v: number) => void;
  label: string;
}) {
  return (
    <div className="star-rating" role={onChange ? 'radiogroup' : 'img'} aria-label={`${label} : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-rating__star${n <= value ? ' is-active' : ''}`}
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          tabIndex={onChange ? 0 : -1}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      className="client-compte__glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const glyphCalendar = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10.5h18" />
  </>
);

const glyphStar = (
  <path d="M12 3.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.62 6.9 19.3l.98-5.68L3.75 9.6l5.7-.83z" />
);

const glyphUser = (
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </>
);

export default function ClientComptePage() {
  const homePath = useHomePath();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();
  const { signOut } = useClerk();

  const [tab, setTab] = useState<Tab>('reservations');
  const [reservations, setReservations] = useState<ClientMineReservationData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewsError, setReviewsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [reviewForm, setReviewForm] = useState<ReviewFormState | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({ nom: '', prenom: '', telephone: '' });

  const email = user?.primaryEmailAddress?.emailAddress
    || user?.emailAddresses?.[0]?.emailAddress
    || '';
  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, revs] = await Promise.all([
        getMyReservations(),
        apiReviews
          .listMine()
          .then((loaded) => ({ loaded, ok: true }))
          .catch(() => ({ loaded: [] as ReviewData[], ok: false })),
      ]);
      setReservations(res);
      setReviews(revs.loaded);
      setReviewsError(!revs.ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger vos données.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) void loadData();
  }, [isLoaded, loadData]);

  useEffect(() => {
    apiClients.getMe().then((profile) => {
      setProfileForm({
        nom: profile.nom ?? '',
        prenom: profile.prenom ?? '',
        telephone: profile.telephone ?? '',
      });
    }).catch(() => {
      setProfileForm({ nom: lastName, prenom: firstName, telephone: '' });
    });
  }, [firstName, lastName]);

  const reviewedReservationIds = new Set(reviews.map((r) => r.reservation_id));
  const reviewable = reservations.filter(
    (r) => r.statut === 'confirmee' && r.room_id && !reviewedReservationIds.has(r.id),
  );

  const displayName = firstName || profileForm.prenom || 'à vous';
  const initials = `${firstName.charAt(0) || profileForm.prenom.charAt(0)}${lastName.charAt(0) || profileForm.nom.charAt(0)}`
    .toUpperCase() || 'U';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '';
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'reservations', label: 'Mes réservations', count: reservations.length },
    { id: 'profil', label: 'Mon profil', count: 0 },
  ];
  const activeTabLabel = tabs.find((t) => t.id === tab)?.label ?? 'Mon espace';

  const handleCancel = async (id: string) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    setCancellingId(id);
    setError('');
    try {
      await cancelMyReservation(id);
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, statut: 'annulee' as const } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'annuler la réservation.');
    } finally {
      setCancellingId(null);
    }
  };

  const openReviewForm = (reservation: ClientMineReservationData) => {
    setReviewError('');
    setReviewSuccess('');
    setReviewForm({
      reservationId: reservation.id,
      roomTitle: reservation.room_title,
      noteAppartement: 5,
      noteGerant: 5,
      commentaire: '',
    });
  };

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewForm) return;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await apiReviews.create({
        reservation_id: reviewForm.reservationId,
        note_appartement: reviewForm.noteAppartement,
        note_gerant: reviewForm.noteGerant,
        commentaire: reviewForm.commentaire,
      });
      setReviewForm(null);
      setReviewSuccess('Merci ! Votre avis a bien été publié.');
      await loadData();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Impossible de publier l\'avis.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await apiClients.updateMe(profileForm);
      setProfileSuccess('Profil mis à jour avec succès.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Impossible de mettre à jour le profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(homePath);
  };

  return (
    <main className="client-compte">
      <div className="container">
        <div className="compte-shell">

          <aside className="compte-rail" aria-label="Mon espace">
            <div className="compte-rail__identity">
              <span className="compte-rail__avatar" aria-hidden="true">{initials}</span>
              <div className="compte-rail__id">
                <p className="compte-rail__name">{displayName}</p>
                {email && <p className="compte-rail__email">{email}</p>}
              </div>
            </div>

            <nav className="compte-rail__nav" role="tablist" aria-label="Sections de mon espace">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="cp-panel"
                    className={`compte-rail__link${active ? ' is-active' : ''}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                    {t.count > 0 && <span className="compte-rail__pill">{t.count}</span>}
                  </button>
                );
              })}
            </nav>

            <div className="compte-rail__footer">
              {memberSince && (
                <span className="compte-rail__badge">Membre depuis {memberSince}</span>
              )}
              <button type="button" className="compte-rail__signout" onClick={handleSignOut}>
                Se déconnecter
              </button>
            </div>
          </aside>

          <div className="compte-main">
            <div className="compte-main__head">
              <p className="eyebrow">Espace client</p>
              <h1>{activeTabLabel}</h1>
            </div>

            {error && <p className="client-compte__error" role="alert">{error}</p>}

        {tab === 'reservations' && (
          <section className="client-compte__panel" id="cp-panel" role="tabpanel">
            {loading ? (
              <div className="client-compte__loading">
                <div className="auth-loading__spinner" />
                <p>Chargement de vos réservations…</p>
              </div>
            ) : reservations.length === 0 ? (
              <div className="client-compte__empty">
                <span className="client-compte__empty-icon"><Glyph>{glyphCalendar}</Glyph></span>
                <p className="client-compte__empty-title">Aucune réservation pour le moment</p>
                <p className="client-compte__empty-note">
                  Dès que vous réserverez un séjour, il apparaîtra ici avec son statut en temps réel.
                </p>
                <Link to={homePath} className="client-compte__btn client-compte__btn--primary">
                  Parcourir les appartements
                </Link>
              </div>
            ) : (
              <div className="client-compte__list">
                {reservations.map((r) => {
                  const canReview = !reviewsError && reviewable.some((x) => x.id === r.id);
                  const isReviewed = reviewedReservationIds.has(r.id);
                  const statutColor = statutColors[r.statut] || 'var(--ink-soft)';
                  return (
                    <article key={r.id} className="client-compte__card client-compte__card--res">
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
                          {r.montant ? (
                            <span className="client-compte__price">
                              {r.montant.toLocaleString('fr-FR')}
                              <span className="client-compte__price-unit">
                                FCFA / {r.duree_unite === 'mois' ? 'mois' : 'nuit'}
                              </span>
                            </span>
                          ) : null}
                        </div>

                        <div className="client-compte__card-actions">
                          {r.statut !== 'annulee' && (
                            <button
                              type="button"
                              className="client-compte__btn client-compte__btn--danger"
                              onClick={() => handleCancel(r.id)}
                              disabled={cancellingId === r.id}
                            >
                              {cancellingId === r.id ? 'Annulation…' : 'Annuler'}
                            </button>
                          )}
                          {canReview && (
                            <button
                              type="button"
                              className="client-compte__btn client-compte__btn--primary"
                              onClick={() => openReviewForm(r)}
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
                })}
              </div>
            )}

            {reviewsError && (
              <p className="client-compte__error" role="status">
                Impossible de charger vos avis : le bouton « Laisser un avis » est masqué
                pour éviter de publier deux fois le même séjour.
              </p>
            )}

            {!reviewsError && reviewable.length > 0 && !reviewForm && (
              <div className="client-compte__hint">
                <span className="client-compte__hint-icon"><Glyph>{glyphStar}</Glyph></span>
                <p>Vous avez {reviewable.length} séjour(s) confirmé(s) que vous pouvez noter.</p>
              </div>
            )}

            {reviewSuccess && tab === 'reservations' && (
              <p className="client-compte__success" role="status">{reviewSuccess}</p>
            )}

            {reviewForm && (
              <div className="review-form__overlay" role="dialog" aria-modal="true" aria-labelledby="review-form-title">
                <form className="review-form" onSubmit={handleReviewSubmit}>
                  <div className="review-form__head">
                    <div>
                      <p className="eyebrow">Nouvel avis</p>
                      <h2 id="review-form-title">{reviewForm.roomTitle}</h2>
                    </div>
                    <button
                      type="button"
                      className="review-form__close"
                      onClick={() => setReviewForm(null)}
                      aria-label="Fermer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="review-form__field">
                    <span className="review-form__label">Note de l'appartement</span>
                    <Stars
                      value={reviewForm.noteAppartement}
                      onChange={(v) => setReviewForm({ ...reviewForm, noteAppartement: v })}
                      label="Note de l'appartement"
                    />
                  </div>

                  <div className="review-form__field">
                    <span className="review-form__label">Note du gérant</span>
                    <Stars
                      value={reviewForm.noteGerant}
                      onChange={(v) => setReviewForm({ ...reviewForm, noteGerant: v })}
                      label="Note du gérant"
                    />
                  </div>

                  <div className="review-form__field">
                    <label className="review-form__label" htmlFor="review-comment">
                      Votre expérience
                    </label>
                    <textarea
                      id="review-comment"
                      rows={4}
                      maxLength={2000}
                      placeholder="Racontez votre séjour..."
                      value={reviewForm.commentaire}
                      onChange={(e) => setReviewForm({ ...reviewForm, commentaire: e.target.value })}
                    />
                  </div>

                  {reviewError && (
                    <p className="client-compte__error" role="alert">{reviewError}</p>
                  )}

                  <div className="review-form__actions">
                    <button
                      type="button"
                      className="client-compte__btn"
                      onClick={() => setReviewForm(null)}
                      disabled={reviewSubmitting}
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="client-compte__btn client-compte__btn--primary"
                      disabled={reviewSubmitting}
                    >
                      {reviewSubmitting ? 'Envoi...' : 'Publier mon avis'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {tab === 'profil' && (
          <section className="client-compte__panel" id="cp-panel" role="tabpanel">
            <div className="client-compte__profile">
              <div className="client-compte__profile-head">
                <span className="client-compte__profile-icon"><Glyph>{glyphUser}</Glyph></span>
                <div>
                  <p className="eyebrow">Informations personnelles</p>
                  <h2>Modifier mon profil</h2>
                  <p className="client-compte__profile-note">
                    Ces informations servent à vous contacter au sujet de vos réservations.
                  </p>
                </div>
              </div>

              <form className="client-compte__profile-form" onSubmit={handleProfileSubmit}>
                <div className="client-compte__fields">
                  <div className="client-compte__field">
                    <label htmlFor="cp-prenom">Prénom</label>
                    <input
                      id="cp-prenom"
                      type="text"
                      value={profileForm.prenom}
                      onChange={(e) => setProfileForm({ ...profileForm, prenom: e.target.value })}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="client-compte__field">
                    <label htmlFor="cp-nom">Nom</label>
                    <input
                      id="cp-nom"
                      type="text"
                      value={profileForm.nom}
                      onChange={(e) => setProfileForm({ ...profileForm, nom: e.target.value })}
                      autoComplete="family-name"
                    />
                  </div>
                  <div className="client-compte__field">
                    <label htmlFor="cp-tel">Téléphone</label>
                    <input
                      id="cp-tel"
                      type="tel"
                      value={profileForm.telephone}
                      onChange={(e) => setProfileForm({ ...profileForm, telephone: e.target.value })}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="client-compte__field">
                    <label htmlFor="cp-email">
                      Email
                      <span className="client-compte__field-hint">Géré par votre compte</span>
                    </label>
                    <input id="cp-email" type="email" value={email} disabled />
                  </div>
                </div>

                {profileError && <p className="client-compte__error" role="alert">{profileError}</p>}
                {profileSuccess && <p className="client-compte__success" role="status">{profileSuccess}</p>}

                <div className="client-compte__form-actions">
                  <button
                    type="submit"
                    className="client-compte__btn client-compte__btn--primary"
                    disabled={profileSaving}
                  >
                    {profileSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
          </div>
        </div>
      </div>
    </main>
  );
}
