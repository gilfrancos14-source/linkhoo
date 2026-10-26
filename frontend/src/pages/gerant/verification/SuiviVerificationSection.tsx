import { Link } from 'react-router-dom';
import GerantLogoutButton from '../../../components/GerantLogoutButton';

interface SuiviVerificationSectionProps {
  gerantPath: string;
}

export default function SuiviVerificationSection({ gerantPath }: SuiviVerificationSectionProps) {
  const chambresPath = `${gerantPath}/chambres`;
  const reservationsPath = `${gerantPath}/reservations`;
  const messagesPath = `${gerantPath}/messages/boite-reception`;
  const suiviPath = `${gerantPath}/verification/suivi`;

  return (
    <div className="verif-maq flex min-h-screen">
      <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <defs>
          <g id="portrait">
            <rect width="100" height="100" fill="#E4E5E8" />
            <path d="M6 100c2-22 20-28 44-28s42 6 44 28z" fill="#17171A" />
            <path d="M41 56h18v20c-4 5-14 5-18 0z" fill="#5A3827" />
            <ellipse cx="50" cy="42" rx="17" ry="21" fill="#6B4430" />
            <path d="M32.5 38c-1-15 7-22 17.5-22s18.5 7 17.5 22c-3-7-9-10-17.5-10s-14.5 3-17.5 10z" fill="#111" />
            <ellipse cx="43" cy="42" rx="1.6" ry="1.2" fill="#1B120D" />
            <ellipse cx="57" cy="42" rx="1.6" ry="1.2" fill="#1B120D" />
            <path d="M47 45q3 3 6 0" stroke="#4E2F20" fill="none" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M42 51q8 8 16 0z" fill="#fff" />
          </g>
        </defs>

        <symbol id="i-ok" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="12" fill="#27B585" />
          <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>
        <symbol id="i-info" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="12" fill="#1D7CF2" />
          <rect x="10.8" y="10.5" width="2.4" height="7.5" rx="1.2" fill="#fff" />
          <circle cx="12" cy="7.2" r="1.5" fill="#fff" />
        </symbol>

        <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></symbol>
        <symbol id="i-bed" viewBox="0 0 24 24"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M12 4v6" /><path d="M2 18h20" /></symbol>
        <symbol id="i-calendar" viewBox="0 0 24 24"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></symbol>
        <symbol id="i-calendar-check" viewBox="0 0 24 24"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /></symbol>
        <symbol id="i-chat" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M8 10h8" /><path d="M8 14h5" /></symbol>
        <symbol id="i-chat-plus" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /><path d="M8 12h8" /><path d="M12 8v8" /></symbol>
        <symbol id="i-shield" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></symbol>
        <symbol id="i-shield-check" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></symbol>
        <symbol id="i-user-check" viewBox="0 0 24 24"><path d="m16 11 2 2 4-4" /><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></symbol>
        <symbol id="i-crown" viewBox="0 0 24 24"><path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.29L21.18 5.5a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.29z" /><path d="M5.5 21h13" /></symbol>
        <symbol id="i-megaphone" viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></symbol>
        <symbol id="i-list" viewBox="0 0 24 24"><path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13" /></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="M12 5v14" /></symbol>
        <symbol id="i-tag" viewBox="0 0 24 24"><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></symbol>
        <symbol id="i-inbox" viewBox="0 0 24 24"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></symbol>
        <symbol id="i-lock-user" viewBox="0 0 24 24"><rect width="16" height="11" x="4" y="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></symbol>
        <symbol id="i-file-text" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></symbol>
        <symbol id="i-file-pen" viewBox="0 0 24 24"><path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M13.38 15.63a1 1 0 1 0-3-3l-5.01 5.01a2 2 0 0 0-.5.85l-.84 2.87a.5.5 0 0 0 .62.62l2.87-.84a2 2 0 0 0 .85-.5z" /></symbol>
        <symbol id="i-clipboard" viewBox="0 0 24 24"><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h4" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></symbol>
        <symbol id="i-circle-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></symbol>
        <symbol id="i-headset" viewBox="0 0 24 24"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
        <symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
        <symbol id="i-chev-up" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6" /></symbol>
        <symbol id="i-chev-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></symbol>
        <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      </svg>

      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 overflow-y-auto border-r border-[#EEF2F8] bg-[#FBFCFE] pb-8 lg:block">
        <Link to={gerantPath} className="ml-[42px] mt-[15px] flex h-[35px] items-center">
          <img src="/logo.jpg" alt="Linkhoo" width="759" height="373" className="h-[35px] w-auto" />
        </Link>

        <nav className="mt-[26px] text-[#0F2150]">
          <Link to={gerantPath} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
            <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-home" /></svg>Aperçu
          </Link>

          <div className="mt-[11px]">
            <Link to={chambresPath} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-bed" /></svg>Chambres
              <svg className="ic ml-auto h-[13px] w-[13px] stroke-[2.2]"><use href="#i-chev-up" /></svg>
            </Link>
            <div className="mt-[5px]">
              <Link to={chambresPath} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-list" /></svg>Toutes les chambres</Link>
              <Link to={`${chambresPath}/ajouter`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-plus" /></svg>Ajouter une chambre</Link>
              <a href="#" className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-tag" /></svg>Catégories</a>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={reservationsPath} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-calendar" /></svg>Réservations
              <span className="-mr-2.5 ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#FFE4D2] text-[10px] font-bold text-[#F26B1D]">3</span>
            </Link>
            <div className="mt-[5px]">
              <Link to={`${reservationsPath}/demandes`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-lock-user" /></svg>Demandes</Link>
              <Link to={`${reservationsPath}/calendrier`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-calendar" /></svg>Calendrier</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={messagesPath} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-chat" /></svg>Messages
              <span className="-mr-2.5 ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#FFE4D2] text-[10px] font-bold text-[#F26B1D]">2</span>
            </Link>
            <div className="mt-[5px]">
              <Link to={messagesPath} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-inbox" /></svg>Boîte de réception</Link>
              <Link to={messagesPath} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-chat-plus" /></svg>Nouveau message</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/verification`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg bg-[#FDEDE2] px-[11px] text-[12.5px] font-bold text-[#F26B1D]">
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0" aria-hidden="true">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="#F26B1D" stroke="#F26B1D" strokeWidth="2" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>Vérification
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/verification`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-file-text" /></svg>Mes documents</Link>
              <Link to={suiviPath} aria-current="page" className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#F26B1D]"><svg className="ic h-[14px] w-[14px] shrink-0"><use href="#i-user-check" /></svg>Suivi de vérification</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/profil`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-user" /></svg>Profil
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/profil`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-user" /></svg>Mes informations</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/premium`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0 fill-[#F26B1D] text-[#F26B1D]"><use href="#i-crown" /></svg>Premium
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/premium`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-calendar" /></svg>Mon abonnement</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/boosts`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-megaphone" /></svg>Booster
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/boosts`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-megaphone" /></svg>Campagnes</Link>
              <Link to={`${gerantPath}/boosts/new`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-user-check" /></svg>Créer une campagne</Link>
            </div>
          </div>
        </nav>

        <div className="ml-[19px] mr-[16px] mt-[41px] h-[118px] rounded-xl border border-[#FEE3D1] bg-[#FFF2EA] px-[17px] pt-[14px]">
          <div className="flex items-center gap-[11px]">
            <svg className="ic h-[20px] w-[20px] fill-[#F26B1D] text-[#F26B1D]"><use href="#i-crown" /></svg>
            <p className="text-[11.5px] font-bold">Passez au Premium</p>
          </div>
          <p className="mt-[9px] text-[10px] leading-4 text-[#5F7396]">Plus de visibilité, plus de réservations !</p>
          <Link to={`${gerantPath}/premium`} className="mt-[11px] flex h-[28px] items-center justify-center rounded-lg bg-[#F26B1D] text-[11px] font-bold text-white shadow-sm transition hover:bg-[#E05A0C]">Voir les avantages</Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-[64px] items-center justify-between pl-[17px] pr-[26px]">
          <label className="flex h-9 w-full max-w-[590px] items-center gap-[15px] rounded-lg bg-white pl-6 pr-4 shadow-[0_1px_6px_rgba(20,40,90,0.05)] ring-1 ring-[#EEF2F8]">
            <svg className="ic h-[17px] w-[17px] shrink-0 text-[#0F2150]"><use href="#i-search" /></svg>
            <input type="search" placeholder="Rechercher une chambre, une catégorie..." className="w-full bg-transparent text-[11.5px] text-[#0F2150] placeholder:text-[#8A99B5] focus:outline-none" />
          </label>

          <div className="flex items-center gap-[28px]">
            <button type="button" aria-label="Notifications" className="relative text-[#0F2150]">
              <svg className="ic h-[20px] w-[20px]"><use href="#i-bell" /></svg>
              <span className="absolute -right-[9px] -top-[8px] grid h-[15px] w-[15px] place-items-center rounded-full bg-[#F26B1D] text-[9px] font-bold text-white">2</span>
            </button>

            <div className="flex h-[46px] w-[190px] items-center rounded-xl bg-white pl-[7px] pr-[9px] text-left shadow-[0_1px_6px_rgba(20,40,90,0.06)] ring-1 ring-[#EEF2F8]">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                <svg viewBox="0 0 100 100" className="h-full w-full"><use href="#portrait" /></svg>
              </span>
              <span className="ml-[11px] leading-none">
                <span className="block max-w-[95px] truncate text-[12px] font-bold">Koffi Mensah</span>
                <span className="mt-[7px] block text-[11px] text-[#8A99B5]">Gérant</span>
              </span>
              <GerantLogoutButton className="ml-auto" />
            </div>
          </div>
        </header>

        <main className="pb-10 pl-[23px] pr-[25px]">
          <Link to={`${gerantPath}/verification`} className="ml-[5px] mt-[15px] inline-flex h-5 items-center gap-[10px] text-[12.5px] font-bold">
            <svg className="ic h-[13px] w-[13px] stroke-[2.4]"><use href="#i-arrow-left" /></svg>Retour
          </Link>
          <h1 className="mt-[5px] text-[30px] font-extrabold leading-[34px] tracking-[-0.01em] text-[#0D2150]">Suivi de votre vérification</h1>
          <p className="text-[16px] leading-[22px] text-[#5F7396]">Suivez en temps réel l&apos;avancement de votre dossier de vérification.</p>

          <div className="mt-[18px] grid items-start gap-x-[19px] xl:grid-cols-[minmax(0,1fr)_364px]">
            <div>
              <ol className="flex h-[88px] items-center overflow-hidden rounded-xl border border-[#EEF2F8] bg-white pl-4 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <li className="flex shrink-0 items-center">
                  <span className="relative block h-[47px] w-[65px] rounded-xl bg-[#F4F6FB]">
                    <span className="absolute left-[7px] top-[6px] grid h-[34px] w-[34px] place-items-center rounded-full border-[1.5px] border-[#D5DEEE] bg-white text-[14px] font-bold text-[#1F3566]">1</span>
                    <svg className="absolute left-[46px] top-[6px] h-[18px] w-[18px] rounded-full ring-2 ring-[#F4F6FB]"><use href="#i-ok" /></svg>
                  </span>
                  <div className="ml-[14px] w-[108px]">
                    <p className="text-[12.5px] font-semibold leading-4 text-[#12285A]">Documents soumis</p>
                    <p className="mt-[5px] text-[10px] leading-[14px] text-[#8A99B5]">20 oct. 2026 <span className="mx-[3px]">•</span> 10:24</p>
                  </div>
                </li>
                <li aria-hidden="true" className="ml-[10px] h-px w-[40px] shrink-0 bg-[#DDE4F0]"></li>

                <li className="ml-[12px] flex h-[46px] w-[197px] shrink-0 items-center rounded-xl bg-gradient-to-r from-[#FFF0E5] to-[#FFF7F2] pl-[7px]" aria-current="step">
                  <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full bg-[#F26B1D] text-[14px] font-bold text-white ring-4 ring-[#FFE0CC]">2</span>
                  <div className="ml-[11px]">
                    <p className="text-[12.5px] font-bold leading-4 text-[#F26B1D]">En cours d&apos;examen</p>
                    <p className="mt-[5px] text-[10px] leading-[14px] text-[#F4905A]">20 oct. 2026 <span className="mx-[3px]">•</span> 14:32</p>
                  </div>
                </li>

                <li className="ml-[27px] flex shrink-0 items-center">
                  <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full border-[1.5px] border-[#D5DEEE] bg-white text-[14px] font-bold text-[#1F3566]">3</span>
                  <div className="ml-[13px] w-[99px]">
                    <p className="text-[12.5px] font-semibold leading-4 text-[#1F3566]">Validation finale</p>
                    <p className="mt-[5px] text-[10px] leading-[14px] text-[#8A99B5]">À venir</p>
                  </div>
                </li>
                <li aria-hidden="true" className="h-px w-[39px] shrink-0 bg-[#DDE4F0]"></li>

                <li className="ml-[10px] flex shrink-0 items-center">
                  <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full border-[1.5px] border-[#D5DEEE] bg-white text-[14px] font-bold text-[#1F3566]">4</span>
                  <div className="ml-[13px]">
                    <p className="text-[12.5px] font-semibold leading-4 text-[#1F3566]">Compte vérifié</p>
                    <p className="mt-[5px] text-[10px] leading-[14px] text-[#8A99B5]">À venir</p>
                  </div>
                </li>
              </ol>

              <section className="mt-[14px] rounded-xl border border-[#EEF2F8] bg-white pb-[17px] pl-4 pr-[16px] pt-[13px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <div className="relative flex h-[94px] items-start rounded-lg border border-[#D6E6F8] bg-[#EAF3FD] pl-[11px] pt-[11px]">
                  <span className="grid h-[61px] w-[61px] shrink-0 place-items-center rounded-full bg-[#D5E6FA]">
                    <svg className="ic h-[34px] w-[34px] stroke-[1.6] text-[#2F6BD6]"><use href="#i-clipboard" /></svg>
                  </span>
                  <div className="ml-[15px] pt-1">
                    <h2 className="text-[14px] font-bold leading-5">Votre dossier est en cours d&apos;examen</h2>
                    <p className="mt-[3px] whitespace-nowrap text-[12px] leading-5 text-[#5F7396]">Notre équipe vérifie actuellement les documents que vous avez fournis. Cette étape peut prendre<br />entre 24 et 48 heures selon la complexité de votre dossier.</p>
                  </div>
                  <span className="absolute right-4 top-[16px] flex h-6 w-[78px] items-center justify-center rounded-full bg-[#FFEBDD] text-[12px] font-bold text-[#F26B1D]">En cours</span>
                </div>

                <h2 className="ml-[2px] mt-[17px] text-[15px] font-bold leading-5">Détails de votre vérification</h2>

                <div className="relative mt-3 h-[404px] rounded-lg border border-[#E8EDF6] bg-white">
                  <span aria-hidden="true" className="absolute left-[30px] top-[45px] h-[57px] w-[2px] bg-[#7FD3B0]"></span>
                  <span aria-hidden="true" className="absolute left-[30px] top-[138px] h-[77px] w-[2px] bg-[#CBD3E3]"></span>
                  <span aria-hidden="true" className="absolute left-[30px] top-[251px] h-[60px] w-[2px] bg-[#CBD3E3]"></span>

                  <span className="absolute left-[14px] top-[11px] z-10 grid h-[34px] w-[34px] place-items-center rounded-full bg-[#21A872]">
                    <svg className="ic h-[17px] w-[17px] stroke-white stroke-[3]"><use href="#i-check" /></svg>
                  </span>
                  <span className="absolute left-[13px] top-[102px] z-10 grid h-[36px] w-[36px] place-items-center rounded-full border-2 border-[#F26B1D] bg-white">
                    <svg className="ic h-[17px] w-[17px] stroke-[2.2] text-[#F26B1D]"><use href="#i-search" /></svg>
                  </span>
                  <span className="absolute left-[13px] top-[215px] z-10 grid h-[36px] w-[36px] place-items-center rounded-full border border-[#D3DBEA] bg-[#E7ECF5]">
                    <svg className="ic h-[18px] w-[18px] stroke-[1.8] text-[#4A5B80]"><use href="#i-clock" /></svg>
                  </span>
                  <span className="absolute left-[13px] top-[311px] z-10 grid h-[36px] w-[36px] place-items-center rounded-full border border-[#D3DBEA] bg-[#E7ECF5]">
                    <svg className="ic h-[18px] w-[18px] stroke-[1.8] text-[#4A5B80]"><use href="#i-circle-check" /></svg>
                  </span>

                  <div className="relative h-[90px] pl-[66px] pr-4 pt-[11px]">
                    <h3 className="text-[13px] font-bold leading-[18px]">Documents soumis</h3>
                    <p className="mt-1 text-[11px] leading-4 text-[#5F7396]">20 oct. 2026 <span className="mx-[3px]">•</span> 10:24</p>
                    <p className="mt-1 text-[11.5px] leading-[18px] text-[#5F7396]">Vos documents ont été bien réceptionnés. Merci !</p>
                    <span className="absolute right-4 top-[16px] flex h-5 w-[63px] items-center justify-center rounded-full bg-[#E6F6EF] text-[11px] font-semibold text-[#2E9E78]">Terminé</span>
                  </div>

                  <div className="relative h-[116px] pl-[66px] pr-4 pt-[14px]">
                    <span aria-hidden="true" className="absolute left-[66px] right-4 top-0 h-px bg-[#EEF1F7]"></span>
                    <h3 className="text-[13px] font-bold leading-[18px]">Examen des documents</h3>
                    <p className="mt-[2px] text-[11px] leading-4 text-[#5F7396]">20 oct. 2026 <span className="mx-[3px]">•</span> 14:32</p>
                    <p className="mt-[3px] text-[11.5px] leading-[18px] text-[#5F7396]">Notre équipe vérifie l&apos;authenticité et la conformité de vos documents<br />(pièce d&apos;identité, justificatif de domicile, etc.).</p>
                    <span className="absolute right-4 top-[18px] flex h-[21px] w-[68px] items-center justify-center rounded-full bg-[#FFEBDD] text-[11px] font-semibold text-[#F26B1D]">En cours</span>
                  </div>

                  <div className="relative h-[95px] pl-[66px] pr-4 pt-3">
                    <span aria-hidden="true" className="absolute left-[66px] right-4 top-0 h-px bg-[#EEF1F7]"></span>
                    <h3 className="text-[13px] font-medium leading-[18px] text-[#2A3F6E]">Validation de votre profil</h3>
                    <p className="mt-[2px] text-[11px] leading-4 text-[#8A99B5]">À venir</p>
                    <p className="mt-1 text-[11px] leading-[18px] text-[#8A99B5]">Nous confirmons les informations de votre profil et de votre hébergement.</p>
                    <span className="absolute right-4 top-4 flex h-[21px] w-[71px] items-center justify-center rounded-full bg-[#EEF2F8] text-[10.5px] font-medium text-[#8B9BB8]">En attente</span>
                  </div>

                  <div className="relative h-[101px] pl-[66px] pr-4 pt-[13px]">
                    <span aria-hidden="true" className="absolute left-[66px] right-4 top-0 h-px bg-[#EEF1F7]"></span>
                    <h3 className="text-[13px] font-medium leading-[18px] text-[#2A3F6E]">Activation de votre compte</h3>
                    <p className="mt-[2px] text-[11px] leading-4 text-[#8A99B5]">À venir</p>
                    <p className="mt-1 text-[10.5px] leading-[15px] text-[#8A99B5]">Une fois la vérification terminée, votre compte sera activé et vous pourrez<br />publier des annonces.</p>
                    <span className="absolute right-4 top-[17px] flex h-[21px] w-[71px] items-center justify-center rounded-full bg-[#EEF2F8] text-[10.5px] font-medium text-[#8B9BB8]">En attente</span>
                  </div>
                </div>

                <div className="mt-[23px] flex h-[74px] items-center rounded-lg border border-[#DCE7F6] bg-[#EEF4FC] pl-5 pr-4">
                  <svg className="h-[26px] w-[26px] shrink-0"><use href="#i-info" /></svg>
                  <div className="ml-[17px]">
                    <h3 className="text-[12.5px] font-bold leading-4">Besoin d&apos;aide ?</h3>
                    <p className="mt-[5px] whitespace-nowrap text-[10.5px] leading-4 text-[#5F7396]">Si vous avez des questions ou si vous constatez un problème, notre équipe est là pour vous aider.</p>
                  </div>
                  <Link to="/contact" className="ml-auto flex h-10 w-[148px] shrink-0 items-center rounded-lg border border-[#E1E8F4] bg-white pl-[13px] text-[10.5px] font-bold text-[#2447A5] shadow-sm transition hover:bg-[#F7F9FD]">
                    <svg className="ic h-[18px] w-[18px] stroke-[1.75]"><use href="#i-headset" /></svg>
                    <span className="ml-[10px]">Contacter le support</span>
                  </Link>
                </div>
              </section>
            </div>

            <aside className="space-y-[14.5px]">
              <section className="h-[295px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <header className="flex h-[54px] items-center justify-between pl-[21px] pr-4">
                  <h2 className="flex items-center gap-[17px] text-[14.5px] font-bold tracking-[-0.01em]">
                    <svg className="ic h-6 w-6 stroke-[1.7] text-[#1B3A82]"><use href="#i-shield" /></svg>Résumé de votre dossier
                  </h2>
                  <span className="flex h-5 w-[62px] items-center justify-center rounded-full bg-[#E6F6EF] text-[10.5px] font-semibold text-[#2E9E78]">En cours</span>
                </header>

                <div className="mx-4 flex h-[85px] items-center rounded-lg border border-[#E8EDF6] bg-white pl-[13px]">
                  <span className="grid h-[61px] w-[61px] shrink-0 place-items-center rounded-full bg-[#FDE8DA]">
                    <svg className="ic h-[30px] w-[30px] stroke-[1.7] text-[#F26B1D]"><use href="#i-user" /></svg>
                  </span>
                  <div className="ml-[17px]">
                    <p className="text-[14px] font-bold leading-5">Koffi Mensah</p>
                    <p className="text-[11.5px] leading-5 text-[#3D4F73]">Gérant</p>
                    <p className="text-[10.5px] leading-5 text-[#5F7396]">koffi.mensah@exemple.com</p>
                  </div>
                </div>

                <ul className="mx-5 mt-[5px]">
                  <li className="flex h-[44px] items-center border-b border-[#EEF2F8]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#E6ECF5] bg-[#F7F9FD]"><svg className="ic h-[14px] w-[14px] stroke-[1.8] text-[#2F4C8F]"><use href="#i-calendar-check" /></svg></span>
                    <span className="ml-[15px] flex-1 text-[11.5px] text-[#3D4F73]">Type de compte</span>
                    <span className="text-[11.5px] font-medium">Gérant</span>
                  </li>
                  <li className="flex h-[44px] items-center border-b border-[#EEF2F8]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#E6ECF5] bg-[#F7F9FD]"><svg className="ic h-[14px] w-[14px] stroke-[1.8] text-[#2F4C8F]"><use href="#i-file-text" /></svg></span>
                    <span className="ml-[15px] flex-1 text-[11.5px] text-[#3D4F73]">Documents soumis</span>
                    <span className="text-[11.5px] font-medium">3 / 3</span>
                  </li>
                  <li className="flex h-[44px] items-center">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#E6ECF5] bg-[#F7F9FD]"><svg className="ic h-[14px] w-[14px] stroke-[1.8] text-[#2F4C8F]"><use href="#i-clock" /></svg></span>
                    <span className="ml-[15px] flex-1 text-[11.5px] text-[#3D4F73]">Dernière mise à jour</span>
                    <span className="text-[11.5px] font-medium">20 oct. 2026 <span className="mx-[2px]">•</span> 14:32</span>
                  </li>
                </ul>
              </section>

              <section className="h-[213px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <header className="flex h-11 items-center justify-between pl-[18px] pr-[18px] pt-1">
                  <h2 className="text-[14.5px] font-bold tracking-[-0.01em]">Vos documents</h2>
                  <Link to={`${gerantPath}/verification`} className="text-[11px] font-medium text-[#2F5FC4] hover:underline">Voir tous</Link>
                </header>

                <ul className="mx-4 mt-[8px] space-y-[6px]">
                  <li>
                    <Link to={`${gerantPath}/verification`} className="flex h-[45px] items-center rounded-lg border border-[#E6ECF5] bg-white pl-[10px] pr-[11px] shadow-sm transition hover:bg-[#F9FAFD]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center"><svg className="ic h-5 w-5 stroke-[1.7] text-[#2F5FC4]"><use href="#i-file-pen" /></svg></span>
                      <span className="ml-3 flex-1 text-[11.5px] font-semibold">Pièce d&apos;identité</span>
                      <span className="flex h-[18px] w-[50px] items-center justify-center rounded-full bg-[#E6F6EF] text-[10.5px] font-medium text-[#2E9E78]">Validé</span>
                      <svg className="ic ml-[9px] h-3 w-3 shrink-0 stroke-[2.2] text-[#0F2150]"><use href="#i-chev-right" /></svg>
                    </Link>
                  </li>
                  <li>
                    <Link to={`${gerantPath}/verification`} className="flex h-[45px] items-center rounded-lg border border-[#E6ECF5] bg-white pl-[10px] pr-[11px] shadow-sm transition hover:bg-[#F9FAFD]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center"><svg className="ic h-5 w-5 stroke-[1.7] text-[#F26B1D]"><use href="#i-file-text" /></svg></span>
                      <span className="ml-3 flex-1 text-[11.5px] font-semibold">Justificatif de domicile</span>
                      <span className="flex h-[18px] w-[50px] items-center justify-center rounded-full bg-[#E6F6EF] text-[10.5px] font-medium text-[#2E9E78]">Validé</span>
                      <svg className="ic ml-[9px] h-3 w-3 shrink-0 stroke-[2.2] text-[#0F2150]"><use href="#i-chev-right" /></svg>
                    </Link>
                  </li>
                  <li>
                    <Link to={`${gerantPath}/verification`} className="flex h-[45px] items-center rounded-lg border border-[#E6ECF5] bg-white pl-[10px] pr-[11px] shadow-sm transition hover:bg-[#F9FAFD]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FCE2EC]"><svg className="ic h-[18px] w-[18px] stroke-[1.8] text-[#E5457B]"><use href="#i-user" /></svg></span>
                      <span className="ml-3 flex-1 text-[11.5px] font-semibold">Photo de vous</span>
                      <span className="flex h-[18px] w-[57px] items-center justify-center rounded-full bg-[#FFEBDD] text-[10.5px] font-medium text-[#F26B1D]">En cours</span>
                      <svg className="ic ml-[9px] h-3 w-3 shrink-0 stroke-[2.2] text-[#0F2150]"><use href="#i-chev-right" /></svg>
                    </Link>
                  </li>
                </ul>
              </section>

              <section className="h-[242px] rounded-xl border border-[#EEF2F8] bg-white pb-[13px] pl-[9px] pr-[10px] pt-[7px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <div className="h-[220px] rounded-lg border border-[#DCE7F6] bg-[#EEF4FC] p-[10px] pt-[6px]">
                  <div className="flex items-start gap-[11px]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#DAE8FA]">
                      <svg className="ic h-5 w-5 stroke-[1.8] text-[#2F5FC4]"><use href="#i-shield-check" /></svg>
                    </span>
                    <div className="pt-[6px]">
                      <h3 className="text-[12px] font-bold leading-4">Pourquoi cette vérification ?</h3>
                      <p className="mt-[6px] whitespace-nowrap text-[10.5px] leading-[17.5px] text-[#5F7396]">La vérification permet de sécuriser la plateforme,<br />de protéger les voyageurs et de vous offrir plus<br />de visibilité.</p>
                    </div>
                  </div>
                  <ul className="ml-[48px] mt-[10px] text-[10px] text-[#5F7396]">
                    {['Confiance des voyageurs', 'Moins de risques de fraude', 'Accès aux fonctionnalités Premium', 'Meilleure visibilité de vos annonces'].map((item) => (
                      <li key={item} className="flex h-[27px] items-center gap-[11px]">
                        <svg className="h-[14px] w-[14px] shrink-0"><use href="#i-ok" /></svg>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
