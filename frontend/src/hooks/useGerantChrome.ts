import { useEffect, useState } from 'react';
import { apiGerants, apiMessages, type GerantData } from '../lib/api';
import { getReservations } from '../lib/reservations';

export interface GerantChrome {
  gerant: GerantData | null;
  displayName: string;
  initials: string;
  reservationsCount: number;
  messagesUnread: number;
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

  useEffect(() => {
    let alive = true;

    apiGerants
      .getMe()
      .then((data) => {
        if (alive) setGerant(data);
      })
      .catch(() => {});

    getReservations()
      .then((items) => {
        if (!alive) return;
        setReservationsCount(items.filter((item) => item.statut === 'en_attente').length);
      })
      .catch(() => {});

    apiMessages
      .gerantUnread()
      .then((data) => {
        if (alive) setMessagesUnread(data.count);
      })
      .catch(() => {});

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
  };
}
