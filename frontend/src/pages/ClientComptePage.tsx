import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { useClientUnread } from '../hooks/useClientUnread';
import { useFavorites } from '../contexts/FavoritesContext';
import { setAuthTokenGetter, apiClients, apiReviews, type ClientMineReservationData, type ReservationPaymentStatus, type ReviewData } from '../lib/api';
import { getMyReservations, cancelMyReservation, startReservationPayment } from '../lib/reservations';
import { redirectTo } from '../lib/navigation';

import type { View, ReviewFormState } from './client-compte/types';
import ClientAccountLayout from '../components/ClientAccountLayout';
import ClientDashboardMaq from './client-compte/ClientDashboardMaq';
import ClientReservationsMaq from './client-compte/ClientReservationsMaq';
import ProfilePanel, { type ProfileFormState } from './client-compte/ProfilePanel';
import FavoritesPanel from './client-compte/FavoritesPanel';

export default function ClientComptePage() {
  const homePath = useHomePath();
  const unreadMessages = useClientUnread();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();

  const [searchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: View = viewParam === 'stays' || viewParam === 'favorites' || viewParam === 'profile' ? viewParam : 'overview';

  const [reservations, setReservations] = useState<ClientMineReservationData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewsError, setReviewsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const [reviewForm, setReviewForm] = useState<ReviewFormState | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const { rooms: favorites, loading: favoritesLoading } = useFavorites();

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

  const handleCancel = async (id: string) => {
    if (!window.confirm('Annuler cette réservation ?')) return;
    setCancellingId(id);
    setError('');
    try {
      const result = await cancelMyReservation(id);
      // Le backend rembourse automatiquement une réservation payée : on
      // reflète l'état renvoyé sans attendre un rechargement de la page.
      const refundStatus = result?.refund?.status;
      const nextPaymentStatus: ReservationPaymentStatus | undefined =
        refundStatus === 'succeeded'
          ? 'refunded'
          : refundStatus === 'requested' ||
              refundStatus === 'processing' ||
              refundStatus === 'manual_required'
            ? 'refund_pending'
            : refundStatus === 'failed' || refundStatus === 'canceled'
              ? 'paid'
              : undefined;

      setReservations((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                statut: 'annulee' as const,
                ...(nextPaymentStatus ? { payment_status: nextPaymentStatus } : {}),
              }
            : r,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'annuler la réservation.');
    } finally {
      setCancellingId(null);
    }
  };

  const handlePay = async (reservation: ClientMineReservationData) => {
    setPayingId(reservation.id);
    setError('');
    try {
      const start = await startReservationPayment(reservation.id);
      if (start.state === 'paid') {
        setReservations((prev) =>
          prev.map((r) =>
            r.id === reservation.id ? { ...r, payment_status: 'paid' as const } : r,
          ),
        );
        return;
      }
      // Sortie vers le checkout hébergé : aucun montant ne transite par le front.
      redirectTo(start.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paiement indisponible pour le moment.');
    } finally {
      setPayingId(null);
    }
  };

  const openReviewForm = (reservation: ClientMineReservationData) => {    setReviewError('');
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

  const handleChangeReview = (patch: Partial<ReviewFormState>) => {
    setReviewForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleProfileChange = (patch: Partial<ProfileFormState>) => {
    setProfileForm((prev) => ({ ...prev, ...patch }));
  };

  // La vue d'ensemble reprend intégralement la maquette du tableau de bord
  // (sidebar, topbar et colonnes incluses) : elle porte donc son propre chrome.
  if (view === 'overview') {
    return (
      <ClientDashboardMaq
        displayName={firstName || profileForm.prenom || 'Client'}
        email={email}
        profileFirstName={profileForm.prenom}
        profileLastName={profileForm.nom}
        phone={profileForm.telephone}
        avatarUrl={user?.imageUrl}
        reservations={reservations}
        favorites={favorites}
        reviews={reviews}
        unreadMessages={unreadMessages}
        loading={loading}
        error={error}
        homePath={homePath}
      />
    );
  }

  // Idem pour « Mes réservations » : conversion de la maquette
  // habici-mes-reservations.html avec son propre chrome et ses filtres.
  if (view === 'stays') {
    return (
      <ClientReservationsMaq
        displayName={firstName || profileForm.prenom || 'Client'}
        profileFirstName={profileForm.prenom}
        profileLastName={profileForm.nom}
        avatarUrl={user?.imageUrl}
        unreadMessages={unreadMessages}
        reservations={reservations}
        reviews={reviews}
        loading={loading}
        error={error}
        homePath={homePath}
        reviewsError={reviewsError}
        reviewable={reviewable}
        reviewedIds={reviewedReservationIds}
        reviewSuccess={reviewSuccess}
        reviewForm={reviewForm}
        reviewError={reviewError}
        reviewSubmitting={reviewSubmitting}
        cancellingId={cancellingId}
        payingId={payingId}
        onCancel={handleCancel}
        onOpenReviewForm={openReviewForm}
        onChangeReview={handleChangeReview}
        onCloseReview={() => setReviewForm(null)}
        onSubmitReview={handleReviewSubmit}
        onPay={handlePay}
      />
    );
  }

  // Vue « Mes favoris » : la liste des chambres marquées par le cœur du client.
  if (view === 'favorites') {
    return (
      <ClientAccountLayout active="favorites" staysCount={favorites.length}>
        <div className="admin-content">
          <section className="cdash__content">
            <header className="cdash-top">
              <div className="cdash-top__lead">
                <p className="cdash-top__eyebrow">Espace client</p>
                <h1 className="cdash-top__title">Mes favoris</h1>
              </div>
            </header>
            <FavoritesPanel favorites={favorites} loading={favoritesLoading} />
          </section>
        </div>
      </ClientAccountLayout>
    );
  }

  // Vue par défaut du compte client : le profil (les autres vues sont
  // interceptées plus haut — overview, stays, favorites).
  return (
    <ClientAccountLayout active="profile" staysCount={reservations.length}>
      <div className="admin-content">
        <section className="cdash__content">
          <header className="cdash-top">
            <div className="cdash-top__lead">
              <p className="cdash-top__eyebrow">Espace client</p>
              <h1 className="cdash-top__title">Mon profil</h1>
            </div>
          </header>

          {error && <p className="client-compte__error" role="alert">{error}</p>}

          <div className="cdash__views" id="cdash-panel" role="tabpanel">
            {view === 'profile' && (
              <ProfilePanel
                profileForm={profileForm}
                email={email}
                saving={profileSaving}
                error={profileError}
                success={profileSuccess}
                onChange={handleProfileChange}
                onSubmit={handleProfileSubmit}
              />
            )}
          </div>
        </section>
      </div>
    </ClientAccountLayout>
  );
}
