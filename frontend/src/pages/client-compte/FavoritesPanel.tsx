import SearchStayCard from '../../components/SearchStayCard';
import { mapRoom, type Room } from '../../data/rooms';
import { roomMeta } from '../../lib/roomDisplay';
import type { FavoriteRoomData } from '../../lib/api';
import { useHomePath } from '../../hooks/useHomePath';

interface FavoritesPanelProps {
  favorites: FavoriteRoomData[];
  loading: boolean;
}

/**
 * Vue « Mes favoris » : la liste des chambres enregistrées via le cœur.
 * Une chambre mise en favori n'est pas forcément une réservation : les cartes
 * exposent directement le bouton de suppression des favoris.
 */
export default function FavoritesPanel({ favorites, loading }: FavoritesPanelProps) {
  const homePath = useHomePath();

  if (loading) {
    return <p className="py-8 text-center text-[11px] text-slate-500">Chargement des favoris…</p>;
  }

  if (favorites.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-[13px] font-semibold text-navy">Aucune chambre favorite</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Cliquez sur le cœur d&apos;une chambre pour la retrouver facilement dans vos prochains séjours.
        </p>
      </div>
    );
  }

  const rooms: Room[] = favorites.map((favorite) => mapRoom(favorite));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rooms.map((room) => (
        <SearchStayCard
          key={room.id}
          room={room}
          href={`${homePath}/chambre/${room.id}`}
          meta={roomMeta(room)}
        />
      ))}
    </div>
  );
}
