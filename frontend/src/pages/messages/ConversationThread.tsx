import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiMessages, type Conversation, type Message } from '../../lib/api';

const POLL_MS = 12_000;
const PAGE_SIZE = 50;

function messageTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${hm}`;
}

interface ConversationThreadProps {
  conversationId: string;
  role: 'client' | 'gerant';
  /** Lien de retour vers la boîte de réception. */
  basePath: string;
}

/**
 * Fil de discussion d'une conversation : messages paginés (page 1 = plus
 * récents), rechargement toutes les 12 s tant que l'onglet est visible,
 * marquage des messages reçus non lus, envoi via le composer.
 */
export default function ConversationThread({
  conversationId,
  role,
  basePath,
}: ConversationThreadProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [latest, setLatest] = useState<Message[]>([]);
  const [older, setOlder] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fusion page 1 + pages anciennes, dédupliquée par id (le poll remplace
  // la page 1 ; une page ancienne peut contenir des messages qui y figurent
  // encore — la version la plus récente gagne, construite en dernier).
  const ordered = [...older, ...latest];
  const messagesById = new Map<string, Message>();
  for (const m of ordered) messagesById.set(m.id, m);
  const messages = [...messagesById.values()].sort((a, b) =>
    a.created_at === b.created_at
      ? a.id.localeCompare(b.id)
      : a.created_at.localeCompare(b.created_at),
  );

  const loadLatest = useCallback(async () => {
    const [conv, msgs] = await Promise.all([
      apiMessages.getConversation(conversationId),
      apiMessages.listMessages(conversationId, 1),
    ]);
    setConversation(conv);
    setLatest(msgs);
    setHasOlder(msgs.length >= PAGE_SIZE);

    const hasUnread = msgs.some((m) => m.sender_role !== role && !m.read_at);
    if (hasUnread) {
      await apiMessages.markRead(conversationId).catch(() => {});
      const refreshed = await apiMessages.listMessages(conversationId, 1).catch(() => null);
      if (refreshed) setLatest(refreshed);
    }
  }, [conversationId, role]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setOlder([]);
    setPage(1);
    loadLatest()
      .catch(() => {
        if (!cancelled) setError('Conversation introuvable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadLatest]);

  // Polling : uniquement tant que l'onglet est visible (un onglet en
  // arrière-plan ne doit ni consommer de quota ni écrire de read_at).
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadLatest().catch(() => {});
    };
    const interval = setInterval(tick, POLL_MS);
    return () => clearInterval(interval);
  }, [loadLatest]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const loadOlder = async () => {
    const nextPage = page + 1;
    setLoadingOlder(true);
    try {
      const msgs = await apiMessages.listMessages(conversationId, nextPage);
      setOlder((prev) => [...msgs, ...prev]);
      setPage(nextPage);
      setHasOlder(msgs.length >= PAGE_SIZE);
    } catch {
      // silencieux : le bouton reste utilisable
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await apiMessages.sendMessage(conversationId, body);
      setLatest((prev) => [sent, ...prev]);
      setDraft('');
    } catch {
      setError('Envoi impossible, veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="messages-page">
        <div className="container">
          <p className="messages-page__empty">Chargement...</p>
        </div>
      </main>
    );
  }

  if (error && !conversation) {
    return (
      <main className="messages-page">
        <div className="container">
          <Link to={basePath} className="messages-page__back">← Messages</Link>
          <p className="messages-page__empty">{error}</p>
        </div>
      </main>
    );
  }

  const counterpart =
    role === 'gerant'
      ? conversation?.client_name || 'Client'
      : conversation?.room?.title
        ? `« ${conversation.room.title} »`
        : 'le gérant';

  return (
    <main className="messages-page messages-page--thread">
      <div className="container messages-thread">
        <header className="messages-thread__head">
          <Link to={basePath} className="messages-thread__back" aria-label="Retour aux messages">
            ←
          </Link>
          <div className="messages-thread__titles">
            <h1 className="messages-thread__title">
              {role === 'gerant' ? counterpart : 'Discussion avec le gérant'}
            </h1>
            <p className="messages-thread__subtitle">
              {role === 'gerant'
                ? conversation?.room?.title || 'Chambre'
                : counterpart}
            </p>
          </div>
        </header>

        <div className="messages-thread__scroll" ref={scrollRef}>
          {hasOlder && (
            <button
              type="button"
              className="messages-thread__older"
              onClick={loadOlder}
              disabled={loadingOlder}
            >
              {loadingOlder ? 'Chargement...' : 'Charger les messages plus anciens'}
            </button>
          )}
          {messages.length === 0 && (
            <p className="messages-thread__empty">
              Écrivez le premier message à votre interlocuteur.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`msg-bubble${m.sender_role === role ? ' msg-bubble--mine' : ''}`}
            >
              <p className="msg-bubble__body">{m.body}</p>
              <span className="msg-bubble__time">
                {messageTime(m.created_at)}
                {m.sender_role === role && m.read_at ? ' · Lu' : ''}
              </span>
            </div>
          ))}
        </div>

        {error && <p className="messages-thread__error" role="alert">{error}</p>}

        <form className="messages-thread__composer" onSubmit={handleSend}>
          <textarea
            className="messages-thread__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Écrire un message..."
            rows={1}
            maxLength={2000}
            aria-label="Votre message"
          />
          <button
            type="submit"
            className="messages-thread__send"
            disabled={sending || !draft.trim()}
          >
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </form>
      </div>
    </main>
  );
}
