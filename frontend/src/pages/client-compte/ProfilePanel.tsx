import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone, User as LucideUser } from 'lucide-react';
import { useHomePath } from '../../hooks/useHomePath';
import { ProfileStatusCard } from '../../components/gerant-profile/ProfileStatusCard';
import {
  PreferencesSection,
  type PreferenceItem,
  type PreferenceKey,
} from '../../components/gerant-profile/PreferencesSection';

export interface ProfileFormState {
  nom: string;
  prenom: string;
  telephone: string;
}

const CLIENT_PREFERENCES: PreferenceItem[] = [
  { key: 'reservations', label: 'Recevoir les rappels de réservation' },
  { key: 'messages', label: 'Recevoir les messages des gérants' },
  { key: 'marketing', label: 'Recevoir les offres et nouveautés' },
];

/**
 * Panneau « Mon profil » côté client.
 *
 * Reprend la mise en page du profil gérant (« Mes informations ») : fil
 * d'Ariane, bannière d'identité, carte d'informations personnelles éditables,
 * préférences, puis colonne de statut à droite.
 */
export default function ProfilePanel({
  profileForm,
  email,
  marketLabel,
  memberSince,
  avatarUrl,
  saving,
  error,
  success,
  onChange,
  onSubmit,
}: {
  profileForm: ProfileFormState;
  email: string;
  marketLabel: string;
  memberSince: string;
  avatarUrl?: string;
  saving: boolean;
  error: string;
  success: string;
  onChange: (patch: Partial<ProfileFormState>) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const homePath = useHomePath();
  const comptePath = `${homePath}/compte`;

  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>({
    reservations: true,
    messages: true,
    marketing: false,
  });

  const togglePreference = (key: PreferenceKey) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const initials =
    `${profileForm.prenom.charAt(0)}${profileForm.nom.charAt(0)}`.toUpperCase() || 'U';
  const fullName = [profileForm.prenom, profileForm.nom]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(' ');
  const profileUpToDate = Boolean(
    profileForm.prenom.trim() && profileForm.nom.trim() && profileForm.telephone.trim() && email,
  );

  return (
    <>
      <div className="pt-[15px]">
        <Link
          to={comptePath}
          className="ml-[6px] inline-flex h-5 items-center gap-[10px] text-[12.5px] font-bold"
        >
          <ArrowLeft size={13} className="stroke-[2.4]" />Retour
        </Link>
        <h1 className="dash-page-head dash-page-head--xl mt-1 text-[#0D2150]">Mes informations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez vos informations personnelles et vos préférences.
        </p>
      </div>

      <div className="grid gap-x-5 xl:grid-cols-[minmax(0,1fr)_381px]">
        <div className="pt-[15px]">
          {/* Bannière d'identité */}
          <section className="relative flex min-h-[151px] flex-wrap items-center gap-5 rounded-xl border border-[#EEF2F8] bg-white p-5 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <div className="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[20px]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-b from-[#2F5FC4] to-[#1B3A82] text-[28px] font-black text-white">
                  {initials}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-[10px]">
                <h2 className="text-[20px] font-bold tracking-[-0.01em]">
                  {fullName || 'Votre profil'}
                </h2>
                <span className="rounded-full bg-[#E6F6EF] px-[10px] py-[2px] text-[12px] font-semibold leading-4 text-[#2E9E78]">
                  Client
                </span>
              </div>
              <ul className="mt-[6px]">
                <li className="flex h-[26px] items-center gap-2 text-[13.5px] text-[#1E3A74]">
                  <Mail size={16} className="ml-px stroke-[1.75] text-[#40527C]" />
                  <span className="client-compte__profile-aside-email">{email || '—'}</span>
                </li>
                <li className="flex h-[27px] items-center gap-2 text-[13.5px] text-[#5F7396]">
                  <Phone size={16} className="ml-px stroke-[1.75] text-[#40527C]" />
                  {profileForm.telephone || '—'}
                </li>
                <li className="flex h-[26px] items-center gap-2 text-[13.5px] text-[#5F7396]">
                  <MapPin size={16} className="ml-px stroke-[1.75] text-[#40527C]" />
                  {marketLabel || '—'}
                </li>
              </ul>
            </div>
          </section>

          {/* Informations personnelles éditables */}
          <section className="mt-[15px] rounded-xl border border-[#EEF2F8] bg-white p-6 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <h2 className="flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
              <LucideUser size={20} className="stroke-[1.75] text-[#2F5FC4]" />
              Informations personnelles
            </h2>
            <p className="mt-2 text-[12px] text-[#5F7396]">
              Ces informations servent à vous contacter au sujet de vos réservations.
            </p>

            <form className="client-compte__profile-form !p-0 !pt-4" onSubmit={onSubmit}>
              <div className="client-compte__fields">
                <div className="client-compte__field">
                  <label htmlFor="cp-prenom">Prénom</label>
                  <input
                    id="cp-prenom"
                    type="text"
                    value={profileForm.prenom}
                    onChange={(e) => onChange({ prenom: e.target.value })}
                    autoComplete="given-name"
                  />
                </div>
                <div className="client-compte__field">
                  <label htmlFor="cp-nom">Nom</label>
                  <input
                    id="cp-nom"
                    type="text"
                    value={profileForm.nom}
                    onChange={(e) => onChange({ nom: e.target.value })}
                    autoComplete="family-name"
                  />
                </div>
                <div className="client-compte__field">
                  <label htmlFor="cp-tel">Téléphone</label>
                  <input
                    id="cp-tel"
                    type="tel"
                    value={profileForm.telephone}
                    onChange={(e) => onChange({ telephone: e.target.value })}
                    autoComplete="tel"
                  />
                </div>
                <div className="client-compte__field">
                  <label htmlFor="cp-email">
                    Email
                    <span className="client-compte__field-hint">Géré par votre compte</span>
                  </label>
                  <input id="cp-email" type="email" value={email} disabled />
                </div>
              </div>

              {error && (
                <p className="client-compte__error" role="alert">
                  {error}
                </p>
              )}
              {success && (
                <p className="client-compte__success" role="status">
                  {success}
                </p>
              )}

              <div className="client-compte__form-actions">
                <button
                  type="submit"
                  className="client-compte__btn client-compte__btn--primary"
                  disabled={saving}
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </section>

          <PreferencesSection
            preferences={preferences}
            onToggle={togglePreference}
            items={CLIENT_PREFERENCES}
          />
        </div>

        <aside className="pt-[26px]">
          <ProfileStatusCard profileUpToDate={profileUpToDate} />

          <section className="mt-[18px] rounded-xl border border-[#EEF2F8] bg-white p-5 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <h3 className="text-[14px] font-bold tracking-[-0.01em]">Votre compte</h3>
            <dl className="mt-4 space-y-3 text-[12px] text-[#1F3566]">
              <div>
                <dt className="font-medium">Email</dt>
                <dd className="break-words text-[#2A416F]">{email || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium">Marché</dt>
                <dd className="text-[#2A416F]">{marketLabel || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium">Rôle</dt>
                <dd className="text-[#2A416F]">Client</dd>
              </div>
              <div>
                <dt className="font-medium">Membre depuis</dt>
                <dd className="text-[#2A416F]">{memberSince || '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-[18px] rounded-xl border border-[#DDE6F4] bg-[#EFF4FB] p-5">
            <h3 className="text-[13px] font-bold leading-5">Besoin d&apos;aide ?</h3>
            <p className="mt-1 text-[11.5px] leading-[19px] text-[#5F7396]">
              Notre équipe est disponible pour vous accompagner dans la gestion de votre compte.
            </p>
            <Link
              to="/contact"
              className="mt-4 flex h-9 w-full items-center justify-center rounded-md border border-[#E4EAF4] bg-white text-[11px] font-bold text-[#2447A5] shadow-sm transition hover:bg-[#F7F9FD]"
            >
              Contacter le support
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
