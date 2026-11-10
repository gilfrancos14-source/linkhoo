import { useEffect, useState } from 'react';
import { apiGerants, apiMessages, type GerantData } from '../lib/api';
import { getReservations } from '../lib/reservations';

export interface GerantChrome {
  gerant: GerantData | null;
  displayName: string;
  initials: string;
  reservationsCount: number;
  messagesUnread: number;
  isLoading: boolean;
  error: string | null;
}

function initialsFrom(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase();
  return 'G';
}

export function displayNameOf(gerant: GerantData | null): string {
  if (!gerant) return 'Gérant';
  return `${gerant.prenom ?? ''} ${gerant.nom ?? ''}`.trim() || 'Gérant';
}

export function initialsOf(gerant: GerantData | null): string {
  if (!gerant) return 'G';
  return initialsFrom(gerant.prenom ?? '', gerant.nom ?? '');
}

/**
 * Identité et compteurs de la barre latérale du gérant.
 * Chaque page maquette embarque sa propre sidebar : ce hook évite de
 * dupliquer les appels profil / réservations / messages non lus.
 */
export function useGerantChrome(): GerantChrome {
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [reservationsCount, setReservationsCount] = useState(0);
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError(null);

    // Fonction pour exécuter toutes les requêtes en parallèle
    const fetchAllData = async () => {
      try {
        const [gerantData, reservationsData, messagesData] = await Promise.allSettled([
          apiGerants.getMe(),
          getReservations(),
          apiMessages.gerantUnread(),
        ]);

        if (!alive) return;

        // Gérer les données du gérant
        if (gerantData.status === 'fulfilled') {
          setGerant(gerantData.value);
        } else {
          console.error('Erreur lors du chargement des données du gérant:', gerantData.reason);
        }

        // Gérer les réservations
        if (reservationsData.status === 'fulfilled') {
          setReservationsCount(
            reservationsData.value.filter((item: any) => item.statut === 'en_attente').length
          );
        } else {
          console.error('Erreur lors du chargement des réservations:', reservationsData.reason);
        }

        // Gérer les messages
        if (messagesData.status === 'fulfilled') {
          setMessagesUnread((messagesData.value as any).count);
        } else {
          console.error('Erreur lors du chargement des messages:', messagesData.reason);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err);
        setError('Une erreur est survenue lors du chargement des données');
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      alive = false;
    };
  }, []);

  return {
    gerant,
    displayName: displayNameOf(gerant),
    initials: initialsOf(gerant),
    reservationsCount,
    messagesUnread,
    isLoading,
    error,
  };
}
