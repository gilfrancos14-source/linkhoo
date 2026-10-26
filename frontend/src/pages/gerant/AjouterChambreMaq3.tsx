import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { formatPrice } from '../../lib/roomDisplay';
import { emptyForm, type PreviewSnapshot } from './ajouter-chambre/form';
import AjouterChambreMaq3Form from './AjouterChambreMaq3Form';

function Icon({ id, className = 'i' }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

export default function AjouterChambreMaq3() {
  const homePath = useHomePath();
  const chrome = useGerantChrome();
  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const [preview, setPreview] = useState<PreviewSnapshot>({
    form: { ...emptyForm },
    photos: [],
    mainPhotoIndex: 0,
    categoryTitle: '',
  });
  const handlePreviewChange = useCallback(
    (snapshot: PreviewSnapshot) => setPreview(snapshot),
    [],
  );

  const previewPhoto =
    preview.photos[preview.mainPhotoIndex]?.preview ?? preview.photos[0]?.preview ?? '';
  const previewTitle = preview.form.title.trim() || 'Titre de la chambre';
  const previewLocation = [preview.form.quartier, preview.form.ville]
    .filter(Boolean)
    .join(', ');
  const previewPrice =
    preview.form.priceNum > 0
      ? `${formatPrice(preview.form.priceNum)} FCFA ${preview.form.priceUnit}`
      : '—';

  return (
    <div className="gerant-maq3 bg-[#f5f8fc] text-dash-navy antialiased">
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <symbol id="home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5" /></symbol>
        <symbol id="bed" viewBox="0 0 24 24"><path d="M3 20V5M3 16h18v4M21 16v-4a3 3 0 0 0-3-3h-7v7" /><circle cx="7" cy="11" r="1.5" /></symbol>
        <symbol id="cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></symbol>
        <symbol id="chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z" /></symbol>
        <symbol id="shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" /></symbol>
        <symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></symbol>
        <symbol id="crown" viewBox="0 0 24 24"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z" fill="currentColor" /></symbol>
        <symbol id="mega" viewBox="0 0 24 24"><path d="M3 11v3l12 5V6zM15 9a3 3 0 0 1 0 6M6 15l1 5h3l-1-4" /></symbol>
        <symbol id="down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
        <symbol id="up" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></symbol>
        <symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
        <symbol id="tag" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></symbol>
        <symbol id="bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" /></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></symbol>
        <symbol id="bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></symbol>
        <symbol id="doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 13h6M9 17h6" /></symbol>
        <symbol id="okdoc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM9 14l2 2 4-4" /></symbol>
        <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
        <symbol id="list" viewBox="0 0 24 24"><path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" /></symbol>
        <symbol id="back" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6" /></symbol>
        <symbol id="next" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
        <symbol id="info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></symbol>
        <symbol id="box" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 12l2 2 4-4" /></symbol>
        <symbol id="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></symbol>
        <symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></symbol>
        <symbol id="bot" viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 8V4M9 13h.01M15 13h.01M9 16.5h6" /></symbol>
      </svg>

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 lg:flex">
          <Link to={gerantPath} className="mb-6 flex items-center gap-2.5 px-2" aria-label="Linkhoo - retour à l'accueil">
            <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
          </Link>

          <nav className="space-y-3">
            <Link to={gerantPath} className="grp"><Icon id="home" />Aperçu</Link>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="bed" />Chambres</span><Icon id="up" className="i !h-4 !w-4" /></div>
              <div className="pl-2">
                <Link to={chambresPath} className="sub"><Icon id="list" />Toutes les chambres</Link>
                <Link to={`${chambresPath}/ajouter`} className="sub on" aria-current="page"><Icon id="plus" />Ajouter une chambre</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="cal" />Réservations{chrome.reservationsCount > 0 && <span className="badge">{chrome.reservationsCount}</span>}</div>
              <div className="pl-2">
                <Link to={`${gerantPath}/reservations/demandes`} className="sub"><Icon id="user" />Demandes</Link>
                <Link to={`${gerantPath}/reservations/calendrier`} className="sub"><Icon id="cal" />Calendrier</Link>
              </div>
            </div>

            <div>
              <div className="grp"><Icon id="chat" />Messages{chrome.messagesUnread > 0 && <span className="badge">{chrome.messagesUnread}</span>}</div>
              <div className="pl-2">
                <Link to={`${gerantPath}/messages/boite-reception`} className="sub"><Icon id="mail" />Boîte de réception</Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="shield" />Vérification</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2">
                <Link to={`${gerantPath}/verification`} className="sub"><Icon id="doc" />Mes documents</Link>
                <a href="#" className="sub"><Icon id="doc" />Suivi de vérification</a>
              </div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="user" />Profil</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2"><a href="#" className="sub"><Icon id="user" />Mes informations</a></div>
            </div>

            <div>
              <div className="grp"><Icon id="crown" className="i text-dash-brand" />Premium</div>
              <div className="pl-2"><a href="#" className="sub"><Icon id="cal" />Mon abonnement</a></div>
            </div>

            <div>
              <div className="grp justify-between"><span className="flex items-center gap-3"><Icon id="mega" />Booster</span><Icon id="down" className="i !h-4 !w-4" /></div>
              <div className="pl-2">
                <a href="#" className="sub"><Icon id="mega" />Campagnes</a>
                <a href="#" className="sub"><Icon id="mega" />Créer une campagne</a>
              </div>
            </div>
          </nav>

          <div className="mt-auto rounded-2xl border border-orange-100 bg-dash-brand-soft p-4 pt-5">
            <p className="flex items-center gap-2 text-sm font-bold"><Icon id="crown" className="i h-5 w-5 text-dash-brand" />Passez au Premium</p>
            <p className="mt-2 text-[11px] text-slate-500">Plus de visibilité, plus de réservations !</p>
            <a href="#" className="mt-3 block rounded-lg bg-dash-brand py-2 text-center text-xs font-semibold text-white hover:bg-dash-brand-dark">Voir les avantages</a>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-7">
          <header className="flex items-center gap-4">
            <label className="card flex max-w-3xl flex-1 items-center gap-3 px-5 py-3 text-slate-400">
              <Icon id="search" className="i h-5 w-5" />
              <input type="search" placeholder="Rechercher une chambre, une catégorie…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
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

          <Link to={chambresPath} className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-dash-navy"><Icon id="back" className="i h-4 w-4 text-dash-brand-dark" />Retour</Link>
          <h1 className="mt-3 text-3xl font-extrabold">Ajouter une chambre</h1>
          <p className="mt-1 text-sm text-slate-500">Suivez les étapes pour publier votre chambre rapidement.</p>

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-5">
              <AjouterChambreMaq3Form onPreviewChange={handlePreviewChange} />
            </div>

            <aside className="card p-5">
              <h2 className="mb-4 text-lg font-bold">Aperçu de votre chambre</h2>

              <div className="relative h-52 overflow-hidden rounded-xl bg-slate-100">
                {previewPhoto ? (
                  <img
                    src={previewPhoto}
                    alt={previewTitle}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center px-4 text-center text-xs text-slate-500">
                    Ajoutez une photo pour voir l&apos;aperçu
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">Aperçu</span>
              </div>
              {preview.photos.length > 0 && (
                <div className="mt-2.5 grid grid-cols-5 gap-2">
                  {preview.photos.map((photo, index) => (
                    <div
                      key={`${photo.preview}-${index}`}
                      className={`h-12 overflow-hidden rounded-lg bg-slate-100 ${index === preview.mainPhotoIndex ? 'ring-2 ring-dash-brand ring-offset-1' : ''}`}
                    >
                      <img src={photo.preview} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <dl className="mt-3 divide-y divide-slate-100">
                <div className="sum">
                  <Icon id="box" />
                  <dt className="font-medium">Catégorie</dt>
                  <dd title={preview.categoryTitle || '—'}>{preview.categoryTitle || '—'}</dd>
                </div>
                <div className="sum">
                  <Icon id="doc" />
                  <dt className="font-medium">Titre</dt>
                  <dd title={previewTitle}>{previewTitle}</dd>
                </div>
                <div className="sum">
                  <Icon id="bed" />
                  <dt className="font-medium">Localisation</dt>
                  <dd title={previewLocation || '—'}>{previewLocation || '—'}</dd>
                </div>
                <div className="sum">
                  <Icon id="coin" />
                  <dt className="font-medium">Prix</dt>
                  <dd title={previewPrice}>{previewPrice}</dd>
                </div>
              </dl>

              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-4">
                <div className="flex items-start gap-3">
                  <Icon id="chat" className="i h-6 w-6 shrink-0 text-sky-500" />
                  <div><p className="text-sm font-semibold">Besoin d’aide ?</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Notre assistant peut vous guider pas à pas pour ajouter votre chambre.</p></div>
                </div>
                <button type="button" className="mt-3 flex w-full items-center justify-center gap-3 rounded-lg border border-sky-100 bg-white py-3 text-xs font-semibold text-blue-700 hover:bg-sky-50"><Icon id="bot" className="i h-6 w-6" />Ouvrir l’assistant</button>
              </div>
            </aside>
          </div>

          <section className="card mt-5 flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-0">
            <div className="promise"><span><Icon id="okdoc" /></span><div><b>Votre annonce en ligne en quelques minutes</b><small>Simple, rapide et sécurisé.</small></div></div>
            <div className="hidden h-12 w-px bg-slate-200 md:mx-6 md:block"></div>
            <div className="promise"><span><Icon id="shield" /></span><div><b>Une équipe à votre écoute</b><small>En cas de besoin, nous sommes là pour vous.</small></div></div>
            <div className="hidden h-12 w-px bg-slate-200 md:mx-6 md:block"></div>
            <div className="promise"><span><Icon id="lock" /></span><div><b>Vos informations sont protégées</b><small>Confidentialité garantie.</small></div></div>
          </section>
        </main>
      </div>
    </div>
  );
}
