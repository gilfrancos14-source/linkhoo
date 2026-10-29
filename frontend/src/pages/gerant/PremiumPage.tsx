import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { useGerantChrome } from '../../hooks/useGerantChrome';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { apiPremium } from '../../lib/api';
import { isPremiumActive } from '../../lib/premium';
import '../../styles/26-premium.css';
const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  'bed-double': (
    <>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M2 18h20" />
    </>
  ),
  'bed-single': (
    <>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M2 18h20" />
    </>
  ),
  'chevron-up': <path d="m18 15-6-6-6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
  tag: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  'calendar-check': (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  'calendar-clock': (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M12 14v3l2 1" />
    </>
  ),
  'clipboard-list': (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
  'message-circle': <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  'message-square-plus': (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 8v6" />
      <path d="M9 11h6" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  'file-text': (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  'file-check': (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  crown: (
    <>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </>
  ),
  megaphone: (
    <>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>
  ),
  'circle-plus': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  'trending-up': (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  'credit-card': (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </>
  ),
  headset: (
    <>
      <path d="M3 11h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M21 11h-3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
      <path d="M3 11v-1a9 9 0 0 1 18 0v1" />
      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
    </>
  ),
};

function Icon({
  name,
  className,
  filled = false,
}: {
  name: keyof typeof ICONS | string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const PREMIUM_PERKS = [
  'Visibilité prioritaire sur la plateforme',
  'Badge Premium sur vos annonces',
  'Accès aux statistiques de performance',
  'Support prioritaire',
];

function Perks({ extra }: { extra?: string }) {
  return (
    <ul className="ft">
      {PREMIUM_PERKS.map((perk) => (
        <li key={perk}>{perk}</li>
      ))}
      {extra && <li>{extra}</li>}
    </ul>
  );
}

export default function PremiumPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const { userId } = useAuth();
  const chrome = useGerantChrome();

  const gerantPath = `${homePath}/gerant`;
  const chambresPath = `${gerantPath}/chambres`;
  const messagesPath = `${gerantPath}/messages/boite-reception`;

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const isActive = isPremiumActive(chrome.gerant);

  const handlePremium = async () => {
    if (!userId || !chrome.gerant) return;
    setProcessing(true);
    setError('');
    try {
      const { payment_url, checkout_url } = await apiPremium.initiate(market);
      // Hub2 fournit `checkout_url` ; FedaPay `payment_url`. Le fallback garde
      // le rollback fonctionnel sans changement de front.
      const redirectUrl = checkout_url ?? payment_url;
      if (!redirectUrl) throw new Error('URL de paiement indisponible');
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'initiation du paiement");
      setProcessing(false);
    }
  };

  return (
    <div className="gerant-maq1 premium-maq min-h-screen bg-[#f5f8fc] text-[#0b1b3f] antialiased">
      <div className="flex min-h-screen">
        {/* ============ SIDEBAR ============ */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 lg:flex">
          <Link
            to={gerantPath}
            className="mb-6 flex items-center gap-2.5 px-2"
            aria-label="Linkhoo - retour à l'accueil"
          >
            <img className="sidebar-logo" src="/logo.jpg" alt="Logo Linkhoo" />
          </Link>

          <nav className="space-y-3">
            <Link to={gerantPath} className="grp">
              <Icon name="home" />Aperçu
            </Link>

            <div>
              <Link to={chambresPath} className="grp">
                <Icon name="bed-double" />Chambres
              </Link>
              <div className="pl-3">
                <Link to={chambresPath} className="sub">
                  <Icon name="tag" />Toutes les chambres
                </Link>
                <Link to={`${chambresPath}/ajouter`} className="sub">
                  <Icon name="plus" />Ajouter une chambre
                </Link>
              </div>
            </div>

            <div>
              <div className="grp">
                <Icon name="calendar" />Réservations
                {chrome.reservationsCount > 0 && (
                  <span className="badge">{chrome.reservationsCount}</span>
                )}
              </div>
              <div className="pl-3">
                <Link to={`${gerantPath}/reservations/demandes`} className="sub">
                  <Icon name="clipboard-list" />Demandes
                </Link>
                <Link to={`${gerantPath}/reservations/calendrier`} className="sub">
                  <Icon name="calendar" />Calendrier
                </Link>
              </div>
            </div>

            <div>
              <div className="grp">
                <Icon name="message-circle" />Messages
                {chrome.messagesUnread > 0 && (
                  <span className="badge">{chrome.messagesUnread}</span>
                )}
              </div>
              <div className="pl-3">
                <Link to={messagesPath} className="sub">
                  <Icon name="inbox" />Boîte de réception
                </Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between">
                <span className="flex items-center gap-3">
                  <Icon name="shield-check" />Vérification
                </span>
                <Icon name="chevron-down" className="!h-4 !w-4" />
              </div>
              <div className="pl-3">
                <Link to={`${gerantPath}/verification`} className="sub">
                  <Icon name="file-text" />Mes documents
                </Link>
                <Link to={`${gerantPath}/verification`} className="sub">
                  <Icon name="file-check" />Suivi de vérification
                </Link>
              </div>
            </div>

            <div>
              <div className="grp justify-between">
                <span className="flex items-center gap-3">
                  <Icon name="user" />Profil
                </span>
                <Icon name="chevron-down" className="!h-4 !w-4" />
              </div>
              <div className="pl-3">
                <Link to={`${gerantPath}/profil`} className="sub">
                  <Icon name="user" />Mes informations
                </Link>
              </div>
            </div>

            <div>
              <Link
                to={`${gerantPath}/premium`}
                className="grp rounded-xl bg-dash-brand-soft text-dash-brand-dark"
              >
                <Icon name="crown" className="text-dash-brand" />Premium
              </Link>
              <div className="pl-3">
                <Link to={`${gerantPath}/premium`} className="sub on">
                  <Icon name="calendar-check" />Mon abonnement
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-dash-brand" />
                </Link>
              </div>
            </div>
          </nav>

          <div className="mt-auto rounded-2xl border border-orange-100 bg-dash-brand-soft p-4 pt-5">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Icon name="crown" className="h-5 w-5 text-dash-brand" />Passez au Premium
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Plus de visibilité, plus de réservations !
            </p>
            <a
              href="#offres"
              className="mt-3 block rounded-lg bg-dash-brand py-2 text-center text-xs font-semibold text-white hover:bg-dash-brand-dark"
            >
              Voir les avantages
            </a>
          </div>
        </aside>

        {/* ============ MAIN ============ */}
        <main className="min-w-0 flex-1 px-4 py-4 lg:px-7">
          {/* Header */}
          <header className="flex items-center gap-4">
            <label className="card flex max-w-3xl flex-1 items-center gap-3 px-5 py-3 text-slate-400">
              <Icon name="search" className="h-5 w-5" />
              <input
                type="search"
                placeholder="Rechercher une chambre, une catégorie…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              type="button"
              className="relative ml-auto p-2 text-dash-navy"
              aria-label="Notifications"
            >
              <Icon name="bell" className="h-6 w-6" />
              {chrome.messagesUnread > 0 && (
                <span className="absolute right-0.5 top-0 grid h-4 w-4 place-items-center rounded-full bg-dash-brand text-[10px] font-bold text-white">
                  {chrome.messagesUnread}
                </span>
              )}
            </button>
            <div className="card flex items-center gap-3 py-2 pl-2 pr-4">
              <span className="avatar h-10 w-10 text-xs">{chrome.initials}</span>
              <div className="hidden text-xs sm:block">
                <p className="font-semibold">{chrome.displayName}</p>
                <p className="text-slate-400">Gérant</p>
              </div>
              <GerantLogoutButton className="ml-1" />
            </div>
          </header>

          <div className="grid grid-cols-[minmax(0,1fr)_clamp(300px,24vw,372px)] gap-[27px] pb-10 pt-6 max-xl:grid-cols-1">
          {/* ===== Colonne gauche ===== */}
          <section>
            <Link
              to={`${gerantPath}/profil`}
              className="mt-1 inline-flex items-center gap-2 text-[13px] font-medium text-[#2f5bbf]"
            >
              <Icon name="arrow-left" className="h-4 w-4" />
              Retour à mon profil
            </Link>
            <h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight">
              Abonnez-vous au <span className="text-[#ff5a14]">Premium</span>
            </h1>
            <p className="text-[17.5px] font-medium text-[#2f5bbf]">
              Boostez la visibilité de vos chambres et attirez plus de voyageurs
            </p>
            <p className="mt-5 max-w-[540px] text-[13.5px] leading-[1.5] text-[#5f86d1]">
              Le plan Premium vous permet de mettre en avant vos annonces, d’apparaître en premier
              sur la plateforme et d’accéder à des outils puissants pour augmenter vos réservations.
            </p>

            {/* Hero */}
            <section className="relative mt-6 h-[198px] overflow-hidden rounded-lg bg-gradient-to-r from-[#0a1a42] via-[#0e275c] to-[#14306a] text-white">
              <img
                src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=70"
                alt=""
                className="absolute inset-y-0 right-0 h-full w-[52%] object-cover"
                onError={(event) => {
                  event.currentTarget.src = '/images/pexels-artbovich-6782567.webp';
                }}
                style={{
                  maskImage: 'linear-gradient(to right, transparent, #000 45%)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent, #000 45%)',
                }}
              />
              <div className="relative px-[27px] pt-[15px]">
                <div className="flex items-center">
                  <Icon
                    name="crown"
                    className="z-10 h-8 w-8 text-[#ff5a14]"
                    filled
                  />
                  <span className="-ml-3 flex h-[22px] items-center rounded-full border border-amber-300/50 bg-white/10 pl-5 pr-3 text-[11px] font-semibold tracking-wide">
                    OFFRE PREMIUM
                  </span>
                </div>
                <h2 className="mt-3 text-[25px] font-extrabold leading-tight">
                  Votre hébergement mérite d’être vu !
                </h2>
                <p className="mt-2 text-[14.5px] font-semibold">
                  Rejoignez les gérants Premium et multipliez vos réservations.
                </p>
                <div className="mt-5 flex items-center gap-[clamp(12px,1.8vw,28px)]">
                  <div className="stat">
                    <span>
                      <Icon name="eye" className="h-5 w-5" />
                    </span>
                    <span>
                      <b>+3x</b>
                      <small>plus de visibilité</small>
                    </span>
                  </div>
                  <div className="stat">
                    <span className="!bg-[#ff5a14] ring-[7px] ring-[#ff5a14]/20">
                      <Icon name="calendar-check" className="h-5 w-5" />
                    </span>
                    <span>
                      <b>+60%</b>
                      <small>de réservations en moyenne</small>
                    </span>
                  </div>
                  <div className="stat">
                    <span>
                      <Icon name="star" className="h-5 w-5 text-white" filled />
                    </span>
                    <span>
                      <b className="!text-[14px]">Un badge Premium</b>
                      <small>qui inspire confiance</small>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Offres */}
            <div id="offres" className="mt-7 flex items-center gap-3">
              <Icon name="crown" className="h-6 w-6 text-[#ff5a14]" filled />
              <h2 className="text-[18px] font-bold">Nos offres Premium</h2>
            </div>
            <p className="ml-9 text-[12.5px] text-[#5f86d1]">
              Choisissez la formule qui correspond le mieux à vos besoins.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-[17px] max-md:grid-cols-1">
              {/* Mensuel */}
              <article className="plan">
                <div className="flex items-center gap-3">
                  <span className="ico">
                    <Icon name="calendar" className="h-[18px] w-[18px]" />
                  </span>
                  <h3>Mensuel</h3>
                </div>
                <p className="d">Idéal pour tester et booster rapidement vos annonces.</p>
                <div className="pr">
                  <b>15 000</b>
                  <span>FCFA / mois</span>
                </div>
                <div className="old"></div>
                <button type="button" className="cta" onClick={handlePremium} disabled={processing}>
                  Choisir cette formule
                </button>
                <Perks />
              </article>

              {/* Trimestriel (populaire) */}
              <article className="plan !border-2 !border-[#ff5a14] !bg-[#fffaf7] shadow-[0_6px_20px_rgba(255,90,20,.12)]">
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff5a14] px-3 py-[3px] text-[11px] font-bold text-white">
                  Le plus populaire
                </span>
                <div className="flex items-center gap-3">
                  <span className="ico !bg-[#ffe9dc] !text-[#ff5a14]">
                    <Icon name="calendar" className="h-[18px] w-[18px]" />
                  </span>
                  <h3>Trimestriel</h3>
                </div>
                <p className="d">Le meilleur équilibre entre économies et performance.</p>
                <div className="pr">
                  <b>40 000</b>
                  <span>FCFA / 3 mois</span>
                </div>
                <div className="old">
                  <s>45 000 FCFA</s>
                  <em>-11%</em>
                </div>
                <button
                  type="button"
                  className="cta !border-0 !bg-gradient-to-b !from-[#ff6a22] !to-[#ff5210] !text-white shadow-[0_4px_10px_rgba(255,90,20,.35)]"
                  onClick={handlePremium}
                  disabled={processing}
                >
                  Choisir cette formule
                </button>
                <Perks />
              </article>

              {/* Annuel */}
              <article className="plan">
                <div className="flex items-center gap-3">
                  <span className="ico">
                    <Icon name="calendar" className="h-[18px] w-[18px]" />
                  </span>
                  <h3>Annuel</h3>
                </div>
                <p className="d">Maximisez vos résultats et économisez sur le long terme.</p>
                <div className="pr">
                  <b>150 000</b>
                  <span>FCFA / an</span>
                </div>
                <div className="old">
                  <s>180 000 FCFA</s>
                  <em>-17%</em>
                </div>
                <button type="button" className="cta" onClick={handlePremium} disabled={processing}>
                  Choisir cette formule
                </button>
                <Perks extra="1 mois offert" />
              </article>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] leading-[1.5] text-red-800"
              >
                <Icon name="info" className="mt-px h-[18px] w-[18px] flex-none" />
                {error}
              </div>
            )}

            {/* Bandeau CTA */}
            <div className="mt-6 flex items-center gap-4 rounded-xl bg-[#fff1e8] px-[18px] py-[17px] max-md:flex-wrap">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#ffe0cf] text-[#ff5a14]">
                <Icon name="trending-up" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold text-[#ff5a14]">
                  Investissez aujourd’hui dans plus de réservations demain !
                </h3>
                <p className="mt-1 text-[12px] text-[#2f5bbf]">
                  Le Premium, c’est un petit coût aujourd’hui, mais un grand impact sur vos revenus.
                </p>
              </div>
              <a
                href="#offres"
                className="flex h-10 items-center gap-2.5 rounded-md bg-[#ff5a14] px-5 text-[13px] font-semibold text-white"
              >
                Choisir une formule
                <Icon name="arrow-right" className="h-4 w-4" />
              </a>
            </div>
          </section>

          {/* ===== Colonne droite ===== */}
          <aside className="mt-[26px] space-y-5 max-xl:mt-0">
            <div className="overflow-hidden rounded-xl border border-[#e6ebf5] bg-white shadow-[0_2px_10px_rgba(20,50,120,.03)]">
              {/* En-tête sombre */}
              <div className="relative bg-gradient-to-br from-[#0a1b45] via-[#0d2658] to-[#13306a] px-[22px] pb-[18px] pt-[22px] text-white">
                <div className="flex items-center gap-3">
                  <Icon name="crown" className="h-9 w-9 text-[#ff5a14]" filled />
                  <div>
                    <div className="text-[22px] font-bold leading-tight">Premium</div>
                    <div className="text-[14px] text-white/85">Votre visibilité, notre priorité</div>
                  </div>
                </div>
                <Icon
                  name="rocket"
                  className="absolute right-7 top-5 h-14 w-14 -rotate-12 text-white drop-shadow-[0_0_14px_rgba(255,120,40,.8)]"
                />
                <div className="mt-[18px] flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-r from-white/10 to-amber-200/30 px-3.5 text-[13px] font-semibold">
                  Actuellement : Plan {isActive ? 'Premium' : 'Gratuit'}
                  <Icon name="info" className="h-4 w-4 text-white/80" />
                </div>
              </div>

              {/* Pourquoi */}
              <div className="px-[22px] pb-7 pt-5">
                <h2 className="text-[16px] font-bold">Pourquoi passer au Premium ?</h2>
                <div className="mt-5 space-y-[22px]">
                  <div className="why">
                    <span>
                      <Icon name="rocket" className="h-6 w-6" />
                    </span>
                    <div>
                      <h4>Vos annonces en tête de liste</h4>
                      <p>Soyez visible en priorité dans les résultats de recherche.</p>
                    </div>
                  </div>
                  <div className="why">
                    <span>
                      <Icon name="calendar-clock" className="h-6 w-6" />
                    </span>
                    <div>
                      <h4>Plus de réservations</h4>
                      <p>Attirez plus de voyageurs grâce à une meilleure visibilité.</p>
                    </div>
                  </div>
                  <div className="why">
                    <span>
                      <Icon name="star" className="h-5 w-5 text-[#2f5bbf]" filled />
                    </span>
                    <div>
                      <h4>Un badge de confiance</h4>
                      <p>Inspirez confiance et crédibilité auprès des clients.</p>
                    </div>
                  </div>
                  <div className="why">
                    <span>
                      <Icon name="calendar-check" className="h-6 w-6" />
                    </span>
                    <div>
                      <h4>Des outils avancés</h4>
                      <p>
                        Accédez aux statistiques et suivez la performance de vos annonces.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Paiement sécurisé */}
            <div className="box !p-[20px]">
              <div className="flex gap-3.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[#eaf0fb] text-[#2f5bbf]">
                  <Icon name="credit-card" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[14px] font-bold">Paiement sécurisé</h3>
                  <p className="mt-1 text-[12.5px] leading-[1.45] text-[#5f86d1]">
                    Vos informations sont protégées par un système de paiement 100% sécurisé.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2.5 pl-[50px]">
                <div className="grid h-[33px] w-[62px] place-items-center rounded-md bg-white text-[17px] font-black italic tracking-tight text-[#1a1f71] ring-1 ring-[#e6ebf5]">
                  VISA
                </div>
                <div className="grid h-[33px] w-[50px] place-items-center rounded-md bg-[#fff1e3]">
                  <span className="relative block h-[18px] w-[28px]">
                    <i className="absolute left-0 h-[18px] w-[18px] rounded-full bg-[#eb001b]"></i>
                    <i className="absolute right-0 h-[18px] w-[18px] rounded-full bg-[#f79e1b] mix-blend-multiply"></i>
                  </span>
                </div>
                <div className="grid h-[33px] w-[70px] place-items-center rounded-md bg-[#ffcc2f] text-[8px] font-bold text-[#1c1c1c]">
                  MTN Money
                </div>
                <div className="grid h-[33px] w-[74px] place-items-center rounded-md bg-[#dbe9fb] text-[8px] font-bold text-[#1f56c4]">
                  Moov Money
                </div>
              </div>
            </div>

            {/* Une question */}
            <div className="box !p-[20px]">
              <div className="flex gap-3.5">
                <Icon name="headset" className="h-8 w-8 flex-none text-[#ff5a14]" />
                <div>
                  <h3 className="text-[15px] font-bold text-[#ff5a14]">Une question ?</h3>
                  <p className="mt-1 text-[12.5px] leading-[1.45] text-[#5f86d1]">
                    Notre équipe est disponible pour vous aider à choisir la formule qui vous
                    convient.
                  </p>
                </div>
              </div>
              <Link
                to={`/${market.toLowerCase()}/contact`}
                className="ml-[46px] mt-4 inline-grid h-[34px] place-items-center rounded-md border border-[#2f5bbf] bg-white px-4 text-[12.5px] font-semibold text-[#2f5bbf]"
              >
                Contacter le support
              </Link>
            </div>
          </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
