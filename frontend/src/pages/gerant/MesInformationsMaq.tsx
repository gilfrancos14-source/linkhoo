import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../../hooks/useHomePath';
import GerantLogoutButton from '../../components/GerantLogoutButton';
import { useMarket } from '../../contexts/MarketContext';
import { marketByCode } from '../../config/markets';
import {
  apiGerants,
  type GerantData,
  type VerificationDocType,
  type VerificationStatusResponse,
} from '../../lib/api';
import { isPremiumActive } from '../../lib/premium';
import { formatDateLong } from '../../lib/formatDate';

type PreferenceKey = 'reservations' | 'messages' | 'marketing';
type AccountRowStatus = 'validated' | 'progress' | 'rejected' | 'missing' | 'unknown';

const DOC_LABELS: Record<VerificationDocType, string> = {
  national_id: "Pièce d'identité",
  proof_of_address: 'Justificatif de domicile',
  selfie: 'Photo de vous',
};

const ACCOUNT_STATUS_LABEL: Record<AccountRowStatus, string> = {
  validated: 'Validé',
  progress: 'En attente',
  rejected: 'Rejeté',
  missing: 'À fournir',
  unknown: '—',
};

const ACCOUNT_STATUS_BADGE: Record<AccountRowStatus, string> = {
  validated: 'bg-[#E6F6EF] text-[#3AA57D]',
  progress: 'bg-[#FFF1E8] text-[#F26B1D]',
  rejected: 'bg-[#FDE8E8] text-[#D64545]',
  missing: 'bg-[#EDF1F8] text-[#8393B0]',
  unknown: 'bg-[#EDF1F8] text-[#8393B0]',
};

export default function MesInformationsMaq() {
  const homePath = useHomePath();
  const { market } = useMarket();
  const gerantPath = `${homePath}/gerant`;
  const suiviPath = `${gerantPath}/verification/suivi`;
  const modifierPath = `${gerantPath}/profil/modifier`;

  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [verification, setVerification] = useState<VerificationStatusResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>({
    reservations: true,
    messages: true,
    marketing: false,
  });

  useEffect(() => {
    let cancelled = false;
    apiGerants
      .getMe()
      .then(async (data) => {
        if (cancelled) return;
        setGerant(data);
        try {
          const status = await apiGerants.getVerificationStatus(data.id);
          if (!cancelled) setVerification(status);
        } catch {
          if (!cancelled) setVerification(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Impossible de charger votre profil.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fullName = [gerant?.prenom, gerant?.nom].filter(Boolean).join(' ') || '—';
  const email = gerant?.email || '—';
  const phone = gerant?.phone || '—';
  const marketLabel = marketByCode(market).label;
  const verified = Boolean(gerant?.is_verified);
  const premium = isPremiumActive(gerant);
  const birthDate = formatDateLong(gerant?.date_of_birth) || '—';
  const nationality = gerant?.nationality || '—';
  const address = gerant?.address || '—';
  const memberSince = formatDateLong(gerant?.created_at) || '—';
  const personalInfoComplete = Boolean(
    gerant?.nom &&
      gerant?.prenom &&
      gerant?.phone &&
      gerant?.address &&
      gerant?.date_of_birth &&
      gerant?.nationality,
  );
  const verificationStatus =
    verification?.verification_status ?? gerant?.verification_status ?? 'none';
  const verificationLabel =
    verificationStatus === 'approved'
      ? 'Validée'
      : verificationStatus === 'rejected'
        ? 'Rejetée'
        : verificationStatus === 'pending' || verificationStatus === 'under_review'
          ? 'En cours'
          : 'À compléter';
  const documentsByType = new Map(
    (verification?.documents ?? []).map((doc) => [doc.document_type, doc]),
  );
  const docStatus = (type: VerificationDocType): AccountRowStatus => {
    if (!verification) return 'unknown';
    const doc = documentsByType.get(type);
    if (!doc) return 'missing';
    if (doc.status === 'approved') return 'validated';
    if (doc.status === 'rejected') return 'rejected';
    return 'progress';
  };
  const accountRows: Array<{ label: string; status: AccountRowStatus }> = [
    { label: 'Informations personnelles', status: personalInfoComplete ? 'validated' : 'missing' },
    { label: DOC_LABELS.national_id, status: docStatus('national_id') },
    { label: DOC_LABELS.proof_of_address, status: docStatus('proof_of_address') },
    { label: DOC_LABELS.selfie, status: docStatus('selfie') },
  ];
  const profileUpToDate = personalInfoComplete && verified;

  const togglePreference = (key: PreferenceKey) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
          <g id="portrait-suit">
            <rect width="100" height="100" fill="#E6E7EA" />
            <path d="M0 100V90c3-14 18-19 34-21h32c16 2 31 7 34 21v10z" fill="#1F2B49" />
            <path d="M37 69h26L50 94z" fill="#F4F5F7" />
            <path d="M37 69 46 96 34 100H20zM63 69 54 96l12 4h14z" fill="#18233D" />
            <path d="M42 54h16v16c-4 4-12 4-16 0z" fill="#5A3827" />
            <ellipse cx="50" cy="38" rx="17" ry="21" fill="#6B4430" />
            <path d="M32.5 34c-1-15 7-22 17.5-22s18.5 7 17.5 22c-3-7-9-10-17.5-10s-14.5 3-17.5 10z" fill="#111" />
            <ellipse cx="43" cy="38" rx="1.6" ry="1.2" fill="#1B120D" />
            <ellipse cx="57" cy="38" rx="1.6" ry="1.2" fill="#1B120D" />
            <path d="M47 41q3 3 6 0" stroke="#4E2F20" fill="none" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M42 47q8 8 16 0z" fill="#fff" />
          </g>
        </defs>

        <symbol id="i-ok" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="12" fill="#27B585" />
          <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>

        <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></symbol>
        <symbol id="i-bed" viewBox="0 0 24 24"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /><path d="M12 4v6" /><path d="M2 18h20" /></symbol>
        <symbol id="i-calendar" viewBox="0 0 24 24"><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></symbol>
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
        <symbol id="i-briefcase" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></symbol>
        <symbol id="i-camera" viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></symbol>
        <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></symbol>
        <symbol id="i-headset" viewBox="0 0 24 24"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /></symbol>
        <symbol id="i-mail" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></symbol>
        <symbol id="i-phone" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></symbol>
        <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></symbol>
        <symbol id="i-box" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></symbol>
        <symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
        <symbol id="i-chev-up" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6" /></symbol>
        <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></symbol>
        <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      </svg>

      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 overflow-y-auto border-r border-[#EEF2F8] bg-[#FBFCFE] pb-8 lg:block">
        <Link to={gerantPath} className="ml-[42px] mt-[15px] flex h-[35px] items-center">
          <img src="/logo.jpg" alt="Linkhoo" width="759" height="373" className="h-[35px] w-auto" />
        </Link>

        <nav className="mt-[26px] text-[#0F2150]">
          <Link to={gerantPath} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
            <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-home" /></svg>Aperçu
          </Link>

          <div className="mt-[11px]">
            <Link to={`${gerantPath}/chambres`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-bed" /></svg>Chambres
              <svg className="ic ml-auto h-[13px] w-[13px] stroke-[2.2]"><use href="#i-chev-up" /></svg>
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/chambres`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-list" /></svg>Toutes les chambres</Link>
              <Link to={`${gerantPath}/chambres/ajouter`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-plus" /></svg>Ajouter une chambre</Link>
              <a href="#" className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-tag" /></svg>Catégories</a>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/reservations`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-calendar" /></svg>Réservations
              <span className="-mr-2.5 ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#FFE4D2] text-[10px] font-bold text-[#F26B1D]">3</span>
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/reservations/demandes`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-lock-user" /></svg>Demandes</Link>
              <Link to={`${gerantPath}/reservations/calendrier`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-calendar" /></svg>Calendrier</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/messages/boite-reception`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-chat" /></svg>Messages
              <span className="-mr-2.5 ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#FFE4D2] text-[10px] font-bold text-[#F26B1D]">2</span>
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/messages/boite-reception`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-inbox" /></svg>Boîte de réception</Link>
              <Link to={`${gerantPath}/messages/boite-reception`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-chat-plus" /></svg>Nouveau message</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={`${gerantPath}/verification`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-shield" /></svg>Vérification
              <svg className="ic ml-auto h-[13px] w-[13px] stroke-[2.2]"><use href="#i-chev-down" /></svg>
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/verification`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-file-text" /></svg>Mes documents</Link>
              <Link to={suiviPath} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-user-check" /></svg>Suivi de vérification</Link>
            </div>
          </div>

          <div className="mt-[18px]">
            <Link to={gerantPath + '/profil'} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
              <svg className="ic h-[19px] w-[19px] shrink-0"><use href="#i-user" /></svg>Profil
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/profil`} aria-current="page" className="mx-[19px] flex h-7 items-center gap-[13px] rounded-lg bg-[#FDEDE2] pl-[25px] text-[11.5px] font-medium text-[#F26B1D]"><svg className="ic h-[14px] w-[14px] shrink-0"><use href="#i-user" /></svg>Mes informations</Link>
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
        <header className="flex h-[64px] items-center justify-between pl-[19px] pr-[26px]">
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
                <span className="block max-w-[95px] truncate text-[12px] font-bold">{fullName}</span>
                <span className="mt-[7px] block text-[11px] text-[#8A99B5]">Gérant</span>
              </span>
              <GerantLogoutButton className="ml-auto" />
            </div>
          </div>
        </header>

        <main className="pb-10 pl-[22px] pr-[25px]">
          <div className="grid gap-x-5 xl:grid-cols-[minmax(0,1fr)_381px]">
            <div className="pt-[15px]">
              <Link to={gerantPath} className="ml-[6px] inline-flex h-5 items-center gap-[10px] text-[12.5px] font-bold">
                <svg className="ic h-[13px] w-[13px] stroke-[2.4]"><use href="#i-arrow-left" /></svg>Retour
              </Link>
              <h1 className="mt-1 text-[31px] font-extrabold leading-8 tracking-[-0.01em] text-[#0D2150]">Mes informations</h1>
              <p className="-mt-px text-[15px] leading-[18px] text-[#5F7396]">Gérez vos informations personnelles et professionnelles.</p>
              {loadError && (
                <p role="alert" className="mt-2 text-[12px] font-semibold text-red-600">{loadError}</p>
              )}

              <section className="relative mt-[13px] h-[151px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <div className="absolute left-[21px] top-[19px] h-[111px] w-[114px]">
                  <div className="h-full w-full overflow-hidden rounded-[20px]">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-label="Photo de profil"><use href="#portrait-suit" /></svg>
                  </div>
                  <span className="absolute bottom-[6px] right-[3px] grid h-[22px] w-[22px] place-items-center rounded-full bg-[#1D7CF2] ring-2 ring-white">
                    <svg className="ic h-3 w-3 stroke-white stroke-[2.2]"><use href="#i-camera" /></svg>
                  </span>
                </div>

                <div className="absolute left-[162px] top-[21px]">
                  <div className="flex h-7 items-center gap-[10px]">
                    <h2 className="text-[20px] font-bold tracking-[-0.01em]">{fullName}</h2>
                    <span className="rounded-full bg-[#E6F6EF] px-[10px] py-[2px] text-[12px] font-semibold leading-4 text-[#2E9E78]">{verified ? 'Gérant vérifié' : 'Gérant'}</span>
                  </div>
                  <ul className="mt-[3px]">
                    <li className="flex h-[26px] items-center gap-2 text-[13.5px] text-[#1E3A74]"><svg className="ic ml-px h-4 w-4 shrink-0 stroke-[1.75] text-[#40527C]"><use href="#i-mail" /></svg>{email}</li>
                    <li className="flex h-[27px] items-center gap-2 text-[13.5px] text-[#5F7396]"><svg className="ic ml-px h-4 w-4 shrink-0 stroke-[1.75] text-[#40527C]"><use href="#i-phone" /></svg>{phone}</li>
                    <li className="flex h-[26px] items-center gap-2 text-[13.5px] text-[#5F7396]"><svg className="ic ml-px h-4 w-4 shrink-0 stroke-[1.75] text-[#40527C]"><use href="#i-pin" /></svg>{marketLabel}</li>
                  </ul>
                </div>

                <Link to={modifierPath} className="absolute right-5 top-[17px] flex h-[31px] w-[130px] items-center justify-center gap-[9px] rounded-lg border border-[#E1E8F4] bg-white text-[11px] font-semibold shadow-sm transition hover:bg-[#F7F9FD]">
                  <svg className="ic h-[13px] w-[13px] stroke-[1.9]"><use href="#i-pencil" /></svg>Modifier le profil
                </Link>
              </section>

              <section className="relative mt-[15px] h-[286px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <h2 className="absolute left-6 top-[14px] flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
                  <svg className="ic h-5 w-5 stroke-[1.75] text-[#2F5FC4]"><use href="#i-user" /></svg>Informations personnelles
                </h2>
                <Link to={modifierPath} className="absolute right-5 top-[17px] flex h-8 w-[89px] items-center justify-center gap-[9px] rounded-lg border border-[#E1E8F4] bg-white text-[11px] font-semibold shadow-sm transition hover:bg-[#F7F9FD]">
                  <svg className="ic h-[13px] w-[13px] stroke-[1.9]"><use href="#i-pencil" /></svg>Modifier
                </Link>

                <dl className="absolute left-[22px] top-[59px] text-[12px] text-[#1F3566]">
                  <div><dt className="font-medium leading-[18px]">Nom complet</dt><dd className="leading-[17px] text-[#2A416F]">{fullName}</dd></div>
                  <div className="mt-[5px]"><dt className="font-medium leading-[18px]">Email</dt><dd className="leading-[17px] text-[#2A416F]">{email}</dd></div>
                  <div className="mt-[7px]"><dt className="font-medium leading-[18px]">Téléphone</dt><dd className="leading-[17px] text-[#2A416F]">{phone}</dd></div>
                  <div className="mt-[10px]"><dt className="font-medium leading-[18px]">Date de naissance</dt><dd className="leading-[17px] text-[#2A416F]">{birthDate}</dd></div>
                  <div className="mt-3"><dt className="font-medium leading-[18px]">Nationalité</dt><dd className="leading-[17px] text-[#2A416F]">{nationality}</dd></div>
                </dl>
                <dl className="absolute left-[457px] top-[59px] text-[12px] text-[#1F3566]">
                  <div><dt className="font-medium leading-[18px]">Adresse</dt><dd className="leading-[17px] text-[#2A416F]">{address}</dd></div>
                  <div className="mt-[13px]"><dt className="font-medium leading-[18px]">Marché</dt><dd className="leading-[17px] text-[#2A416F]">{marketLabel}</dd></div>
                  <div className="mt-4"><dt className="font-medium leading-[18px]">Rôle</dt><dd className="leading-[17px] text-[#2A416F]">Gérant</dd></div>
                  <div className="mt-[17px]"><dt className="font-medium leading-[18px]">Membre depuis</dt><dd className="leading-[17px] text-[#2A416F]">{memberSince}</dd></div>
                </dl>
              </section>

              <section className="relative mt-[15px] h-[164px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <h2 className="absolute left-6 top-4 flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
                  <svg className="ic h-5 w-5 stroke-[1.75] text-[#2F5FC4]"><use href="#i-briefcase" /></svg>Informations professionnelles
                </h2>
                <Link to={modifierPath} className="absolute right-5 top-[14px] flex h-8 w-[89px] items-center justify-center gap-[9px] rounded-lg border border-[#E1E8F4] bg-white text-[11px] font-semibold shadow-sm transition hover:bg-[#F7F9FD]">
                  <svg className="ic h-[13px] w-[13px] stroke-[1.9]"><use href="#i-pencil" /></svg>Modifier
                </Link>

                <dl className="absolute left-[22px] top-[47px] text-[12px]">
                  <div className="flex h-6 items-center"><dt className="w-[190px] font-medium text-[#1F3566]">Marché</dt><dd className="text-[#2F4472]">{marketLabel}</dd></div>
                  <div className="flex h-6 items-center"><dt className="w-[190px] font-medium text-[#1F3566]">Rôle</dt><dd className="text-[#2F4472]">Gérant</dd></div>
                  <div className="mt-px flex h-6 items-center"><dt className="w-[190px] font-medium text-[#1F3566]">Vérification</dt><dd className="text-[#2F4472]">{verificationLabel}</dd></div>
                  <div className="mt-[3px] flex h-6 items-center"><dt className="w-[190px] font-medium text-[#1F3566]">Premium</dt><dd className="text-[#2F4472]">{premium ? 'Actif' : 'Inactif'}</dd></div>
                </dl>
              </section>

              <section className="relative mt-[14px] h-[160px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <h2 className="absolute left-6 top-5 flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
                  <svg className="ic h-5 w-5 stroke-[1.75] text-[#2F5FC4]"><use href="#i-bell" /></svg>Préférences &amp; notifications
                </h2>
                <Link to={modifierPath} className="absolute right-5 top-[14px] flex h-8 w-[89px] items-center justify-center gap-[9px] rounded-lg border border-[#E1E8F4] bg-white text-[11px] font-semibold shadow-sm transition hover:bg-[#F7F9FD]">
                  <svg className="ic h-[13px] w-[13px] stroke-[1.9]"><use href="#i-pencil" /></svg>Modifier
                </Link>

                <ul className="absolute left-[22px] right-5 top-[47px] text-[11.5px] text-[#1F3566]">
                  {([
                    ['reservations', 'Recevoir les demandes de réservation'],
                    ['messages', 'Recevoir les messages de clients'],
                    ['marketing', 'Recevoir les notifications marketing'],
                  ] as const).map(([key, label]) => (
                    <li key={key} className="flex h-[29px] items-center">
                      <svg className="ic h-[14px] w-[14px] shrink-0 stroke-[1.75] text-[#6F82A6]"><use href="#i-box" /></svg>
                      <span className="ml-[18px] flex-1">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={preferences[key]}
                        aria-label={label}
                        onClick={() => togglePreference(key)}
                        className={`relative h-[18px] w-[31px] rounded-full transition ${preferences[key] ? 'bg-[#27B585]' : 'bg-[#CBD3E1]'}`}
                      >
                        <span className={`absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition ${preferences[key] ? 'translate-x-[13px]' : ''}`} />
                      </button>
                      <span className="ml-2 w-[61px] text-[11px] text-[#5F7396]">{preferences[key] ? 'Active' : 'Désactivée'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="pt-[26px]">
              <section className="relative h-[177px] overflow-hidden rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <svg viewBox="0 0 381 177" preserveAspectRatio="xMaxYMin slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#CDE7F6" /><stop offset="1" stopColor="#EAF5FB" /></linearGradient>
                    <linearGradient id="g-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A5CEE4" /><stop offset="1" stopColor="#6FA9C9" /></linearGradient>
                    <linearGradient id="g-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset=".6" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
                  </defs>
                  <rect x="190" y="7" width="191" height="150" fill="#EDE6DA" />
                  <rect x="215" y="12" width="150" height="90" fill="url(#g-sky)" />
                  <rect x="215" y="68" width="150" height="34" fill="url(#g-sea)" />
                  <g fill="#9DB3C0" opacity=".75"><rect x="232" y="58" width="7" height="11" /><rect x="243" y="62" width="9" height="7" /><rect x="330" y="60" width="8" height="9" /><rect x="341" y="63" width="10" height="6" /></g>
                  <g stroke="#7B7F86" strokeWidth="3"><path d="M262 12v90M312 12v90M215 102h150M215 12h150" /></g>
                  <path d="M190 7h32v112c-9-7-23-7-32 0z" fill="#E3D4BD" />
                  <path d="M365 7h16v125h-16z" fill="#E3D4BD" />
                  <path d="M246 122c32-16 92-14 135-2v57H238z" fill="#F7F3EC" />
                  <path d="M262 138c34-9 74-7 119 3v36H255z" fill="#E7DFD2" />
                  <rect x="290" y="116" width="34" height="12" rx="5" fill="#fff" opacity=".9" />
                  <rect x="332" y="118" width="30" height="12" rx="5" fill="#EFE8DC" />
                  <path d="M352 148h18l-3 18h-12z" fill="#C9CDD3" />
                  <path d="M361 148c-12-12-14-26-6-36 6 10 10 22 6 36zM361 148c8-12 18-18 24-16-4 10-12 18-24 16zM361 146c-14-4-22-12-22-20 10 2 20 8 22 20z" fill="#8FA58F" />
                  <rect x="190" y="0" width="110" height="177" fill="url(#g-fade)" />
                  <path d="M0 92C120 108 260 130 381 164V177H0z" fill="#fff" />
                </svg>

                <span className={`absolute left-[24px] top-[26px] grid h-[24px] w-[24px] place-items-center rounded-full ring-4 ring-white/80 ${profileUpToDate ? 'bg-[#27B585]' : 'bg-[#F26B1D]'}`}>
                  <svg className="ic h-3 w-3 stroke-white stroke-[3]"><use href={profileUpToDate ? '#i-check' : '#i-file-text'} /></svg>
                </span>
                <div className="absolute bottom-[19px] left-[26px]">
                  <h3 className="text-[13px] font-bold leading-5">{profileUpToDate ? 'Votre profil est à jour' : 'Complétez votre profil'}</h3>
                  <p className="mt-[7px] text-[11px] leading-[19px] text-[#5F7396]">{profileUpToDate ? <>Vos informations sont complètes et visibles<br />pour les voyageurs.</> : <>Certaines informations sont manquantes<br />ou en attente de validation.</>}</p>
                </div>
              </section>

              <section className="mt-[18px] h-[263px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <h3 className="mt-[18px] flex h-5 items-center gap-[15px] pl-[27px] text-[14px] font-bold tracking-[-0.01em]">
                  <svg className="ic h-5 w-5 stroke-[1.75] text-[#1B3A82]"><use href="#i-shield-check" /></svg>État de votre compte
                </h3>
                <ul className="mx-[26px] mt-[15px]">
                  {accountRows.map((row) => (
                    <li key={row.label} className="flex h-[37.5px] items-center gap-4 border-b border-[#EEF2F8] last:border-b-0">
                      {row.status === 'validated' ? (
                        <svg className="h-5 w-5 shrink-0"><use href="#i-ok" /></svg>
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none ${ACCOUNT_STATUS_BADGE[row.status]}`}
                        >
                          {row.status === 'rejected' ? '×' : row.status === 'progress' ? '…' : '–'}
                        </span>
                      )}
                      <span className="flex-1 text-[11.5px] text-[#3D4F73]">{row.label}</span>
                      <span className={`rounded-md px-2 py-[2px] text-[10px] font-medium leading-[13px] ${ACCOUNT_STATUS_BADGE[row.status]}`}>
                        {ACCOUNT_STATUS_LABEL[row.status]}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={suiviPath} className="mx-[26px] mt-[15px] flex h-[34px] items-center justify-center gap-2 rounded-lg border border-[#E3E9F4] bg-[#FAFBFE] text-[10px] font-semibold transition hover:bg-[#F3F6FC]">
                  Voir le suivi de vérification
                  <svg className="ic h-[10px] w-[10px] stroke-[2.4]"><use href="#i-arrow-right" /></svg>
                </Link>
              </section>

              <div className="mt-[5px] rounded-xl border border-[#EEF2F8] bg-white p-[11px] pb-3 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
                <section className="h-[223px] rounded-xl border border-[#DDE6F4] bg-[#EFF4FB] px-[19px] pt-4">
                  <div className="flex items-start gap-4 pl-px">
                    <svg className="ic mt-[1px] h-6 w-6 shrink-0 fill-[#F26B1D] stroke-[1.75] text-[#F26B1D]"><use href="#i-crown" /></svg>
                    <div>
                      <h3 className="text-[14px] font-bold leading-5">{premium ? 'Votre abonnement Premium' : 'Passez au Premium'}</h3>
                      <p className="mt-1 text-[11.5px] leading-[18px] text-[#5F7396]">Boostez la visibilité de vos annonces et<br />attirez plus de voyageurs !</p>
                    </div>
                  </div>
                  <ul className="ml-[41px] mt-[10px] text-[10px] text-[#3D4F73]">
                    {['Plus de visibilité sur la plateforme', 'Mise en avant de vos annonces', 'Statistiques avancées'].map((item) => (
                      <li key={item} className="flex h-6 items-center gap-[10px]"><svg className="h-3 w-3 shrink-0"><use href="#i-ok" /></svg>{item}</li>
                    ))}
                  </ul>
                  <Link to={`${gerantPath}/premium`} className="mt-[14px] flex h-8 w-full items-center justify-center gap-2 rounded-md bg-[#F26B1D] text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(242,107,29,0.25)] transition hover:bg-[#E05A0C]">
                    Découvrir les avantages
                    <svg className="ic h-[11px] w-[11px] stroke-white stroke-[2.6]"><use href="#i-arrow-right" /></svg>
                  </Link>
                </section>

                <section className="mt-[27px] h-[135px] rounded-xl border border-[#DDE6F4] bg-[#EFF4FB] pl-[19px] pt-[14px]">
                  <div className="flex items-start gap-[17px]">
                    <svg className="ic mt-[2px] h-5 w-5 shrink-0 stroke-[1.75] text-[#2F5FC4]"><use href="#i-bulb" /></svg>
                    <div>
                      <h3 className="text-[11.5px] font-bold leading-4">Besoin d&apos;aide ?</h3>
                      <p className="mt-[3px] whitespace-nowrap text-[11px] leading-[19px] text-[#5F7396]">Notre équipe est disponible pour vous accompagner<br />dans la gestion de votre compte.</p>
                    </div>
                  </div>
                  <Link to="/contact" className="ml-[37px] mt-[14px] flex h-[33px] w-[181px] items-center rounded-md border border-[#E4EAF4] bg-white pl-[21px] text-[11px] font-bold text-[#2447A5] shadow-sm transition hover:bg-[#F7F9FD]">
                    <svg className="ic h-4 w-4 stroke-[1.75]"><use href="#i-headset" /></svg>
                    <span className="ml-[14px]">Contacter le support</span>
                  </Link>
                </section>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
