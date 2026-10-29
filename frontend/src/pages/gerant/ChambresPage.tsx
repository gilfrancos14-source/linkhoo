import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { fetchMyRooms, toggleRoom, updateRoom, type Room } from '../../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import { priceWithCurrency } from '../../lib/roomDisplay';
import '../../styles/34-gerant-maq2.css';

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

const GRADIENTS = [
  'from-sky-300 to-amber-200',
  'from-amber-200 to-orange-400',
  'from-emerald-500 to-sky-300',
  'from-stone-300 to-orange-300',
  'from-slate-400 to-sky-700',
  'from-sky-400 to-amber-100',
];

const CATEGORY_STYLES = [
  { icon: 'build', cls: 'bg-sky-100 text-sky-500' },
  { icon: 'cal', cls: 'bg-amber-100 text-amber-500' },
  { icon: 'chat', cls: 'bg-pink-100 text-pink-500' },
  { icon: 'home', cls: 'bg-violet-100 text-violet-500' },
];

type SortKey = 'recent' | 'price-asc' | 'price-desc';

function formatLocation(room: Room): string {
  return [room.quartier, room.ville].filter(Boolean).join(', ') || room.pays || room.market;
}

function roomsLabel(count: number): string {
  return `${count} chambre${count > 1 ? 's' : ''}`;
}

function bathsLabel(count: number): string {
  return `${count} salle${count > 1 ? 's' : ''} d’eau`;
}

function priceLabel(room: Room): string {
  const unit = room.priceUnit?.trim();
  const base = priceWithCurrency(room.priceNum, unit);
  if (!unit) return base;
  return `${base} ${unit.startsWith('/') ? unit : `/ ${unit}`}`;
}

export default function ChambresPage() {
  const homePath = useHomePath();
  const chrome = useGerantChrome();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const demandesPath = `${gerantPath}/reservations/demandes`;
  const calendrierPath = `${gerantPath}/reservations/calendrier`;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied'>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let alive = true;
    fetchMyRooms()
      .then((items) => {
        if (alive) setRooms(items);
      })
      .catch(() => {
        if (alive) setError('Impossible de charger vos chambres.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const market = chrome.gerant?.market;
  useEffect(() => {
    if (!market) return;
    let alive = true;
    fetchCategoriesByMarket(market)
      .then((items) => {
        if (alive) setCategories(items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [market]);

  const categoryTitle = (id: string): string =>
    categories.find((category) => category.id === id)?.title ?? id;

  const searchQuery = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const items = rooms.filter((room) => {
      if (categoryFilter !== 'all' && room.category !== categoryFilter) return false;
      if (statusFilter === 'available' && !room.disponible) return false;
      if (statusFilter === 'occupied' && room.disponible) return false;
      if (!searchQuery) return true;
      return [room.title, room.quartier, room.ville, categoryTitle(room.category)]
        .join(' ')
        .toLowerCase()
        .includes(searchQuery);
    });
    if (sort === 'price-asc') return [...items].sort((a, b) => a.priceNum - b.priceNum);
    if (sort === 'price-desc') return [...items].sort((a, b) => b.priceNum - a.priceNum);
    return items;
  }, [rooms, categoryFilter, statusFilter, searchQuery, sort, categories]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    rooms.forEach((room) => {
      if (!map.has(room.category)) map.set(room.category, categoryTitle(room.category));
    });
    return [...map.entries()];
  }, [rooms, categories]);

  const categoryEntries = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>();
    rooms.forEach((room) => {
      const current = map.get(room.category);
      map.set(room.category, {
        title: categoryTitle(room.category),
        count: (current?.count ?? 0) + 1,
      });
    });
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [rooms, categories]);

  const available = rooms.filter((room) => room.disponible).length;
  const occupied = rooms.length - available;
  const popular = rooms.filter((room) => room.isPopular).length;

  async function handleToggle(room: Room) {
    if (busyId) return;
    setBusyId(room.id);
    setActionError('');
    try {
      const updated = await toggleRoom(room.id);
      setRooms((current) => current.map((item) => (item.id === room.id ? updated : item)));
    } catch {
      setActionError('Impossible de modifier la disponibilité de cette chambre.');
    } finally {
      setBusyId('');
    }
  }

  async function handlePopular(room: Room) {
    if (busyId) return;
    setBusyId(room.id);
    setActionError('');
    try {
      await updateRoom(room.id, { isPopular: !room.isPopular });
      setRooms((current) =>
        current.map((item) => (item.id === room.id ? { ...item, isPopular: !item.isPopular } : item)),
      );
    } catch {
      setActionError('Impossible de modifier le statut populaire de cette chambre.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="gerant-maq2 bg-[#f5f8fc] text-dash-navy antialiased">
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <symbol id="home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5" /></symbol>
        <symbol id="bed" viewBox="0 0 24 24"><path d="M3 20V5M3 16h18v4M21 16v-4a3 3 0 0 0-3-3h-7v7" /><circle cx="7" cy="11" r="1.5" /></symbol>
        <symbol id="cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></symbol>
        <symbol id="chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
        <symbol id="shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" /></symbol>
        <symbol id="shieldf" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" fill="currentColor" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" /></symbol>
        <symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></symbol>
        <symbol id="crown" viewBox="0 0 24 24"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z" fill="currentColor" /></symbol>
        <symbol id="mega" viewBox="0 0 24 24"><path d="M3 11v3l12 5V6zM15 9a3 3 0 0 1 0 6M6 15l1 5h3l-1-4" /></symbol>
        <symbol id="down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
        <symbol id="right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></symbol>
        <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="pc" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></symbol>
        <symbol id="tag" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></symbol>
        <symbol id="bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" /></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></symbol>
        <symbol id="bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></symbol>
        <symbol id="doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
        <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
        <symbol id="build" viewBox="0 0 24 24"><path d="M5 21V4h10v17M15 9h4v12M9 8h2M9 12h2M9 16h2M3 21h18" /></symbol>
        <symbol id="list" viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></symbol>
        <symbol id="dots" viewBox="0 0 24 24"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></g></symbol>
        <symbol id="pin" viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></symbol>
        <symbol id="heart" viewBox="0 0 24 24"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" /></symbol>
        <symbol id="star" viewBox="0 0 24 24"><path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.7l6.2-.9z" /></symbol>
        <symbol id="drop" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></symbol>
        <symbol id="filter" viewBox="0 0 24 24"><path d="M4 7h16M7 12h10M10 17h4" /></symbol>
      </svg>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 lg:flex">
        <Link to={gerantPath} className="mb-6 flex items-center gap-2.5 px-2" aria-label="Linkhoo - retour à l'accueil">
          <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
        </Link>

          <nav className="space-y-3">
            <Link to={gerantPath} className="grp">
              <Icon id="home" />Aperçu
            </Link>

            <div>
              <Link to={chambresPath} className="grp rounded-xl bg-dash-brand-soft text-dash-brand-dark">
                <Icon id="bed" />Chambres
              </Link>
              <div className="pl-3">
                <Link to={chambresPath} className="sub on">
                  <Icon id="list" />Toutes les chambres<span className="ml-auto h-1.5 w-1.5 rounded-full bg-dash-brand" />
                </Link>
                <Link to={`${chambresPath}/ajouter`} className="sub"><Icon id="plus" />Ajouter une chambre</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="cal" />Réservations{chrome.reservationsCount > 0 && <span className="badge">{chrome.reservationsCount}</span>}</div>
              <div className="pl-3">
                <Link to={demandesPath} className="sub"><Icon id="user" />Demandes</Link>
                <Link to={calendrierPath} className="sub"><Icon id="cal" />Calendrier</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="chat" />Messages{chrome.messagesUnread > 0 && <span className="badge">{chrome.messagesUnread}</span>}</div>
              <div className="pl-3">
                <Link to={`${gerantPath}/messages/boite-reception`} className="sub"><Icon id="mail" />Boîte de réception</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="shield" />Vérification</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-3">
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Mes documents</Link>
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Suivi de vérification</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="user" />Profil</div>
              <div className="pl-3"><Link to={`${gerantPath}/profil`} className="sub"><Icon id="user" />Mes informations</Link></div>
            </div>

            <div>
              <div className="grp"><Icon id="crown" className="i text-dash-brand" />Premium</div>
              <div className="pl-3"><Link to={`${gerantPath}/premium`} className="sub"><Icon id="cal" />Mon abonnement</Link></div>
            </div>
          </nav>

          <div className="mt-auto rounded-2xl border border-orange-100 bg-dash-brand-soft p-4 pt-5">
            <p className="flex items-center gap-2 text-sm font-bold"><Icon id="crown" className="i h-5 w-5 text-dash-brand" />Passez au Premium</p>
            <p className="mt-2 text-[11px] text-slate-500">Plus de visibilité, plus de réservations !</p>
            <Link to={`${gerantPath}/premium`} className="mt-3 block rounded-lg bg-dash-brand py-2 text-center text-xs font-semibold text-white hover:bg-dash-brand-dark">Voir les avantages</Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-7">
          <header className="flex items-center gap-4">
            <label className="card flex max-w-3xl flex-1 items-center gap-3 px-5 py-3 text-slate-400">
              <Icon id="search" className="i h-5 w-5" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une chambre, une catégorie…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <button type="button" className="relative ml-auto p-2 text-dash-navy" aria-label="Notifications">
              <Icon id="bell" className="i h-6 w-6" />
              {chrome.messagesUnread > 0 && <span className="absolute right-0.5 top-0 grid h-4 w-4 place-items-center rounded-full bg-dash-brand text-[10px] font-bold text-white">{chrome.messagesUnread}</span>}
            </button>
            <div className="card flex items-center gap-3 py-2 pl-2 pr-4">
              <span className="avatar h-10 w-10 text-xs">{chrome.initials}</span>
              <div className="hidden text-xs sm:block"><p className="font-semibold">{chrome.displayName}</p><p className="text-slate-400">Gérant</p></div>
              <GerantLogoutButton className="ml-1" />
            </div>
          </header>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold">Mes chambres</h1>
              <p className="mt-1 text-sm text-slate-500">Gérez toutes vos chambres et suivez leur disponibilité.</p>
            </div>
            <Link to={`${chambresPath}/ajouter`} className="inline-flex items-center gap-3 rounded-lg bg-dash-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 hover:bg-dash-brand-dark"><Icon id="pc" className="i h-5 w-5" />Ajouter une chambre</Link>
          </div>

          {(error || loading || actionError) && (
            <p role={error || actionError ? 'alert' : undefined} className={`mt-4 text-sm ${error || actionError ? 'text-red-600' : 'text-slate-500'}`}>
              {error || actionError || 'Chargement de vos chambres...'}
            </p>
          )}

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <form className="card grid items-end gap-4 p-4 md:grid-cols-[1.5fr_1fr_1fr_auto]" onSubmit={(event) => event.preventDefault()}>
                <label className="field !rounded-xl !py-0">
                  <Icon id="search" className="i !static ml-4 !h-5 !w-5 !text-slate-500" />
                  <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une chambre..." className="w-full bg-transparent px-3 py-3.5 outline-none placeholder:text-slate-400" />
                </label>
                <label className="block text-xs font-medium">Catégorie
                  <span className="field mt-1.5">
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                      <option value="all">Toutes les catégories</option>
                      {categoryOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
                    </select>
                    <Icon id="down" />
                  </span>
                </label>
                <label className="block text-xs font-medium">Statut
                  <span className="field mt-1.5">
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'available' | 'occupied')}>
                      <option value="all">Tous les statuts</option>
                      <option value="available">Disponible</option>
                      <option value="occupied">Occupée</option>
                    </select>
                    <Icon id="down" />
                  </span>
                </label>
                <button type="button" className="btn !px-6 !py-3.5 !text-sm"><Icon id="filter" className="i h-5 w-5" />Filtres</button>
              </form>

              <div className="my-4 flex items-center justify-between px-1 text-xs">
                <p className="font-semibold">{filtered.length} chambre{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}</p>
                <label className="flex items-center gap-2 text-slate-500">Trier par :
                  <span className="field !text-xs"><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="!py-2 !pl-3 !pr-8"><option value="recent">Plus récent</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option></select><Icon id="down" /></span>
                </label>
              </div>

              {!loading && filtered.length === 0 && (
                <div className="card p-8 text-center text-sm text-slate-500">
                  <Icon id="bed" className="i mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold">{rooms.length === 0 ? 'Aucune chambre pour le moment' : 'Aucune chambre ne correspond à vos filtres'}</p>
                  <p className="mt-1 text-xs">{rooms.length === 0 ? 'Ajoutez votre première chambre pour la voir apparaître ici.' : 'Modifiez votre recherche ou vos filtres.'}</p>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                {filtered.map((room, index) => (
                  <article className="card p-2.5" key={room.id}>
                    <div className="relative h-36 overflow-hidden rounded-xl bg-gradient-to-br from-sky-300 to-amber-200">
                      {room.img ? (
                        <img src={room.img} alt={room.alt || room.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`} />
                      )}
                      <span className={`st ${room.disponible ? 'bg-emerald-500' : 'bg-slate-500/80'}`}>{room.disponible ? 'Disponible' : 'Occupée'}</span>
                      <button type="button" className="hb" aria-label="Ajouter aux favoris"><Icon id="heart" className="i h-4 w-4" /></button>
                    </div>
                    <div className="px-1.5 pb-1 pt-3">
                      <span className="tag">{categoryTitle(room.category)}</span>
                      <h3 className="mt-2 text-sm font-bold">{room.title}</h3>
                      <p className="meta mt-2"><Icon id="pin" />{formatLocation(room)}</p>
                      <div className="mt-2 flex gap-5"><span className="meta"><Icon id="bed" />{roomsLabel(room.chambres)}</span><span className="meta"><Icon id="drop" />{bathsLabel(room.douches)}</span></div>
                      <p className="mt-3 text-sm font-bold text-dash-brand-dark">{priceLabel(room)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <label className="tg">
                          <input type="checkbox" className="sr-only" checked={!room.disponible} disabled={busyId === room.id} onChange={() => handleToggle(room)} />
                          <span className="sw" />{room.disponible ? 'Désactiver' : 'Activer'}
                        </label>
                        <button type="button" onClick={() => handlePopular(room)} disabled={busyId === room.id} className={`btn flex-1 ${room.isPopular ? 'bg-blue-50 text-blue-700' : 'text-blue-700'}`}><Icon id="star" className="i h-4 w-4" />Populaire</button>
                        <button type="button" className="btn" aria-label="Plus d’actions"><Icon id="dots" className="i h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="space-y-5">
              <section className="card p-5">
                <h2 className="mb-4 font-bold">Aperçu de vos chambres</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="tile"><Icon id="bed" className="i h-6 w-6 text-slate-500" /><div className="text-center"><p className="text-2xl font-bold">{rooms.length}</p><p className="text-xs text-slate-500">Total</p></div></div>
                  <div className="tile"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><div className="text-center"><p className="text-2xl font-bold">{available}</p><p className="text-xs text-slate-500">Disponibles</p></div></div>
                  <div className="tile"><span className="h-2.5 w-2.5 rounded-full bg-dash-brand" /><div className="text-center"><p className="text-2xl font-bold">{occupied}</p><p className="text-xs text-slate-500">Occupées</p></div></div>
                  <div className="tile"><Icon id="star" className="i h-5 w-5 text-dash-brand" /><div className="text-center"><p className="text-2xl font-bold">{popular}</p><p className="text-xs text-slate-500">Populaires</p></div></div>
                </div>
              </section>

              <section className="card p-5">
                <h2 className="mb-2 font-bold">Catégories</h2>
                {categoryEntries.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500">Aucune catégorie pour le moment.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {categoryEntries.map((entry, index) => {
                      const style = CATEGORY_STYLES[index % CATEGORY_STYLES.length];
                      return (
                        <li className="row" key={entry.title}>
                          <span className={`ico ${style.cls}`}><Icon id={style.icon} /></span>
                          <span className="!ml-0 !text-dash-navy">{entry.title}</span>
                          <span>{entry.count}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card space-y-3 p-5">
                <h2 className="font-bold">Statut de vérification</h2>
                <Link to={`${gerantPath}/verification`} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-sm font-medium">
                  <Icon id="shieldf" className="i h-6 w-6 text-dash-navy" />Vérifié
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chrome.gerant?.is_verified ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>● {chrome.gerant?.is_verified ? 'Oui' : 'Non'}</span>
                  <Icon id="right" className="i h-4 w-4" />
                </Link>
                <Link to={`${gerantPath}/premium`} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-sm font-medium">
                  <Icon id="crown" className="i h-6 w-6 text-dash-brand" />Premium
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chrome.gerant?.is_premium ? 'bg-orange-100 text-dash-brand-dark' : 'bg-slate-100 text-slate-500'}`}>● {chrome.gerant?.is_premium ? 'Actif' : 'Inactif'}</span>
                  <Icon id="right" className="i h-4 w-4" />
                </Link>
              </section>

              <section className="flex gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <Icon id="bulb" className="i h-5 w-5 shrink-0 text-sky-500" />
                <div><p className="text-xs font-semibold">Astuce</p><p className="mt-1.5 text-xs leading-relaxed text-slate-600">Une chambre populaire attire plus de réservations. Mettez en avant vos meilleures annonces !</p></div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
