import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { marketSlugFromPath } from '../../contexts/MarketContext';
import { toRoomDataPayload, type Room } from '../../data/rooms';
import { apiAdmin, type AdminRoomGerant } from '../../lib/adminApi';
import ChambreFormMaq3 from '../gerant/ChambreFormMaq3';

/**
 * Création d'un appartement par l'administration (ou un membre de l'équipe
 * disposant de la permission « chambres »). La chambre est rattachée au gérant
 * choisi ; l'upload et la sauvegarde passent par le cookie admin.
 */
export default function AdminAjouterChambrePage() {
  const { pathname } = useLocation();
  const slug = marketSlugFromPath(pathname);
  const adminPath = slug ? `/${slug}/admin` : '/admin';

  const [gerants, setGerants] = useState<AdminRoomGerant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    apiAdmin
      .listRoomGerants()
      .then((items) => {
        if (!alive) return;
        setGerants(items);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError('Impossible de charger les gérants.');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selected = gerants.find((gerant) => gerant.id === selectedId) ?? null;

  const gerantField = (
    <div>
      <label htmlFor="admin-room-gerant" className="lbl">
        Gérant propriétaire <span className="text-red-500">*</span>
      </label>
      <div className="field">
        <select
          id="admin-room-gerant"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">Choisir un gérant</option>
          {gerants.map((gerant) => (
            <option key={gerant.id} value={gerant.id}>
              {[gerant.prenom, gerant.nom].filter(Boolean).join(' ') || gerant.email} —{' '}
              {gerant.market}
            </option>
          ))}
        </select>
      </div>
      {loading && <p className="hint">Chargement des gérants…</p>}
      {error && <p className="err">{error}</p>}
      <p className="hint">La chambre sera publiée au nom de ce gérant.</p>
    </div>
  );

  const saveRoom = async (payload: Omit<Room, 'id'>) => {
    if (!selected) throw new Error('Choisissez un gérant propriétaire.');
    await apiAdmin.createRoom({ ...toRoomDataPayload(payload), gerantId: selected.id });
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Ajouter un appartement</h1>
          <p>Publier une chambre au nom d'un gérant, comme depuis son espace.</p>
        </div>
        <Link to={adminPath} className="admin-btn">
          Retour à l'administration
        </Link>
      </div>

      <div className="card p-5">
        <ChambreFormMaq3
          marketOverride={selected?.market}
          extraFields={gerantField}
          uploadFile={(file) => apiAdmin.uploadFile(file)}
          saveRoom={saveRoom}
        />
      </div>
    </div>
  );
}
