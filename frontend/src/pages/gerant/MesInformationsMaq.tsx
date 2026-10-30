import { useEffect, useState } from 'react';
import { useHomePath } from '../../hooks/useHomePath';
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
import { ProfileSidebar } from '../../components/gerant-profile/ProfileSidebar';
import { ProfileHeader } from '../../components/gerant-profile/ProfileHeader';
import { ProfileBreadcrumb } from '../../components/gerant-profile/ProfileBreadcrumb';
import { ProfileBanner } from '../../components/gerant-profile/ProfileBanner';
import { PersonalInfoSection } from '../../components/gerant-profile/PersonalInfoSection';
import { ProfessionalInfoSection } from '../../components/gerant-profile/ProfessionalInfoSection';
import { PreferencesSection } from '../../components/gerant-profile/PreferencesSection';
import { ProfileStatusCard } from '../../components/gerant-profile/ProfileStatusCard';
import { AccountStatusSection } from '../../components/gerant-profile/AccountStatusSection';
import { PremiumCard } from '../../components/gerant-profile/PremiumCard';

type PreferenceKey = 'reservations' | 'messages' | 'marketing';
type AccountRowStatus = 'validated' | 'progress' | 'rejected' | 'missing' | 'unknown';

const DOC_LABELS: Record<VerificationDocType, string> = {
  national_id: "Pièce d'identité",
  proof_of_address: 'Justificatif de domicile',
  selfie: 'Photo de vous',
};

/**
 * Espace gérant — « Mes informations ».
 * Conversion de docs/maquettes/habici-mon-profil.html siguiendo la procédure :
 * 1. Tailwind installé (build Vite, pas CDN) — déjà fait
 * 2. CSS personnalisé dans index.css avec @layer utilities — déjà fait
 * 3. Polices auto-hébergées dans fonts.css — déjà fait
 * 4. Icônes lucide-react (remplace les <svg><use href="#i-..." /></svg>)
 * 5. Découpé en composants (Sidebar, Header, Breadcrumb, Banner, Sections, Cartes)
 * 6. État React (useState/useEffect, pas de getElementById/innerHTML)
 * 7. Données typées en props (GerantData, VerificationStatusResponse…)
 * 8. Routage branché (react-router-dom Link, useHomePath)
 * 9. Rendu à vérifier côté à côté à 390 px et 1280 px avec le HTML d'origine
 */
export default function MesInformationsMaq() {
  const homePath = useHomePath();
  const { market } = useMarket();
  const gerantPath = `${homePath}/gerant`;
  const suiviPath = `${gerantPath}/verification/suivi`;

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

  if (!gerant) {
    return (
      <div className="verif-maq flex min-h-screen">
        <ProfileSidebar active="" />
        <div className="min-w-0 flex-1">
          <ProfileHeader userName="Chargement…" />
          <main className="pb-10 pl-[22px] pr-[25px]">
            <p className="mt-4 text-center text-[13px] text-[#5F7396]">Chargement de votre profil…</p>
          </main>
        </div>
      </div>
    );
  }

  const fullName = [gerant.prenom, gerant.nom].filter(Boolean).join(' ') || '—';
  const email = gerant.email || '—';
  const phone = gerant.phone || '—';
  const marketLabel = marketByCode(market).label;
  const verified = Boolean(gerant.is_verified);
  const premium = isPremiumActive(gerant);
  const birthDate = formatDateLong(gerant.date_of_birth) || '—';
  const nationality = gerant.nationality || '—';
  const address = gerant.address || '—';
  const memberSince = formatDateLong(gerant.created_at) || '—';
  const personalInfoComplete = Boolean(
    gerant.nom &&
      gerant.prenom &&
      gerant.phone &&
      gerant.address &&
      gerant.date_of_birth &&
      gerant.nationality,
  );
  const verificationStatus =
    verification?.verification_status ?? gerant.verification_status ?? 'none';
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
      <ProfileSidebar active="profil" />
      <div className="min-w-0 flex-1">
        <ProfileHeader userName={fullName} />
        <main className="pb-10 pl-[22px] pr-[25px]">
          <ProfileBreadcrumb />
          {loadError && (
            <p role="alert" className="mt-2 text-[12px] font-semibold text-red-600">{loadError}</p>
          )}

          <div className="grid gap-x-5 xl:grid-cols-[minmax(0,1fr)_381px]">
            <div className="pt-[15px]">
              <ProfileBanner
                fullName={fullName}
                email={email}
                phone={phone}
                market={market}
                verified={verified}
              />
              <PersonalInfoSection
                fullName={fullName}
                email={email}
                phone={phone}
                birthDate={birthDate}
                nationality={nationality}
                marketLabel={marketLabel}
                address={address}
                memberSince={memberSince}
              />
              <ProfessionalInfoSection
                marketLabel={marketLabel}
                verificationLabel={verificationLabel}
                premium={premium}
              />
              <PreferencesSection
                preferences={preferences}
                onToggle={togglePreference}
              />
            </div>

            <aside className="pt-[26px]">
              <ProfileStatusCard profileUpToDate={profileUpToDate} />
              <AccountStatusSection rows={accountRows} suiviPath={suiviPath} />
              <PremiumCard premium={premium} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
