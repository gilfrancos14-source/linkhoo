import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../hooks/useHomePath';
import { setAuthTokenGetter, apiReviews, type ClientMineReservationData } from '../lib/api';
import { getMyReservations } from '../lib/reservations';

const STAR_LABELS = ['Très mauvais', 'Mauvais', 'Moyen', 'Bien', 'Excellent'];

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#1d3f8f] mb-2">{label}</p>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} sur 5 — ${STAR_LABELS[n - 1]}`}
            className="text-2xl leading-none"
            style={{ color: n <= value ? '#ff5a14' : '#cbd5e1' }}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-[12px] text-[#5f86d1]">{STAR_LABELS[value - 1]}</span>
      </div>
    </div>
  );
}

export default function LaisserAvisPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const homePath = useHomePath();
  const { getToken, isLoaded } = useAuth();

  const [reservation, setReservation] = useState<ClientMineReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteAppartement, setNoteAppartement] = useState(5);
  const [noteGerant, setNoteGerant] = useState(5);
  const [commentaire, setCommentaire] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !reservationId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getMyReservations()
      .then((res) => {
        if (cancelled) return;
        const found = res.find((r) => r.id === reservationId);
        if (!found) {
          setError('Réservation introuvable.');
          return;
        }
        setReservation(found);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la réservation.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, reservationId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reservation || sending) return;
    setSending(true);
    setError('');
    try {
      await apiReviews.create({
        reservation_id: reservation.id,
        note_appartement: noteAppartement,
        note_gerant: noteGerant,
        commentaire: commentaire.trim() || undefined,
      });
      setSuccess(true);
      window.setTimeout(() => navigate(`${homePath}/compte?view=stays`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de publier l’avis.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faff] font-sans text-[#0b1b3f] antialiased">
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-sm text-[#5f86d1]">Chargement…</p>
        </main>
      </div>
    );
  }

  if (error && !reservation) {
    return (
      <div className="min-h-screen bg-[#f8faff] font-sans text-[#0b1b3f] antialiased">
        <main className="mx-auto max-w-2xl px-4 py-10">
          <p className="text-sm text-red-600" role="alert">{error}</p>
          <button
            type="button"
            onClick={() => navigate(`${homePath}/compte?view=stays`)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1a6cf0] px-4 py-2.5 text-sm font-bold text-white"
          >
            Retour à mes réservations
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faff] font-sans text-[#0b1b3f] antialiased">
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-[22px] font-extrabold text-[#1d3f8f]">Écrire un avis</h1>
        <p className="mt-1 text-[13px] text-[#5f86d1]">
          {reservation?.room_title || 'Votre séjour'}
        </p>

        {success && (
          <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700" role="status">
            Merci ! Votre avis a bien été publié.
          </div>
        )}

        {error && (
          <p className="mt-4 text-[12px] text-red-600" role="alert">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6 rounded-2xl border border-[#e6ebf5] bg-white p-6 shadow-sm">
          <StarRating value={noteAppartement} onChange={setNoteAppartement} label="Note de la chambre" />
          <StarRating value={noteGerant} onChange={setNoteGerant} label="Note du gérant" />

          <div>
            <p className="text-[12px] font-semibold text-[#1d3f8f] mb-2">Votre commentaire</p>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              maxLength={500}
              rows={5}
              placeholder="Partagez votre expérience : ce que vous avez aimé, ce qui pourrait être amélioré…"
              className="w-full resize-none rounded-xl border border-[#e6ebf5] p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6cf0]/40"
            />
            <span className="mt-1 block text-right text-[11px] text-[#5f86d1]">{commentaire.length}/500</span>
          </div>

          <div className="grid grid-cols-1 gap-2 text-[11px] text-[#5f86d1]">
            <p className="flex items-center gap-2 rounded-xl border border-[#e6ebf5] p-2.5">
              <span>✓</span>Votre avis est authentique
            </p>
            <p className="flex items-center gap-2 rounded-xl border border-[#e6ebf5] p-2.5">
              <span>✓</span>Il sera visible après validation
            </p>
          </div>

          <button
            type="submit"
            disabled={sending || success}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ff5a14] hover:bg-[#e6500f] transition text-white font-semibold py-3.5 disabled:opacity-60"
          >
            {sending ? 'Publication…' : 'Publier mon avis'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate(`${homePath}/compte?view=stays`)}
          className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-[#2f5bbf]"
        >
          ← Retour à mes réservations
        </button>
      </main>
    </div>
  );
}