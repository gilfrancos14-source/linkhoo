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

    // Chaque source met à jour son état dès qu'elle répond : un appel lent
    // (réservations, messages non lus…) ne doit pas retarder l'affichage du
    // nom, des initiales ou des compteurs déjà disponibles.
    const gerantTask = apiGerants
      .getMe()
      .then((data) => {
        if (alive) setGerant(data);
      })
      .catch((reason: unknown) => {
        console.error('Erreur lors du chargement des données du gérant:', reason);
      });

    const reservationsTask = getReservations()
      .then((items) => {
        if (alive) {
          setReservationsCount(items.filter((item) => item.statut === 'en_attente').length);
        }
      })
      .catch((reason: unknown) => {
        console.error('Erreur lors du chargement des réservations:', reason);
      });

    const messagesTask = apiMessages
      .gerantUnread()
      .then(({ count }) => {
        if (alive) setMessagesUnread(count);
      })
      .catch((reason: unknown) => {
        console.error('Erreur lors du chargement des messages:', reason);
      });

    Promise.allSettled([gerantTask, reservationsTask, messagesTask]).finally(() => {
      if (alive) setIsLoading(false);
    });

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
