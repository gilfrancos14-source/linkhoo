import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { apiMessages, type Conversation, type Message } from '../../lib/api';
import { fetchRoomById, type Room } from '../../data/rooms';
import { priceWithCurrency } from '../../lib/roomDisplay';
import '../../styles/38-gerant-maq6.css';

function Icon({ id, className = 'ico w-5 h-5 shrink-0' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

const navCls =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-[#1E2A44] hover:bg-slate-50';
const subCls =
  'flex items-center gap-3 pl-9 pr-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-orange-50';
const subOnCls = `${subCls} bg-orange-50 text-[#F26A21] font-semibold`;
const cardCls = 'bg-white rounded-xl border border-slate-100 shadow-sm';
const badgeCls =
  'grid place-items-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#F26A21] text-white text-[11px] font-bold';
const tabCls = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#1E2A44]';
const avCls = 'relative shrink-0 w-11 h-11 rounded-full grid place-items-center text-sm font-bold';

const AVATAR_COLORS = [
  'bg-rose-200 text-rose-800',
  'bg-sky-200 text-sky-800',
  'bg-amber-200 text-amber-800',
  'bg-emerald-200 text-emerald-800',
  'bg-violet-200 text-violet-800',
  'bg-orange-200 text-orange-800',
  'bg-pink-200 text-pink-800',
];

type TabKey = 'tous' | 'non-lus' | 'clients';

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'CL';
}

function colorOf(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function chronological(items: Message[]): Message[] {
  return [...items].sort((a, b) =>
    a.created_at === b.created_at
      ? a.id.localeCompare(b.id)
      : a.created_at.localeCompare(b.created_at),
  );
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return formatTime(iso);
  if (days === 1) return 'Hier';
  if (days < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function priceLabel(room: Room): string {
  const unit = room.priceUnit?.trim();
  const base = priceWithCurrency(room.priceNum, unit);
  if (!unit) return base;
  return `${base} ${unit.startsWith('/') ? unit : `/ ${unit}`}`;
}

const THREAD_POLL_MS = 12_000;
const INBOX_POLL_MS = 30_000;

export default function BoiteReceptionMaq6() {
  const homePath = useHomePath();
  const chrome = useGerantChrome();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const demandesPath = `${gerantPath}/reservations/demandes`;
  const calendrierPath = `${gerantPath}/reservations/calendrier`;
  const inboxPath = `${gerantPath}/messages/boite-reception`;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('tous');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const threadScroll = useRef<HTMLDivElement | null>(null);

  const loadInbox = useCallback(async () => {
    const page = await apiMessages.gerantInbox();
    setError('');
    setConversations(page.items);
    setSelectedId((current) => {
      if (current && page.items.some((item) => item.id === current)) return current;
      return page.items[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadInbox()
      .catch(() => {
        if (alive) setError('Impossible de charger vos conversations.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadInbox]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadInbox().catch(() => {});
    }, INBOX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadInbox]);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadLoading(false);
      setThreadError('');
      return;
    }

    let alive = true;
    setMessages([]);
    setReply('');
    setThreadLoading(true);
    setThreadError('');

    const loadThread = async (initial: boolean) => {
      try {
        const items = await apiMessages.listMessages(selectedId);
        if (!alive) return;
        setMessages(chronological(items));

        const hasUnread = items.some(
          (item) => item.sender_role === 'client' && !item.read_at,
        );
        if (hasUnread) {
          await apiMessages.markRead(selectedId).catch(() => null);
          if (!alive) return;
          setConversations((current) =>
            current.map((item) =>
              item.id === selectedId ? { ...item, unread_count: 0 } : item,
            ),
          );
        }
      } catch {
        if (alive && initial) setThreadError('Impossible de charger les messages.');
      } finally {
        if (alive && initial) setThreadLoading(false);
      }
    };

    void loadThread(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadThread(false);
    }, THREAD_POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  const roomId = selected?.room?.id;
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }
    let alive = true;
    setRoom(null);
    fetchRoomById(roomId)
      .then((data) => {
        if (alive) setRoom(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [roomId]);

  useEffect(() => {
    if (!lastMessageId) return;
    const el = threadScroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastMessageId, selectedId]);

  const total = conversations.length;
  const unread = conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0);
  const query = search.trim().toLowerCase();
  const filtered = conversations.filter((item) => {
    if (tab === 'non-lus' && !(item.unread_count ?? 0)) return false;
    if (!query) return true;
    return [item.client_name, item.client_email, item.room?.title, item.last_message?.body]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = reply.trim();
    if (!selectedId || !body || sending) return;
    setSending(true);
    setThreadError('');
    try {
      const sent = await apiMessages.sendMessage(selectedId, body);
      setReply('');
      setMessages((current) => {
        const withoutSent = current.filter((item) => item.id !== sent.id);
        return chronological([...withoutSent, sent]);
      });
      await loadInbox();
    } catch {
      setThreadError("Impossible d'envoyer votre message.");
    } finally {
      setSending(false);
    }
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'tous', label: 'Tous', count: total },
    { key: 'non-lus', label: 'Non lus', count: unread },
    { key: 'clients', label: 'Clients', count: total },
  ];

  const clientInitials = selected ? initialsOf(selected.client_name) : 'CL';
  const clientColor = selected ? colorOf(selected.client_name) : AVATAR_COLORS[0];
  const roomTitle = room?.title ?? selected?.room?.title ?? 'Chambre';

  return (
    <div className="gerant-maq6 min-h-screen bg-[#F7F9FC] font-sans text-[#1E2A44] antialiased">
      <svg className="hidden" aria-hidden="true">
        <symbol id="home" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></symbol>
        <symbol id="bed" viewBox="0 0 24 24"><path d="M2 20v-9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9M2 16h20M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" /></symbol>
        <symbol id="cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></symbol>
        <symbol id="msg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></symbol>
        <symbol id="shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></symbol>
        <symbol id="user" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></symbol>
        <symbol id="crown" viewBox="0 0 24 24"><path d="M2 18l2-11 5 5 3-8 3 8 5-5 2 11z" /></symbol>
        <symbol id="mega" viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h3l8 5V5L7 10H4a1 1 0 0 0-1 1zM19 9a4 4 0 0 1 0 6" /></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></symbol>
        <symbol id="bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></symbol>
        <symbol id="down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
        <symbol id="send" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></symbol>
        <symbol id="clip" viewBox="0 0 24 24"><path d="M21.4 11l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></symbol>
        <symbol id="pin" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></symbol>
        <symbol id="x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></symbol>
        <symbol id="share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></symbol>
        <symbol id="ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M4.9 4.9l14.2 14.2" /></symbol>
        <symbol id="sliders" viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></symbol>
        <symbol id="file" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></symbol>
        <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="tag" viewBox="0 0 24 24"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><circle cx="7" cy="7" r="1" /></symbol>
        <symbol id="drop" viewBox="0 0 24 24"><path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z" /></symbol>
        <symbol id="bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></symbol>
        <symbol id="checks" viewBox="0 0 24 24"><path d="M2 12l5 5L17 7M12 16l1 1L22 7" /></symbol>
      </svg>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-100 bg-white p-4 lg:flex">
        <Link to={gerantPath} className="mb-6 flex items-center gap-2.5 px-2" aria-label="Linkhoo - retour à l'accueil">
          <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
        </Link>

          <Link to={gerantPath} className={navCls}><Icon id="home" />Aperçu</Link>

          <Link to={chambresPath} className={`${navCls} mt-1`}><Icon id="bed" />Chambres<Icon id="down" className="ico ml-auto h-4 w-4 rotate-180" /></Link>
          <Link to={chambresPath} className={subCls}><Icon id="bed" className="ico h-4 w-4 shrink-0" />Toutes les chambres</Link>
          <Link to={`${chambresPath}/ajouter`} className={subCls}><Icon id="plus" className="ico h-4 w-4 shrink-0" />Ajouter une chambre</Link>

          <Link to={`${gerantPath}/reservations`} className={`${navCls} mt-1`}><Icon id="cal" />Réservations{chrome.reservationsCount > 0 && <span className={`${badgeCls} ml-auto`}>{chrome.reservationsCount}</span>}</Link>
          <Link to={demandesPath} className={subCls}><Icon id="file" className="ico h-4 w-4 shrink-0" />Demandes</Link>
          <Link to={calendrierPath} className={subCls}><Icon id="cal" className="ico h-4 w-4 shrink-0" />Calendrier</Link>

          <Link to={inboxPath} className={`${navCls} mt-1`}><Icon id="msg" />Messages{chrome.messagesUnread > 0 && <span className={`${badgeCls} ml-auto`}>{chrome.messagesUnread}</span>}</Link>
          <Link to={inboxPath} className={subOnCls} aria-current="page"><Icon id="msg" className="ico h-4 w-4 shrink-0" />Boîte de réception</Link>

          <Link to={`${gerantPath}/verification`} className={`${navCls} mt-1`}><Icon id="shield" />Vérification<Icon id="down" className="ico ml-auto h-4 w-4" /></Link>
          <Link to={`${gerantPath}/verification`} className={subCls}><Icon id="file" className="ico h-4 w-4 shrink-0" />Mes documents</Link>
          <Link to={`${gerantPath}/verification`} className={subCls}><Icon id="shield" className="ico h-4 w-4 shrink-0" />Suivi de vérification</Link>

          <Link to={`${gerantPath}/profil`} className={`${navCls} mt-1`}><Icon id="user" />Profil<Icon id="down" className="ico ml-auto h-4 w-4" /></Link>
          <Link to={`${gerantPath}/profil`} className={subCls}><Icon id="user" className="ico h-4 w-4 shrink-0" />Mes informations</Link>

          <Link to={`${gerantPath}/premium`} className={`${navCls} mt-1`}><Icon id="crown" className="ico w-5 h-5 shrink-0 text-[#F26A21]" />Premium</Link>
          <Link to={`${gerantPath}/premium`} className={subCls}><Icon id="cal" className="ico h-4 w-4 shrink-0" />Mon abonnement</Link>

          <div className="mt-auto pt-4">
            <div className="rounded-xl border border-orange-100 bg-[#FDEBDF] p-4">
              <p className="flex items-center gap-2 text-sm font-bold"><Icon id="crown" className="ico w-5 h-5 shrink-0 text-[#F26A21]" />Passez au Premium</p>
              <p className="mt-2 text-xs text-slate-500">Plus de visibilité, plus de réservations !</p>
              <Link to={`${gerantPath}/premium`} className="mt-3 block rounded-lg bg-[#F26A21] py-2 text-center text-xs font-bold text-white hover:bg-orange-600">Voir les avantages</Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <label className={`flex w-full max-w-xl items-center gap-3 px-5 py-3 text-sm text-slate-400 ${cardCls}`}>
              <Icon id="search" className="ico w-5 h-5 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une chambre, une catégorie..."
                className="w-full bg-transparent text-[#1E2A44] outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="flex items-center gap-5">
              <button type="button" className="relative" aria-label="Notifications">
                <Icon id="bell" className="ico w-6 h-6 shrink-0 text-[#1E2A44]" />
                {chrome.messagesUnread > 0 && <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-[#F26A21] text-[10px] font-bold text-white">{chrome.messagesUnread}</span>}
              </button>
              <div className={`flex items-center gap-3 py-2 pl-2 pr-4 text-left ${cardCls}`}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-200 text-sm font-bold text-amber-800">{chrome.initials}</span>
                <span className="hidden leading-tight sm:block"><span className="block text-sm font-bold">{chrome.displayName}</span><span className="text-xs text-slate-500">Gérant</span></span>
                <GerantLogoutButton className="text-slate-500" />
              </div>
            </div>
          </header>

          <main className="px-6 pb-10 lg:px-8">
            <h1 className="text-3xl font-extrabold">Boîte de réception</h1>
            <p className="mt-1 text-sm text-slate-500">Consultez et gérez tous vos messages en un seul endroit.</p>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-3">
                <div className={`flex flex-wrap items-center gap-3 p-3 ${cardCls}`}>
                  <nav className="flex flex-wrap gap-1">
                    {tabs.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={`${tabCls} ${tab === item.key ? 'bg-[#F26A21] text-white' : ''}`}
                      >
                        {item.label}{' '}
                        <span className={`${badgeCls} ${tab === item.key ? 'bg-white text-[#F26A21]' : 'bg-orange-100 text-[#F26A21]'}`}>{item.count}</span>
                      </button>
                    ))}
                  </nav>
                  <label className="ml-auto flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-sm sm:w-72">
                    <Icon id="search" className="ico h-4 w-4 shrink-0 text-[#1E2A44]" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher dans vos messages..."
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                    />
                  </label>
                  <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold"><Icon id="sliders" className="ico h-4 w-4 shrink-0" />Filtres</button>
                </div>

                <div className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
                  <section className={`flex h-[560px] flex-col overflow-hidden ${cardCls}`}>
                    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                    {loading && <p className="p-4 text-sm text-slate-500">Chargement des conversations...</p>}
                    {error && !loading && <p role="alert" className="p-4 text-sm text-red-600">{error}</p>}
                    {!loading && !error && total === 0 && (
                      <p className="p-4 text-sm text-slate-500">Aucune conversation pour le moment. Les clients intéressés par vos chambres vous écriront ici.</p>
                    )}
                    {!loading && !error && total > 0 && filtered.length === 0 && (
                      <p className="p-4 text-sm text-slate-500">Aucune conversation ne correspond à vos filtres.</p>
                    )}
                    {filtered.map((conversation) => {
                      const active = conversation.id === selectedId;
                      const last = conversation.last_message;
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => setSelectedId(conversation.id)}
                          className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left ${active ? 'border-l-2 border-l-[#F26A21] bg-orange-50' : ''}`}
                        >
                          <span className={`${avCls} ${colorOf(conversation.client_name)}`}>{initialsOf(conversation.client_name)}<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex justify-between"><b className="text-sm">{conversation.client_name}</b><span className="text-xs text-slate-400">{formatRelative(conversation.last_message_at || conversation.created_at)}</span></span>
                            <span className="flex items-center justify-between gap-2 text-xs text-[#1E2A44]"><span className="truncate">{conversation.room?.title ?? 'Chambre'}</span>{(conversation.unread_count ?? 0) > 0 ? <span className={badgeCls}>{conversation.unread_count}</span> : <i className="h-1.5 w-1.5 rounded-full bg-green-500" />}</span>
                            <span className="block truncate text-xs text-slate-400">{last ? `${last.sender_role === 'gerant' ? 'Vous : ' : ''}${last.body}` : 'Aucun message'}</span>
                          </span>
                        </button>
                      );
                    })}
                    </div>
                  </section>

                  <section className={`flex h-[560px] flex-col ${cardCls}`}>
                    {selected ? (
                      <>
                        <header className="flex shrink-0 items-center gap-4 border-b border-slate-100 p-4">
                          <span className={`${avCls} ${clientColor}`}>{clientInitials}</span>
                          <div className="leading-tight"><p className="text-sm font-bold">{selected.client_name}</p><p className="text-xs text-slate-500">{selected.client_email}</p></div>
                          <div className="ml-4 flex min-w-0 items-center gap-3">
                            {room?.img ? (
                              <img src={room.img} alt="" className="h-11 w-14 shrink-0 rounded-md object-cover" />
                            ) : (
                              <span className="h-11 w-14 shrink-0 rounded-md bg-gradient-to-br from-sky-300 to-amber-200"></span>
                            )}
                            <div className="min-w-0 leading-tight"><p className="truncate text-sm font-bold">{roomTitle}</p><p className="text-xs text-slate-500">{[room?.quartier, room?.ville].filter(Boolean).join(', ') || selected.room?.market || '—'}{room ? ` · ${room.chambres} chambre${room.chambres > 1 ? 's' : ''}` : ''}</p></div>
                          </div>
                          <button className="ml-auto text-xl leading-none text-slate-500" aria-label="Plus d'options">⋯</button>
                        </header>

                        <div ref={threadScroll} className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                          {threadLoading && <p className="text-sm text-slate-500">Chargement des messages...</p>}
                          {!threadLoading && messages.length === 0 && <p className="text-sm text-slate-500">Aucun message pour le moment. Écrivez le premier message.</p>}
                          {messages.map((message) => (
                            message.sender_role === 'gerant' ? (
                              <div key={message.id} className="flex justify-end">
                                <p className="max-w-[75%] whitespace-pre-line rounded-xl bg-[#FDEBDF] px-4 py-3 text-sm leading-relaxed text-[#1E2A44]">{message.body}<time className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-400">{formatTime(message.created_at)}<span role="img" aria-label={message.read_at ? 'Lu' : 'Envoyé'}><Icon id="checks" className={`ico h-4 w-4 shrink-0 ${message.read_at ? 'text-[#F26A21]' : 'text-slate-300'}`} /></span></time></p>
                              </div>
                            ) : (
                              <div key={message.id} className="flex items-start gap-3">
                                <span className={`${avCls} h-9 w-9 text-xs ${clientColor}`}>{clientInitials}</span>
                                <p className="max-w-[75%] whitespace-pre-line rounded-xl bg-[#EAF0F8] px-4 py-3 text-sm leading-relaxed text-[#1E2A44]">{message.body}<time className="mt-2 block text-[11px] text-slate-400">{formatTime(message.created_at)}</time></p>
                              </div>
                            )
                          ))}
                        </div>

                        {threadError && <p role="alert" className="px-5 pb-2 text-sm text-red-600">{threadError}</p>}

                        <form className="flex shrink-0 items-center gap-3 border-t border-slate-100 p-4" onSubmit={handleSend}>
                          <label className="flex flex-1 items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
                            <Icon id="clip" className="ico w-5 h-5 shrink-0 text-[#1E2A44]" />
                            <input
                              type="text"
                              value={reply}
                              onChange={(event) => setReply(event.target.value)}
                              placeholder="Écrivez votre message..."
                              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                            />
                          </label>
                          <button type="submit" disabled={sending || !reply.trim()} className="grid h-12 w-12 place-items-center rounded-xl bg-[#F26A21] text-white hover:bg-orange-600 disabled:opacity-50" aria-label="Envoyer"><Icon id="send" /></button>
                        </form>
                      </>
                    ) : (
                      <div className="grid flex-1 place-items-center p-6 text-center">
                        <div>
                          <Icon id="msg" className="ico mx-auto h-10 w-10 text-slate-300" />
                          <p className="mt-3 text-sm font-semibold">Sélectionnez une conversation</p>
                          <p className="mt-1 text-xs text-slate-500">Les messages échangés avec vos clients apparaîtront ici.</p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <aside className="hidden space-y-4 xl:block">
                <div className={`p-3 ${cardCls}`}>
                  <div className="relative h-28 overflow-hidden rounded-lg bg-gradient-to-br from-sky-300 via-amber-100 to-orange-200">
                    {room?.img && <img src={room.img} alt="" className="h-full w-full object-cover" />}
                    <span className="absolute left-2 top-2 rounded-full bg-green-500 px-3 py-0.5 text-xs font-bold text-white">{room ? (room.disponible ? 'Disponible' : 'Indisponible') : '—'}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-snug">{roomTitle}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Icon id="pin" className="ico h-4 w-4 shrink-0" />{[room?.quartier, room?.ville].filter(Boolean).join(', ') || '—'}</p>
                  <p className="mt-2 flex gap-5 text-xs text-slate-500">
                    <span className="flex items-center gap-2"><Icon id="bed" className="ico h-4 w-4 shrink-0" />{room ? `${room.chambres} chambre${room.chambres > 1 ? 's' : ''}` : '—'}</span>
                    <span className="flex items-center gap-2"><Icon id="drop" className="ico h-4 w-4 shrink-0" />{room ? `${room.douches} salle${room.douches > 1 ? 's' : ''} d'eau` : '—'}</span>
                  </p>
                  <p className="mt-3 text-sm font-bold text-[#F26A21]">{room ? priceLabel(room) : '—'}</p>
                </div>

                <div className={`p-4 ${cardCls}`}>
                  <h2 className="text-sm font-bold">Actions rapides</h2>
                  <div className="mt-3 space-y-2">
                    <Link to={demandesPath} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-[#1E2A44] hover:bg-slate-50"><Icon id="cal" className="ico h-4 w-4 shrink-0 text-[#F26A21]" />Voir la réservation</Link>
                    <Link to={room ? `${homePath}/chambres/${room.id}` : chambresPath} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-[#1E2A44] hover:bg-slate-50"><Icon id="share" className="ico h-4 w-4 shrink-0 text-[#F26A21]" />Partager l&apos;annonce</Link>
                    <button type="button" className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-[#1E2A44] hover:bg-slate-50"><Icon id="ban" className="ico h-4 w-4 shrink-0 text-[#F26A21]" />Bloquer l&apos;utilisateur</button>
                  </div>
                </div>

                <div className={`p-4 ${cardCls}`}>
                  <h2 className="text-sm font-bold">Informations du client</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <span className={`${avCls} ${clientColor}`}>{clientInitials}</span>
                    <div className="min-w-0 flex-1 text-xs leading-snug">
                      <p className="flex items-center justify-between gap-2"><b className="text-sm">{selected?.client_name ?? '—'}</b>{selected && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Client</span>}</p>
                      <p className="truncate text-slate-500">{selected?.client_email ?? '—'}</p>
                      <p className="text-slate-500">—</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" className="rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-[#F26A21]">Voir le profil</button>
                    <button type="button" className="rounded-lg border border-slate-200 py-2 text-center text-xs font-semibold text-[#F26A21]">Ajouter une note</button>
                  </div>
                </div>

                <div className={`p-4 ${cardCls}`}>
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-bold"><Icon id="bulb" className="ico w-5 h-5 shrink-0 text-[#F26A21]" />Infos utiles</h2>
                    <button aria-label="Fermer"><Icon id="x" className="ico h-4 w-4 shrink-0" /></button>
                  </div>
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Répondez rapidement aux messages pour augmenter vos chances de réservation et améliorer votre note.</p>
                </div>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
