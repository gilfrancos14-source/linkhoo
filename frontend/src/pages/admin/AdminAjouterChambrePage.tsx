import { Link, useLocation } from 'react-router-dom';
import { marketSlugFromPath } from '../../contexts/MarketContext';
import { toRoomDataPayload, type Room } from '../../data/rooms';
import { apiAdmin } from '../../lib/adminApi';
import ChambreFormMaq3 from '../gerant/ChambreFormMaq3';
import '../../styles/48-admin-room-form.css';

/**
 * Création d'un appartement par l'administration (ou un membre de l'équipe
 * disposant de la permission « chambres »).
 *
 * Aucun gérant à sélectionner : le backend rattache la chambre au compte
 * admin connecté et la marque comme vérifiée/fiable d'office.
 */
export default function AdminAjouterChambrePage() {
  const { pathname } = useLocation();
  const slug = marketSlugFromPath(pathname);
  const adminPath = slug ? `/${slug}/admin` : '/admin';

  const saveRoom = async (payload: Omit<Room, 'id'>) => {
    await apiAdmin.createRoom(toRoomDataPayload(payload));
  };

  return (
    <div className="dash admin-room-form">
      <div className="dash-page-head">
        <div>
          <h1>Ajouter un appartement</h1>
          <p>
            Publié au nom de l'administration : la chambre est vérifiée et fiable d'office.
          </p>
        </div>
        <Link to={adminPath} className="admin-btn">
          Retour à l'administration
        </Link>
      </div>

      <div className="card p-5">
        <ChambreFormMaq3
          uploadFile={(file) => apiAdmin.uploadFile(file)}
          saveRoom={saveRoom}
        />
      </div>
    </div>
  );
}
