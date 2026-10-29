import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiFavorites, setAuthTokenGetter, type FavoriteRoomData } from '../lib/api';

interface FavoritesContextValue {
  /** Identifiants des chambres favorites (test rapide du cœur). */
  ids: ReadonlySet<string>;
  /** Chambres favorites complètes (cart espace client). */
  rooms: FavoriteRoomData[];
  loading: boolean;
  signedIn: boolean;
  isFavorite: (roomId: string) => boolean;
  /** Ajoute/retire un favori. Renvoie le nouvel état. */
  toggle: (roomId: string) => Promise<boolean>;
  remove: (roomId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

/**
 * Valeur par défaut : les composants de carte utilisent les favoris sans
 * dépendre d'un provider (tests unitaires isolés). En dehors de l'application,
 * le cœur reste simplement inactif.
 */
const FavoritesContext = createContext<FavoritesContextValue>({
  ids: EMPTY_IDS,
  rooms: [],
  loading: false,
  signedIn: false,
  isFavorite: () => false,
  toggle: async () => false,
  remove: async () => {},
  refresh: async () => {},
});

/**
 * Source unique de vérité des favoris du client connecté.
 *
 * Les favoris sont chargés une fois par session puis partagés entre toutes
 * les cartes (recherche, accueil, fiche chambre, espace client). Un clic sur
 * le cœur met l'état à jour immédiatement (optimiste) puis confirme auprès de
 * l'API ; en cas d'échec, l'état précédent est restauré.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [rooms, setRooms] = useState<FavoriteRoomData[]>([]);
  const [ids, setIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [loading, setLoading] = useState(false);

  const signedIn = Boolean(isLoaded && isSignedIn);
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setRooms([]);
      setIds(EMPTY_IDS);
      return;
    }

    setLoading(true);
    try {
      setAuthTokenGetter(() => getTokenRef.current());
      const loaded = await apiFavorites.list();
      setRooms(loaded);
      setIds(new Set(loaded.map((room) => room.id)));
    } catch {
      // 403 (gérant sur une page publique) ou incident réseau : on conserve
      // l'état courant sans casser la navigation.
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setRooms([]);
      setIds(EMPTY_IDS);
      return;
    }
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const toggle = useCallback(
    async (roomId: string) => {
      if (!signedInRef.current) throw new Error('AUTH_REQUIRED');

      const wasFavorite = ids.has(roomId);
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(roomId);
        else next.add(roomId);
        return next;
      });

      try {
        if (wasFavorite) {
          await apiFavorites.remove(roomId);
          setRooms((prev) => prev.filter((room) => room.id !== roomId));
        } else {
          const result = await apiFavorites.add(roomId);
          if (result.room) {
            setRooms((prev) => [result.room, ...prev.filter((room) => room.id !== roomId)]);
          }
        }
        return !wasFavorite;
      } catch (error) {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(roomId);
          else next.delete(roomId);
          return next;
        });
        throw error;
      }
    },
    [ids],
  );

  const remove = useCallback(
    async (roomId: string) => {
      if (!signedInRef.current) throw new Error('AUTH_REQUIRED');
      setIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      try {
        await apiFavorites.remove(roomId);
      } catch (error) {
        await refresh();
        throw error;
      }
    },
    [refresh],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      rooms,
      loading,
      signedIn,
      isFavorite: (roomId: string) => ids.has(roomId),
      toggle,
      remove,
      refresh,
    }),
    [ids, rooms, loading, signedIn, toggle, remove, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  return useContext(FavoritesContext);
}
