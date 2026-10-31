import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { isMarketCode, marketByCode } from '../../config/markets';
import { apiMessages, apiReviews, apiRooms, type Conversation, type Message, type RoomData } from '../../lib/api';
import { formatPrice } from '../../lib/roomDisplay';

/**
 * Espace client — « Mes messages ».
 * Conversion de docs/maquettes/habici-mes-messages.html : le balisage et les
 * classes reprennent la maquette à l'identique (sidebar et topbar incluses) ;
 * la liste et le fil sont branchés sur l'API de messagerie.
 */

const INBOX_POLL_MS = 30_000;
const THREAD_POLL_MS = 12_000;
const PAGE_SIZE = 50;

function Icon({ id, className = '' }: { id: string; className?: string }) {
  return (
    <svg className={`ic ${className}`.trim()} aria-hidden="true">
      <use href={`#cm-${id}`} />
    </svg>
  );
}

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

function messageTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  const hm = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${hm}`;
}

/** Séparateur de journée affiché au-dessus du premier message du jour. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (same(date, today)) return 'Aujourd’hui';
  if (same(date, yesterday)) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'C';
}

/** Libellé d'un code marché, ou null si le code serveur est inconnu. */
function marketLabelOf(code: string | null | undefined): string | null {
  if (!isMarketCode(code)) return null;
  return marketByCode(code).label;
}

type BoxTab = 'tous' | 'nonlus' | 'proprietaires' | 'habici';

export interface ClientMessagesMaqProps {
  /** Préfixe des liens de fil, ex. /ci/messages. */
  basePath: string;
  /** Id de la conversation ouverte (route /messages/:conversationId). */
  conversationId?: string;
  homePath: string;
  displayName: string;
  profileFirstName: string;
  profileLastName: string;
  avatarUrl?: string | null;
  /** Nombre total de messages non lus (badge sidebar / topbar). */
  unreadMessages: number;
}

export default function ClientMessagesMaq({
  basePath,
  conversationId,
  homePath,
  displayName,
  profileFirstName,
  profileLastName,
  avatarUrl,
  unreadMessages,
}: ClientMessagesMaqProps) {
  const navigate = useNavigate();
  const { signOut } = useClerk();

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<BoxTab>('tous');
  const [conversationQuery, setConversationQuery] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');

  // ── Boîte de réception ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  // ── Fil de discussion ──
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [latest, setLatest] = useState<Message[]>([]);
  const [older, setOlder] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Fiche de la chambre affichée à droite (prix, note) : la conversation ne
  // transporte que l'id, le titre et la photo — on complète via l'API.
  const [roomDetails, setRoomDetails] = useState<RoomData | null>(null);
  const [roomRating, setRoomRating] = useState<{ avg: number | null; count: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const lastRenderedIdRef = useRef<string | null>(null);
  const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
  const scrollToBottomRef = useRef(true);
  // Champ de message : mis au point dès l'ouverture du fil (ex. clic
  // « Contacter l'hôte » depuis la fiche chambre → chat déjà ouvert et prêt
  // à être écrit).
  const messageInputRef = useRef<HTMLInputElement>(null);

  const profilePath = `${homePath}/compte?view=profile`;
  const staysPath = `${homePath}/compte?view=stays`;
  const messagesPath = `${homePath}/messages`;
  const searchPath = `${homePath}/recherche`;
  const favoritesPath = `${homePath}/compte?view=favorites`;

  const fullName = [profileFirstName, profileLastName].filter(Boolean).join(' ') || displayName || 'Client';

  const handleSignOut = async () => {
    await signOut();
    navigate(homePath);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `${searchPath}?q=${encodeURIComponent(trimmed)}` : searchPath);
  };

  /* ── Liste des conversations (poll 30 s) ── */
  const loadInbox = useCallback(async () => {
    const pageData = await apiMessages.inbox();
    setConversations(pageData.items);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadInbox()
      .catch(() => {
        if (!cancelled) setListError('Impossible de charger vos conversations.');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadInbox]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadInbox().catch(() => {});
    };
    const interval = setInterval(tick, INBOX_POLL_MS);
    return () => clearInterval(interval);
  }, [loadInbox]);

  /* ── Fil de discussion (poll 12 s) ── */
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId) ?? conversation,
    [conversations, conversationId, conversation],
  );

  // Fusion page 1 + pages anciennes, dédupliquée par id (le poll remplace la
  // page 1 ; une page ancienne peut contenir des messages qui y figurent
  // encore — la version la plus récente gagne, construite en dernier).
  const ordered = [...older, ...latest];
  const messagesById = new Map<string, Message>();
  for (const message of ordered) messagesById.set(message.id, message);
  const messages = [...messagesById.values()].sort((a, b) =>
    a.created_at === b.created_at
      ? a.id.localeCompare(b.id)
      : a.created_at.localeCompare(b.created_at),
  );
  const firstMessageId = messages[0]?.id ?? null;
  const newestMessageId = messages[messages.length - 1]?.id ?? null;

  const loadLatest = useCallback(async () => {
    if (!conversationId) return;
    const requestId = ++requestIdRef.current;
    const [conv, msgs] = await Promise.all([
      apiMessages.getConversation(conversationId),
      apiMessages.listMessages(conversationId, 1),
    ]);
    if (requestId !== requestIdRef.current) return;

    const newestId = msgs[0]?.id ?? null;
    if (newestId && newestId !== lastRenderedIdRef.current) {
      const el = scrollRef.current;
      const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      scrollToBottomRef.current = lastRenderedIdRef.current === null || nearBottom;
    }

    setConversation(conv);
    setLatest(msgs);
    setHasOlder(msgs.length >= PAGE_SIZE);

    const hasUnread = msgs.some((message) => message.sender_role !== 'client' && !message.read_at);
    if (hasUnread) {
      await apiMessages.markRead(conversationId).catch(() => {});
      if (requestId !== requestIdRef.current) return;
      const refreshed = await apiMessages.listMessages(conversationId, 1).catch(() => null);
      if (refreshed && requestId === requestIdRef.current) setLatest(refreshed);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setConversation(null);
      setLatest([]);
      setOlder([]);
      setThreadError('');
      setDraft('');
      return;
    }
    let cancelled = false;
    lastRenderedIdRef.current = null;
    preserveScrollRef.current = null;
    scrollToBottomRef.current = true;
    setThreadLoading(true);
    setThreadError('');
    setLatest([]);
    setOlder([]);
    setPage(1);
    loadLatest()
      .catch(() => {
        if (!cancelled) setThreadError('Conversation introuvable');
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadLatest, conversationId]);

  // Polling : uniquement tant que l'onglet est visible (un onglet en
  // arrière-plan ne doit ni consommer de quota ni écrire de read_at).
  useEffect(() => {
    if (!conversationId) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadLatest().catch(() => {});
    };
    const interval = setInterval(tick, THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [loadLatest, conversationId]);

  // Remonter dans le fil ne doit pas être annulé par un rechargement ni par
  // l'ajout de messages plus anciens : on restaure la position relative, et on
  // ne colle au bas que pour un nouveau message ou le premier chargement.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const keep = preserveScrollRef.current;
    if (keep) {
      preserveScrollRef.current = null;
      el.scrollTop = keep.top + (el.scrollHeight - keep.height);
    } else if (scrollToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      scrollToBottomRef.current = false;
    }
    lastRenderedIdRef.current = newestMessageId;
  }, [messages.length, firstMessageId, newestMessageId]);

  const loadOlder = async () => {
    if (!conversationId) return;
    const nextPage = page + 1;
    const el = scrollRef.current;
    const keep = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
    const known = new Set(messages.map((message) => message.id));
    setLoadingOlder(true);
    scrollToBottomRef.current = false;
    try {
      const msgs = await apiMessages.listMessages(conversationId, nextPage);
      if (keep && msgs.some((message) => !known.has(message.id))) {
        preserveScrollRef.current = keep;
      }
      setOlder((prev) => [...msgs, ...prev]);
      setPage(nextPage);
      setHasOlder(msgs.length >= PAGE_SIZE);
    } catch {
      // silencieux : le bouton reste utilisable
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!conversationId) return;
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setThreadError('');
    try {
      const sent = await apiMessages.sendMessage(conversationId, body);
      scrollToBottomRef.current = true;
      setLatest((prev) => [sent, ...prev.filter((message) => message.id !== sent.id)]);
      setDraft('');
    } catch {
      setThreadError('Envoi impossible, veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareFeedback('Lien copié dans le presse-papiers.');
    } catch {
      setShareFeedback('Impossible de copier le lien.');
    }
    window.setTimeout(() => setShareFeedback(''), 2500);
  };

  /* ── Dérivés pour l'affichage ── */
  const unreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0),
    [conversations],
  );

  const visibleConversations = useMemo(() => {
    const needle = conversationQuery.trim().toLowerCase();
    return conversations.filter((item) => {
      if (tab === 'nonlus' && (item.unread_count ?? 0) === 0) return false;
      if (tab === 'habici') return false;
      if (!needle) return true;
      const haystack = [item.room?.title ?? '', item.last_message?.body ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [conversations, tab, conversationQuery]);

  const activeRoom = activeConversation?.room ?? null;
  const activeRoomPath = activeRoom?.id ? `${homePath}/chambre/${activeRoom.id}` : searchPath;

  // Détails complémentaires de la chambre (prix, note) pour le panneau droit.
  useEffect(() => {
    const roomId = activeConversation?.room?.id;
    if (!roomId) {
      setRoomDetails(null);
      setRoomRating(null);
      return;
    }
    let cancelled = false;
    apiRooms
      .get(roomId)
      .then((room) => {
        if (!cancelled) setRoomDetails(room);
      })
      .catch(() => {
        if (!cancelled) setRoomDetails(null);
      });
    apiReviews
      .listByRoom(roomId)
      .then((response) => {
        if (!cancelled) setRoomRating({ avg: response.room_avg, count: response.room_count });
      })
      .catch(() => {
        if (!cancelled) setRoomRating(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversation?.room?.id]);

  const roomPriceValue = roomDetails?.price
    ? formatPrice(roomDetails.price_num > 0 ? roomDetails.price_num : roomDetails.price)
    : '';
  const roomPriceUnit = roomDetails?.price_unit || 'nuit';

  const tabs: { id: BoxTab; label: string; count: number | null }[] = [
    { id: 'tous', label: 'Tous', count: conversations.length },
    { id: 'nonlus', label: 'Non lus', count: unreadCount },
    { id: 'proprietaires', label: 'Propriétaires', count: null },
    { id: 'habici', label: 'Linkhoo', count: null },
  ];

  return (
    <div className="msg-maq font-inter min-h-screen bg-[#f8faff] text-[#0b1b3f] antialiased">
      <svg className="hidden" aria-hidden="true">
        <symbol id="cm-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></symbol>
        <symbol id="cm-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></symbol>
        <symbol id="cm-msg" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
        <symbol id="cm-heart" viewBox="0 0 24 24"><path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" /></symbol>
        <symbol id="cm-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
        <symbol id="cm-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></symbol>
        <symbol id="cm-help" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="2.5" y="14" width="4" height="6" rx="1.5" /><rect x="17.5" y="14" width="4" height="6" rx="1.5" /></symbol>
        <symbol id="cm-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></symbol>
        <symbol id="cm-bell" viewBox="0 0 24 24"><path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" /></symbol>
        <symbol id="cm-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
        <symbol id="cm-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></symbol>
        <symbol id="cm-left" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></symbol>
        <symbol id="cm-arrow" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></symbol>
        <symbol id="cm-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></symbol>
        <symbol id="cm-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></symbol>
        <symbol id="cm-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z" /></symbol>
        <symbol id="cm-zap" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></symbol>
        <symbol id="cm-send" viewBox="0 0 24 24"><path d="M21 3 3 10.5l7 3 3 7z" /><path d="m10 13.5 4-4" /></symbol>
        <symbol id="cm-share" viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6" /></symbol>
        <symbol id="cm-alert" viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></symbol>
        <symbol id="cm-shield" viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6z" /><path d="m9 12 2 2 4-4" /></symbol>
        <symbol id="cm-close" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></symbol>
        <symbol id="cm-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></symbol>
        <symbol id="cm-paperclip" viewBox="0 0 24 24"><path d="M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" /></symbol>
        <symbol id="cm-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></symbol>
        <symbol id="cm-check2" viewBox="0 0 24 24"><path d="m2 13 4 4L14 9M12 15l2.5 2.5L22 10" /></symbol>
        <symbol id="cm-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></symbol>
        <symbol id="cm-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z" /></symbol>
        <symbol id="cm-phone" viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2.1z" /></symbol>
        <symbol id="cm-dots" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></symbol>
        <symbol id="cm-building" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></symbol>
        <symbol id="cm-building2" viewBox="0 0 24 24"><path d="M6 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M2 22h20M10 8h4M10 12h4M10 16h4" /></symbol>
      </svg>

      {/* ============ SIDEBAR ============ */}
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[247px] flex-col overflow-y-auto border-r border-[#e6ebf5] bg-white">
        <div className="flex h-[70px] flex-none items-center gap-2.5 px-[34px]">
          <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
        </div>

        <nav className="mt-3 space-y-[4px] px-[15px]">
          <Link to={`${homePath}/compte`} className="nv">
            <Icon id="home" />Accueil
          </Link>
          <Link to={staysPath} className="nv">
            <Icon id="cal" />Mes réservations
          </Link>
          <Link to={messagesPath} className="nv on" aria-current="page">
            <Icon id="msg" />Mes messages
            {unreadCount > 0 && (
              <span className="bd">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </Link>
          <Link to={favoritesPath} className="nv">
            <Icon id="heart" />Mes favoris
          </Link>
          <Link to={profilePath} className="nv">
            <Icon id="user" />Mon profil
          </Link>
          <Link to={profilePath} className="nv">
            <Icon id="cog" />Paramètres
          </Link>
        </nav>

        <div className="mx-[18px] mt-[56px] rounded-xl border border-[#e6ebf5] bg-[#f5f8ff] p-3">
          <div className="flex gap-3">
            <Icon id="help" className="mt-1 !h-8 !w-8 flex-none text-[#1d3f8f]" />
            <div>
              <div className="text-[12.5px] font-bold">Besoin d’aide ?</div>
              <p className="mt-1 text-[11px] leading-[1.45] text-[#5f86d1]">
                Notre équipe est disponible pour vous accompagner.
              </p>
            </div>
          </div>
          <Link to="/contact" className="btn mt-3 !h-[34px] !text-[12px]">
            Contacter le support
          </Link>
        </div>

        <div className="mt-auto pb-12 text-center [@media(max-height:820px)]:hidden">
          <div className="flex items-end justify-center gap-0.5 text-blue-400">
            <Icon id="building" className="!h-10 !w-10 stroke-[1.2]" />
            <Icon id="building2" className="!h-16 !w-16 stroke-[1.2]" />
            <Icon id="building" className="!h-9 !w-9 stroke-[1.2]" />
          </div>
          <div className="text-[18px] font-extrabold tracking-tight text-[#1d3f8f]">
            Link<span className="text-[#ff5a14]">hoo</span>
          </div>
          <p className="mt-1 text-[13px] text-[#5f86d1]">Votre séjour, notre priorité !</p>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="ml-[247px] lg:flex lg:h-screen lg:flex-col">
        <header className="flex h-[67px] flex-none items-center justify-between border-b border-[#e6ebf5]/70 pl-[21px] pr-[22px]">
          <form
            onSubmit={handleSearch}
            className="flex h-[38px] w-[590px] max-w-full items-center gap-3 rounded-lg border border-[#e6ebf5] bg-white px-4"
          >
            <Icon id="search" className="!h-[18px] !w-[18px] text-[#2f5bbf]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une chambre, une ville, une catégorie..."
              className="flex-1 appearance-none border-0 bg-transparent p-0 text-[12.5px] outline-none placeholder:text-[#5f86d1]"
            />
          </form>

          <div className="flex items-center gap-8">
            <Link to={messagesPath} className="relative" aria-label="Notifications">
              <Icon id="bell" className="text-[#2f5bbf]" />
              {unreadMessages > 0 && (
                <span className="absolute -right-2 -top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-[#ff5a14] text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                className="flex h-[54px] w-[198px] items-center gap-3 rounded-xl border border-[#e6ebf5] bg-white pl-2 pr-4"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="avatar h-10 w-10">{initialsOf(fullName)}</span>
                )}
                <span className="min-w-0 text-left leading-tight">
                  <span className="block truncate text-[13px] font-semibold">{fullName}</span>
                  <span className="block text-[11px] text-[#5f86d1]">Client</span>
                </span>
                <Icon id="down" className="ml-auto !h-4 !w-4" />
              </button>

              {menuOpen && (
                <div className="user-menu" role="menu">
                  <Link to={profilePath} className="user-menu__item" role="menuitem">
                    <Icon id="user" className="!h-4 !w-4" />Mon profil
                  </Link>
                  <button
                    type="button"
                    className="user-menu__item"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                  >
                    <Icon id="logout" className="!h-4 !w-4" />Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[391fr_516fr_317fr] gap-x-2 pb-4 pl-[18px] pr-[22px] pt-[18px] max-xl:grid-cols-[360fr_516fr] max-lg:grid-cols-[391fr_516fr] max-md:grid-cols-1 lg:grid-rows-[auto_minmax(0,1fr)]">
          {/* Titre */}
          <div className="col-span-2 flex items-start gap-4 max-lg:col-span-1">
            <Icon id="msg" className="mt-1 !h-[34px] !w-[34px] flex-none text-[#1d3f8f]" />
            <div>
              <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#1d3f8f]">Mes messages</h1>
              <p className="mt-0.5 text-[13px] text-[#2f5bbf]">
                Retrouvez tous vos échanges avec les propriétaires et l’équipe Linkhoo.
              </p>
            </div>
          </div>

          {/* ===== Panneau droit (démarre en haut) ===== */}
          <aside className="row-span-2 ml-[9px] min-h-0 space-y-[14px] overflow-y-auto max-md:hidden">
            <section className="card p-4">
              <h2 className="flex items-center gap-3 text-[13.5px] font-bold text-[#1d3f8f]">
                <Icon id="msg" className="!h-5 !w-5" />Détails de la chambre
              </h2>
              {activeRoom ? (
                <>
                  <div className="relative mt-3.5 h-[clamp(90px,15vh,130px)] overflow-hidden rounded-lg bg-gradient-to-br from-amber-200 to-orange-300">
                    {activeRoom.img && (
                      <img
                        src={activeRoom.img}
                        alt={activeRoom.title || 'Chambre'}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <Icon id="heart" className="f absolute right-2.5 top-2.5 !h-6 !w-6 text-white" />
                  </div>
                  <h3 className="mt-3.5 text-[16px] font-bold text-[#1d3f8f]">{activeRoom.title || 'Chambre'}</h3>
                  {marketLabelOf(activeRoom.market) && (
                    <p className="mt-2 flex items-center gap-2 text-[12px] text-[#1d3f8f]">
                      <Icon id="pin" className="!h-4 !w-4" />{marketLabelOf(activeRoom.market)}
                    </p>
                  )}
                  {roomPriceValue && (
                    <p className="mt-3 text-[13px] font-semibold">
                      <b className="text-[18px] font-extrabold">{roomPriceValue}</b> FCFA / {roomPriceUnit}
                    </p>
                  )}
                  {roomRating?.avg != null && (
                    <p className="mt-3 flex items-center gap-2 text-[12px] text-[#5f86d1]">
                      <Icon id="star" className="f !h-4 !w-4 fill-amber-400 text-amber-400" />
                      <b className="font-semibold text-[#1d3f8f]">{roomRating.avg.toFixed(1)}</b>
                      {' '}({roomRating.count} avis)
                    </p>
                  )}
                  <div className="mt-3.5 flex gap-2.5">
                    <Link to={activeRoomPath} className="btn !h-[36px] flex-1">Voir la chambre</Link>
                    <Link to={activeRoomPath} className="btn !h-[36px] w-[44px]" aria-label="Ouvrir">
                      <Icon id="ext" className="!h-4 !w-4" />
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-[12px] leading-[1.6] text-[#5f86d1]">
                  Sélectionnez une conversation pour afficher les détails de la chambre concernée.
                </p>
              )}
            </section>

            <section className="card px-4 pb-3 pt-4">
              <h2 className="flex items-center gap-3 text-[13px] font-bold text-[#1d3f8f]">
                <Icon id="zap" className="!h-5 !w-5" />Actions rapides
              </h2>
              <div className="mt-2">
                <Link to={staysPath} className="qa">
                  <span><Icon id="cal" /></span>Voir mes réservations
                </Link>
                <button type="button" className="qa w-full" onClick={() => void handleShare()}>
                  <span><Icon id="share" /></span>Partager la conversation
                </button>
                {roomPriceValue && (
                  <button type="button" className="qa w-full bg-[#1a6cf0] text-white">
                    <span><Icon id="ext" /></span>Payer {roomPriceValue} FCFA
                  </button>
                )}
                <Link to="/contact" className="qa">
                  <span><Icon id="alert" /></span>Signaler un problème
                </Link>
              </div>
              {shareFeedback && (
                <p className="mt-1 pb-1 text-[11px] text-[#2f5bbf]" role="status">{shareFeedback}</p>
              )}
            </section>

            <section className="card px-4 pb-5 pt-4">
              <h2 className="flex items-center gap-3 text-[13px] font-bold text-[#1d3f8f]">
                <Icon id="bulb" className="!h-6 !w-6" />Conseils
              </h2>
              <p className="ml-9 mt-2.5 text-[11px] leading-[1.7] text-[#5f86d1]">
                Pour une réservation en toute sérénité, posez toutes vos questions au propriétaire avant de confirmer.
              </p>
              <Link to={homePath} className="ml-9 mt-3 flex items-center gap-2.5 text-[11px] font-semibold text-[#2f5bbf]">
                Voir nos conseils<Icon id="arrow" className="!h-3.5 !w-3.5" />
              </Link>
            </section>
          </aside>

          {/* ===== Liste des conversations ===== */}
          <section className="card mt-[13px] flex h-full min-h-0 flex-col overflow-hidden max-lg:h-[640px]">
            <div className="flex gap-3 px-[6px]">
              {tabs.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  aria-current={tab === entry.id ? 'true' : undefined}
                  className={`tb${tab === entry.id ? ' on' : ''}`}
                >
                  {entry.label}
                  {entry.count !== null && <b>{entry.count}</b>}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 px-3.5 pb-3.5 pt-3.5">
              <label className="flex h-[38px] flex-1 items-center gap-3 rounded-lg border border-[#e6ebf5] bg-white px-3.5">
                <Icon id="search" className="!h-4 !w-4 text-[#2f5bbf]" />
                <span className="sr-only">Rechercher une conversation</span>
                <input
                  type="search"
                  value={conversationQuery}
                  onChange={(event) => setConversationQuery(event.target.value)}
                  placeholder="Rechercher une conversation..."
                  className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-[#5f86d1]"
                />
              </label>
              <button
                type="button"
                className="grid h-[38px] w-[38px] place-items-center rounded-lg border border-[#2f5bbf] text-[#2f5bbf]"
                aria-label="Filtrer"
                onClick={() => loadInbox().catch(() => {})}
              >
                <Icon id="filter" className="!h-4 !w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading && (
                <p className="px-4 py-4 text-[11.5px] text-[#5f86d1]">Chargement...</p>
              )}

              {listError && (
                <p className="px-4 py-4 text-[11.5px] text-red-600" role="alert">{listError}</p>
              )}

              {!listLoading && !listError && visibleConversations.length === 0 && (
                <p className="px-5 py-4 text-[11.5px] leading-[1.6] text-[#5f86d1]">
                  {tab === 'habici'
                    ? 'Aucune conversation avec le support pour le moment. Contactez-nous depuis la page d’aide.'
                    : conversations.length === 0
                      ? 'Aucune conversation pour le moment. Ouvrez-en une depuis la fiche d’une chambre qui vous intéresse.'
                      : 'Aucune conversation ne correspond à votre recherche.'}
                </p>
              )}

              {!listLoading && !listError && visibleConversations.length > 0 && (
                visibleConversations.map((item, index) => {
                  const last = item.last_message;
                  const mine = last?.sender_role === 'client';
                  const active = item.id === conversationId;
                  const isLast = index === visibleConversations.length - 1;
                  return (
                    <Link
                      key={item.id}
                      to={`${basePath}/${item.id}`}
                      aria-current={active ? 'true' : undefined}
                      className={`cv${active ? ' on' : ''}${isLast ? ' border-0' : ''}`}
                    >
                      <span className="av">
                        {item.room?.img ? (
                          <img className="sq" src={item.room.img} alt="" loading="lazy" />
                        ) : (
                          <span className="lg"><Icon id="home" className="f !h-7 !w-7" /></span>
                        )}
                        {(item.unread_count ?? 0) > 0 && <i className="dot" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4>{item.room?.title || 'Chambre'}</h4>
                        <p>{last ? `${mine ? 'Vous : ' : ''}${last.body}` : 'Aucun message'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <time>{timeAgo(item.last_message_at || item.created_at)}</time>
                        {(item.unread_count ?? 0) > 0 && (
                          <em aria-label={`${item.unread_count} non lus`}>{item.unread_count}</em>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            <div className="m-3.5 flex items-center gap-3.5 rounded-lg bg-[#f5f8ff] px-4 py-3.5">
              <Icon id="shield" className="!h-6 !w-6 flex-none text-[#2f5bbf]" />
              <div>
                <div className="text-[11.5px] font-bold text-[#0b1b3f]">Votre messagerie est sécurisée</div>
                <p className="mt-1 text-[10.5px] text-[#5f86d1]">Vos échanges sont protégés et confidentiels.</p>
              </div>
            </div>
          </section>

          {/* ===== Conversation ===== */}
          <section className="card mt-[13px] flex h-full min-h-0 flex-col overflow-hidden max-lg:h-[640px]">
            {!conversationId ? (
              <div className="grid flex-1 place-items-center px-6 py-12 text-center">
                <div>
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eaf0fb] text-[#2f5bbf]">
                    <Icon id="msg" className="!h-7 !w-7" />
                  </span>
                  <p className="mt-4 text-[14px] font-semibold text-[#1d3f8f]">Sélectionnez une conversation</p>
                  <p className="mt-1 text-[12px] text-[#5f86d1]">
                    Choisissez un échange dans la liste pour lire et répondre à vos messages.
                  </p>
                </div>
              </div>
            ) : threadLoading && !conversation ? (
              <p className="px-[18px] py-5 text-[11.5px] text-[#5f86d1]">Chargement...</p>
            ) : threadError && !conversation ? (
              <div className="grid flex-1 place-items-center px-6 py-12 text-center">
                <div>
                  <Link to={basePath} className="mb-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-[#2f5bbf]">
                    <Icon id="left" className="!h-4 !w-4" />Retour aux messages
                  </Link>
                  <p className="text-[12px] text-red-600" role="alert">{threadError}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-[64px] flex-none items-center gap-3.5 border-b border-[#e6ebf5] px-4">
                  <span className="h-[48px] w-[60px] flex-none overflow-hidden rounded-md bg-gradient-to-br from-amber-200 to-orange-300">
                    {activeRoom?.img && (
                      <img src={activeRoom.img} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold text-[#1d3f8f]">
                      {activeRoom?.title || 'Discussion avec le gérant'}
                    </div>
                    <div className="mt-1 truncate text-[11.5px] text-[#2f5bbf]">
                      {roomPriceValue && (
                        <>
                          {roomPriceValue} FCFA / {roomPriceUnit}
                          <span className="mx-2">•</span>
                        </>
                      )}
                      {marketLabelOf(activeRoom?.market) || 'Échange avec le propriétaire'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#2f5bbf] text-[#2f5bbf]"
                    aria-label="Appeler"
                  >
                    <Icon id="phone" className="!h-4 !w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#e6ebf5] text-[#1d3f8f]"
                    aria-label="Plus"
                  >
                    <Icon id="dots" className="!h-4 !w-4" />
                  </button>
                </div>

                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 space-y-[22px] overflow-y-auto px-[18px] py-5 [@media(max-height:860px)]:space-y-3.5 [@media(max-height:860px)]:py-3"
                >
                  {hasOlder && (
                    <div className="text-center">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[#2f5bbf] underline"
                        onClick={loadOlder}
                        disabled={loadingOlder}
                      >
                        {loadingOlder ? 'Chargement...' : 'Charger les messages plus anciens'}
                      </button>
                    </div>
                  )}

                  {messages.length === 0 && (
                    <p className="py-6 text-center text-[12px] text-[#5f86d1]">
                      Écrivez le premier message au propriétaire.
                    </p>
                  )}

                  {messages.map((message, index) => {
                    const mine = message.sender_role === 'client';
                    const previous = messages[index - 1];
                    const showDay =
                      !previous ||
                      new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
                    return (
                      <div key={message.id}>
                        {showDay && (
                          <div className="pb-[22px] text-center [@media(max-height:860px)]:pb-3.5">
                            <span className="rounded-full bg-[#e9f0fc] px-3 py-1 text-[11px] text-[#1d3f8f]">
                              {dayLabel(message.created_at)}
                            </span>
                          </div>
                        )}
                        {mine ? (
                          <div className="bm me">
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                            <time>
                              {messageTime(message.created_at)}
                              {message.read_at && <Icon id="check2" className="!h-3.5 !w-3.5" />}
                            </time>
                          </div>
                        ) : (
                          <div className="rw">
                            {activeRoom?.img ? (
                              <img src={activeRoom.img} alt="" />
                            ) : (
                              <span className="grid place-items-center bg-gradient-to-br from-amber-200 to-orange-300 text-white">
                                <Icon id="user" className="!h-4 !w-4" />
                              </span>
                            )}
                            <div className="bm ot">
                              <p className="whitespace-pre-wrap break-words">{message.body}</p>
                              <time>{messageTime(message.created_at)}</time>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {threadError && (
                  <p className="px-4 pb-1 text-[11.5px] text-red-600" role="alert">{threadError}</p>
                )}

                <form
                  className="flex flex-none items-center gap-3 border-t border-[#e6ebf5] px-4 py-3.5"
                  onSubmit={handleSend}
                >
                  <button type="button" className="text-[#5f86d1]" aria-label="Joindre un fichier" disabled>
                    <Icon id="paperclip" className="!h-5 !w-5" />
                  </button>
                  <label className="flex h-[40px] flex-1 items-center gap-3 rounded-lg border border-[#e6ebf5] bg-white px-3.5">
                    <span className="sr-only">Votre message</span>
                    <input
                      ref={messageInputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      autoFocus
                      placeholder="Écrivez votre message..."
                      maxLength={2000}
                      className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-[#5f86d1]"
                    />
                    <Icon id="smile" className="!h-5 !w-5 flex-none text-[#5f86d1]" />
                  </label>
                  <button
                    type="submit"
                    aria-label="Envoyer le message"
                    disabled={sending || !draft.trim()}
                    className="grid h-[36px] w-[36px] place-items-center rounded-lg bg-[#1a6cf0] text-white shadow-[0_4px_10px_rgba(26,108,240,.35)] disabled:opacity-60"
                  >
                    <Icon id="send" className="!h-[18px] !w-[18px]" />
                  </button>
                </form>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
