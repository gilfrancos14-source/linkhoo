import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { useClientUnread } from '../hooks/useClientUnread';
import { setAuthTokenGetter, apiClients, apiReviews, type ClientMineReservationData, type ReviewData } from '../lib/api';
import { getMyReservations, cancelMyReservation } from '../lib/reservations';

import type { View, ReviewFormState } from './client-compte/types';
import ClientAccountLayout from '../components/ClientAccountLayout';
import OverviewPanel from './client-compte/OverviewPanel';
import ReservationsPanel from './client-compte/ReservationsPanel';
import ProfilePanel, { type ProfileFormState } from './client-compte/ProfilePanel';

const VIEW_TITLES: Record<View, string> = {
  overview: "Vue d'ensemble",
  stays: 'Mes séjours',
  profile: 'Mon profil',
};

function todayLabel(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ClientComptePage() {
  const homePath = useHomePath();
  const unreadMessages = useClientUnread();
  const { user } = useUser();
  const { getToken, isLoaded } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: View = viewParam === 'stays' || viewParam === 'profile' ? viewParam : 'overview';
  const setView = (next: View) => {
    setSearchParams(next === 'overview' ? {} : { view: next });
  };

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

  const handleChangeReview = (patch: Partial<ReviewFormState>) => {
    setReviewForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleProfileChange = (patch: Partial<ProfileFormState>) => {
    setProfileForm((prev) => ({ ...prev, ...patch }));
  };

  return (
    <ClientAccountLayout active={view} staysCount={reservations.length}>
      <div className="admin-content">
        <section className="cdash__content">
          <header className="cdash-top">
            <div className="cdash-top__lead">
              <p className="cdash-top__eyebrow">Espace client</p>
              <h1 className="cdash-top__title">{VIEW_TITLES[view]}</h1>
            </div>
          </header>

          {error && <p className="client-compte__error" role="alert">{error}</p>}

          <div className="cdash__views" id="cdash-panel" role="tabpanel">
            {view === 'overview' && (
              <OverviewPanel
                displayName={displayName}
                todayLabel={todayLabel()}
                reservations={reservations}
                reviewableCount={reviewsError ? 0 : reviewable.length}
                unreadMessages={unreadMessages}
                homePath={homePath}
                onGoToStays={() => setView('stays')}
                onGoToProfile={() => setView('profile')}
              />
            )}

            {view === 'stays' && (
              <ReservationsPanel
                homePath={homePath}
                loading={loading}
                reservations={reservations}
                reviewsError={reviewsError}
                reviewable={reviewable}
                reviewedIds={reviewedReservationIds}
                reviewSuccess={reviewSuccess}
                reviewForm={reviewForm}
                reviewError={reviewError}
                reviewSubmitting={reviewSubmitting}
                cancellingId={cancellingId}
                onCancel={handleCancel}
                onOpenReviewForm={openReviewForm}
                onChangeReview={handleChangeReview}
                onCloseReview={() => setReviewForm(null)}
                onSubmitReview={handleReviewSubmit}
              />
            )}

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
