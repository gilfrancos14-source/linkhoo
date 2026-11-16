import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { fetchMyRooms, type Room } from '../../data/rooms';
import {
  emptyForm,
  formFromRoom,
  photosFromRoom,
  type PreviewSnapshot,
} from './ajouter-chambre/form';
import ChambreFormPage from './ChambreFormPage';
import ChambreFormMaq3 from './ChambreFormMaq3';

function emptyPreview(): PreviewSnapshot {
  return {
    form: { ...emptyForm },
    photos: [],
    mainPhotoIndex: 0,
    categoryTitle: '',
  };
}

/**
 * Modification d'une annonce existante.
 *
 * La chambre est relue depuis `GET /api/rooms/mine` (et non depuis la fiche
 * publique) : un gérant ne peut donc ouvrir que ses propres annonces. Le
 * formulaire est celui de l'ajout, prérempli, et le PUT `/api/rooms/:id`
 * revérifie la propriété côté serveur.
 */
export default function ModifierChambreMaq3() {
  const { id = '' } = useParams<{ id: string }>();
  const homePath = useHomePath();
  const chambresPath = `${homePath}/gerant/chambres`;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewSnapshot>(emptyPreview);

  const handlePreviewChange = useCallback(
    (snapshot: PreviewSnapshot) => setPreview(snapshot),
    [],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setRoom(null);
    setPreview(emptyPreview());

    fetchMyRooms()
      .then((items) => {
        if (!alive) return;
        const found = items.find((item) => item.id === id);
        if (!found) {
          setError('Chambre introuvable ou ne vous appartient pas.');
          return;
        }
        setRoom(found);
        setPreview({
          form: formFromRoom(found),
          photos: photosFromRoom(found),
          mainPhotoIndex: 0,
          categoryTitle: '',
        });
      })
      .catch(() => {
        if (alive) setError('Impossible de charger cette chambre. Veuillez réessayer.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <ChambreFormPage
      heading="Modifier la chambre"
      intro="Mettez à jour les informations de votre annonce."
      backPath={chambresPath}
      preview={preview}
    >
      {loading && (
        <div className="card p-8 text-center text-sm text-slate-500" role="status">
          Chargement de la chambre…
        </div>
      )}

      {!loading && (error || !room) && (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-600" role="alert">
            {error || 'Chambre introuvable.'}
          </p>
          <Link
            to={chambresPath}
            className="mt-5 inline-flex items-center gap-3 rounded-lg bg-dash-brand px-6 py-3 text-sm font-semibold text-white hover:bg-dash-brand-dark"
          >
            Retour à mes chambres
          </Link>
        </div>
      )}

      {!loading && room && (
        <ChambreFormMaq3
          key={room.id}
          room={room}
          onPreviewChange={handlePreviewChange}
        />
      )}
    </ChambreFormPage>
  );
}
