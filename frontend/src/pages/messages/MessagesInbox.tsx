import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiMessages, type Conversation } from '../../lib/api';

const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} j`;
}

interface MessagesInboxProps {
  side: 'client' | 'gerant';
  /** Préfixe des liens de fil, ex. /ci/messages ou /ci/gerant/messages. */
  basePath: string;
}

/**
 * Boîte de réception des conversations : lignes triées par le serveur (RPC),
 * pollées toutes les 30 s, badge de non-lus par conversation. La page ne défile
 * pas, seule la liste des conversations est défilable.
 */
export default function MessagesInbox({ side, basePath }: MessagesInboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const page =
      side === 'client' ? await apiMessages.inbox() : await apiMessages.gerantInbox();
    setConversations(page.items);
  }, [side]);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch(() => {
        if (!cancelled) setError('Impossible de charger vos conversations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      load().catch(() => {});
    };
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <main className="messages-page">
      <div className="container">
        <h1 className="messages-page__title">Messages</h1>

        {loading && <p className="messages-page__empty">Chargement...</p>}

        {error && (
          <p className="messages-page__empty" role="alert">{error}</p>
        )}

        {!loading && !error && conversations.length === 0 && (
          <p className="messages-page__empty">
            {side === 'client'
              ? 'Aucune conversation pour le moment. Ouvrez-en une depuis la fiche d\'une chambre qui vous intéresse.'
              : 'Aucune conversation pour le moment. Les clients intéressés par vos chambres vous écriront ici.'}
          </p>
        )}

        {!loading && !error && conversations.length > 0 && (
          <ul className="conv-list">
            {conversations.map((c) => {
              const last = c.last_message;
              const mine = last?.sender_role === side;
              return (
                <li key={c.id}>
                  <Link to={`${basePath}/${c.id}`} className="conv-row">
                    <span className="conv-row__thumb" aria-hidden="true">
                      {c.room?.img ? <img src={c.room.img} alt="" /> : '🏠'}
                    </span>
                    <span className="conv-row__body">
                      <span className="conv-row__top">
                        <span className="conv-row__name">
                          {side === 'gerant' ? c.client_name : c.room?.title || 'Chambre'}
                        </span>
                        <span className="conv-row__time">
                          {timeAgo(c.last_message_at || c.created_at)}
                        </span>
                      </span>
                      <span className="conv-row__bottom">
                        <span className="conv-row__preview">
                          {side === 'gerant' && (
                            <span className="conv-row__room">{c.room?.title} · </span>
                          )}
                          {last ? `${mine ? 'Vous : ' : ''}${last.body}` : 'Aucun message'}
                        </span>
                        {(c.unread_count ?? 0) > 0 && (
                          <span className="conv-row__unread" aria-label={`${c.unread_count} non lus`}>
                            {c.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
