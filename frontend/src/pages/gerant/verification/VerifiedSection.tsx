import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface VerifiedSectionProps {
  gerantPath: string;
}

type IconName =
  | 'arrow-left'
  | 'shield-check'
  | 'check'
  | 'calendar'
  | 'user'
  | 'file-text'
  | 'chevron-right'
  | 'home'
  | 'mail'
  | 'headset';

const ICONS: Record<IconName, ReactNode> = {
  'arrow-left': (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
    </>
  ),
  headset: (
    <path d="M3 14h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a9 9 0 0118 0v7a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3" />
  ),
};

function Icon({
  name,
  className = 'h-4 w-4',
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function OkBadge({ className = 'h-[22px] w-[22px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#22AC78" />
      <path
        d="m7 12.5 3.2 3.2L17 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocThumb({ kind, src }: { kind: 'identity' | 'address' | 'selfie'; src: string | null }) {
  if (src) {
    return (
      <div className="h-[54px] w-[90px] shrink-0 overflow-hidden rounded-md border border-[#E6ECF5] bg-white p-[2px] shadow-sm">
        <img src={src} alt="" className="h-full w-full rounded-[3px] object-cover" />
      </div>
    );
  }

  if (kind === 'selfie') {
    return (
      <div className="grid h-[62px] w-[90px] shrink-0 place-items-center rounded-md border border-[#E6ECF5] bg-white shadow-sm">
        <div className="h-[55px] w-[70px] overflow-hidden rounded-[3px]">
          <svg viewBox="0 10 100 80" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
            <rect width="100" height="100" fill="#E4E5E8" />
            <path d="M6 100c2-22 20-28 44-28s42 6 44 28z" fill="#17171A" />
            <path d="M41 56h18v20c-4 5-14 5-18 0z" fill="#5A3827" />
            <ellipse cx="50" cy="42" rx="17" ry="21" fill="#6B4430" />
            <path d="M32.5 38c-1-15 7-22 17.5-22s18.5 7 17.5 22c-3-7-9-10-17.5-10s-14.5 3-17.5 10z" fill="#111" />
            <ellipse cx="43" cy="42" rx="1.6" ry="1.2" fill="#1B120D" />
            <ellipse cx="57" cy="42" rx="1.6" ry="1.2" fill="#1B120D" />
            <path d="M47 45q3 3 6 0" stroke="#4E2F20" fill="none" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M42 51q8 8 16 0z" fill="#fff" />
          </svg>
        </div>
      </div>
    );
  }

  if (kind === 'address') {
    return (
      <div className="h-[60px] w-[90px] shrink-0 overflow-hidden rounded-md border border-[#E6ECF5] bg-white p-[2px] shadow-sm">
        <svg viewBox="0 0 114 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full rounded-[3px]" aria-hidden="true">
          <rect width="114" height="56" fill="#E9EDF4" />
          <rect x="4" y="0" width="106" height="56" fill="#fff" />
          <rect x="8" y="5" width="16" height="6" rx="1" fill="#7C8DB3" />
          <rect x="74" y="5" width="30" height="3" rx="1" fill="#9AA7C4" />
          <rect x="74" y="10" width="22" height="3" rx="1" fill="#C4CCDD" />
          <g fill="#B8C1D6">
            <rect x="8" y="18" width="52" height="2" rx="1" />
            <rect x="8" y="23" width="44" height="2" rx="1" />
            <rect x="8" y="28" width="56" height="2" rx="1" />
            <rect x="8" y="33" width="38" height="2" rx="1" />
          </g>
          <g fill="#CDD4E3">
            <rect x="70" y="20" width="34" height="14" rx="1" />
            <rect x="8" y="40" width="96" height="2" rx="1" />
            <rect x="8" y="45" width="96" height="2" rx="1" />
            <rect x="8" y="50" width="70" height="2" rx="1" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className="h-[54px] w-[90px] shrink-0 overflow-hidden rounded-md border border-[#E6ECF5] bg-white p-[2px] shadow-sm">
      <svg viewBox="0 0 114 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full rounded-[3px]" aria-hidden="true">
        <defs>
          <linearGradient id="verif-id-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D9E0EF" />
            <stop offset="1" stopColor="#A9B7D6" />
          </linearGradient>
        </defs>
        <rect width="114" height="56" fill="url(#verif-id-gradient)" />
        <rect x="6" y="4" width="64" height="4" rx="1" fill="#4E5F8A" opacity=".65" />
        <rect x="8" y="13" width="30" height="38" rx="2" fill="#EDEFF5" />
        <circle cx="23" cy="26" r="7" fill="#7A6860" />
        <path d="M11 51c1-9 6-12 12-12s11 3 12 12z" fill="#55607C" />
        <g fill="#6F80A6" opacity=".55">
          <rect x="44" y="15" width="60" height="2.2" rx="1" />
          <rect x="44" y="21" width="48" height="2.2" rx="1" />
          <rect x="44" y="27" width="56" height="2.2" rx="1" />
          <rect x="44" y="33" width="40" height="2.2" rx="1" />
          <rect x="44" y="39" width="52" height="2.2" rx="1" />
          <rect x="44" y="45" width="34" height="2.2" rx="1" />
        </g>
      </svg>
    </div>
  );
}

const STEPS = [
  { title: 'Identification', description: 'Type et catégorie', numberWidth: 'w-[17px]', descriptionPadding: 'pl-[17px]', gap: 'gap-[15px]' },
  { title: 'Détails', description: 'Description et équipements', numberWidth: 'w-[15px]', descriptionPadding: 'pl-[15px]', gap: 'gap-[15px]' },
  { title: 'Photos', description: 'Ajoutez vos photos', numberWidth: 'w-4', descriptionPadding: 'pl-4', gap: 'gap-[15px]' },
  { title: 'Vérification', description: 'Votre compte est vérifié', numberWidth: 'w-4', descriptionPadding: 'pl-4', gap: 'gap-[14px]' },
];

const STEP_LINE_WIDTHS = ['w-[106px]', 'w-[58px]', 'w-[107px]'];
const STEP_LINE_MARGINS = ['mx-[14px]', 'mx-[14px]', 'mx-[18px]'];

function VerifiedStepper() {
  return (
    <ol className="mt-[18px] flex h-[77px] items-center overflow-hidden rounded-xl border border-[#EEF2F8] bg-white pl-[24px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex shrink-0 items-center" aria-current={index === STEPS.length - 1 ? 'step' : undefined}>
          <div className={`flex shrink-0 items-center ${step.gap}`}>
            <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#D3F1E4]">
              <span className="grid h-[31px] w-[31px] place-items-center rounded-full bg-[#1FA672]">
                <Icon name="check" className="h-4 w-4 text-white" strokeWidth={3} />
              </span>
            </span>
            <div>
              <p className={`flex text-[12.5px] font-bold leading-4 ${index === STEPS.length - 1 ? 'text-[#17A06B]' : ''}`}>
                <span className={step.numberWidth}>{index + 1}.</span>
                {step.title}
              </p>
              <p className={`mt-1 text-[10.5px] leading-[14px] ${step.descriptionPadding} ${index === STEPS.length - 1 ? 'text-[#17A06B]' : 'text-[#6B7EA3]'}`}>
                {step.description}
              </p>
            </div>
          </div>
          {index < STEPS.length - 1 && (
            <span
              aria-hidden="true"
              className={`h-[1.5px] shrink bg-[#3DBE97] ${STEP_LINE_MARGINS[index]} ${STEP_LINE_WIDTHS[index]}`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

interface DocRow {
  key: 'identity' | 'address' | 'selfie';
  title: string;
  description: string;
  status: string;
  href: string | null;
  image: string | null;
}

interface StatusRow {
  label: string;
  state: string;
  weight: string;
}

const DOC_ROWS: DocRow[] = [
  {
    key: 'identity',
    title: "Pièce d'identité",
    description: "Carte nationale d'identité ou passeport",
    status: 'Document validé',
    href: null,
    image: null,
  },
  {
    key: 'address',
    title: 'Justificatif de domicile',
    description: "Facture d'électricité, eau, internet ou document officiel",
    status: 'Document validé',
    href: null,
    image: null,
  },
  {
    key: 'selfie',
    title: 'Photo de vous',
    description: 'Photo claire et récente',
    status: 'Photo validée',
    href: null,
    image: null,
  },
];

const DOC_ROW_HEIGHTS = ['h-[80px]', 'h-[87px]', 'h-[82px]'];

const STATUS_ROWS: StatusRow[] = [
  { label: 'Identification', state: 'Validé', weight: 'font-medium' },
  { label: 'Justificatif de domicile', state: 'Validé', weight: 'font-semibold' },
  { label: 'Photo de vous', state: 'Validé', weight: 'font-semibold' },
  { label: 'Validation finale', state: 'Approuvée', weight: 'font-medium' },
];

export default function VerifiedSection({ gerantPath }: VerifiedSectionProps) {
  return (
    <section className="text-[#0F2150]">
      <Link
        to={gerantPath}
        className="ml-[4px] mt-4 inline-flex h-5 items-center gap-[11px] text-[13px] font-medium text-[#0F2150] transition hover:text-[#F26B1D]"
      >
        <Icon name="arrow-left" className="h-3 w-3" strokeWidth={2.2} />
        Retour
      </Link>

      <h1 className="mt-2 text-[36px] font-extrabold leading-[38px] tracking-[-0.035em] text-[#0D2150]">Vérification</h1>
      <p className="text-[14px] leading-[22px] text-[#5F7396]">
        Consultez le résultat de la vérification de votre compte.
      </p>

      <VerifiedStepper />

      <div className="mt-[18px] grid items-start gap-[14px] xl:grid-cols-[minmax(0,1fr)_438px]">
        <div className="rounded-xl border border-[#E8EDF6] bg-white pb-[13px] pl-[16px] pr-[15px] pt-[17px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
          <div className="relative rounded-xl border border-[#D4EEE2] bg-gradient-to-b from-[#F1FAF6] to-[#EAF7F1] pb-[22px] pl-[14px] pr-[15px] pt-3">
            <div className="flex h-[69px] items-start">
              <span className="grid h-[69px] w-[69px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#26B27E] to-[#169866] shadow-[0_4px_12px_rgba(31,166,114,0.25)]">
                <Icon name="shield-check" className="h-[34px] w-[34px] text-white" strokeWidth={1.7} />
              </span>
              <div className="ml-[15px] pt-1">
                <h2 className="text-[19px] font-bold leading-6 tracking-[-0.03em] text-[#12985F]">
                  Compte vérifié avec succès
                </h2>
                <p className="mt-[5px] text-[13px] leading-[23px] text-[#3F5078]">
                  Votre identité et vos documents ont été validés. Vous pouvez désormais publier
                  <br />
                  vos annonces en toute confiance.
                </p>
              </div>
            </div>
            <span className="absolute right-4 top-[18px] flex h-[27px] items-center gap-[7px] rounded-full bg-[#1E9F6C] pl-3 pr-[14px] text-[12.5px] font-semibold text-white">
              <Icon name="check" className="h-[13px] w-[13px] text-white" strokeWidth={3} />
              Vérifié
            </span>

            <div className="mt-[25px] flex h-[110px] items-start rounded-lg border border-[#E1EFE8] bg-white pl-3 pt-[10px]">
              <span className="relative grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full bg-[#E3F1F4]">
                <Icon name="file-text" className="h-[30px] w-[30px] text-[#2457B0]" strokeWidth={1.6} />
                <OkBadge className="absolute bottom-[3px] right-[2px] h-[16px] w-[16px] ring-2 ring-[#E3F1F4]" />
              </span>
              <div className="ml-[15px] pt-[6px]">
                <h3 className="text-[15px] font-bold leading-[22px] tracking-[-0.025em]">Vérification validée</h3>
                <div className="mt-3 flex items-center">
                  <div className="flex w-[183px] items-center gap-[9px]">
                    <Icon name="calendar" className="ml-px h-4 w-4 shrink-0 text-[#40527C]" strokeWidth={1.75} />
                    <div>
                      <p className="text-[10.5px] leading-4 text-[#5F7396]">Date de validation :</p>
                      <p className="mt-[3px] text-[13px] font-medium leading-5">24 octobre 2026</p>
                    </div>
                  </div>
                  <span className="h-[42px] w-px bg-[#E3EAF2]" />
                  <div className="ml-6 flex w-[187px] items-center gap-[11px]">
                    <Icon name="user" className="h-4 w-4 shrink-0 text-[#40527C]" strokeWidth={1.75} />
                    <div>
                      <p className="text-[10.5px] leading-4 text-[#5F7396]">Validée par :</p>
                      <p className="mt-[3px] text-[13px] font-medium leading-5">Équipe HabiCI</p>
                    </div>
                  </div>
                  <span className="h-[42px] w-px bg-[#E3EAF2]" />
                  <div className="ml-[26px] flex items-center gap-[13px]">
                    <Icon name="file-text" className="h-4 w-4 shrink-0 text-[#40527C]" strokeWidth={1.75} />
                    <div>
                      <p className="text-[10.5px] leading-4 text-[#5F7396]">Référence :</p>
                      <p className="mt-[3px] text-[13px] font-medium leading-5">HBC-VER-2026-0842</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ul className="mt-4 overflow-hidden rounded-lg border border-[#E1EFE8] bg-white">
              {DOC_ROWS.map((row, index) => (
                <li
                  key={row.key}
                  className={`flex items-center pl-[15px] pr-[14px] ${DOC_ROW_HEIGHTS[index]} ${
                    index > 0 ? 'border-t border-[#E9EFF5]' : ''
                  }`}
                >
                  <DocThumb kind={row.key} src={row.image} />
                  <div className="ml-[17px]">
                    <p className="text-[13.5px] font-semibold leading-5 tracking-[-0.01em]">{row.title}</p>
                    <p
                      className={`text-[10.5px] leading-4 ${
                        index === 2 ? 'mt-[3px] text-[#7E92B8]' : 'mt-[1px] text-[#5F7396]'
                      }`}
                    >
                      {row.description}
                    </p>
                  </div>
                  <a href="#" onClick={(event) => event.preventDefault()} className="ml-auto flex w-[146px] items-center">
                    <OkBadge className="h-[22px] w-[22px] shrink-0" />
                    <span className="ml-[9px] w-[102px] whitespace-nowrap text-[12px] font-semibold text-[#17A06B]">
                      {row.status}
                    </span>
                    <Icon name="chevron-right" className="h-[14px] w-[14px] shrink-0 text-[#8E9DBB]" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-[17px] flex h-[68px] items-center rounded-lg border border-[#CDEADB] bg-[#E9F7F0] pl-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#D9F0E5]">
                <Icon name="shield-check" className="h-6 w-6 text-[#17A06B]" strokeWidth={1.75} />
              </span>
              <div className="ml-[13px]">
                <p className="text-[14px] font-bold leading-5 tracking-[-0.02em] text-[#12985F]">Félicitations !</p>
                <p className="mt-[1px] text-[11.5px] leading-4 text-[#44587C]">
                  Le badge <b className="font-semibold text-[#17A06B]">Vérifié</b> est maintenant associé à votre profil et vos annonces.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-[13px]">
              <Link
                to={gerantPath}
                className="-ml-px flex h-[43px] w-[269px] items-center justify-center gap-[14px] rounded-lg bg-[#F26B1D] text-[14px] font-bold tracking-[-0.01em] text-white shadow-[0_5px_12px_rgba(242,106,29,0.28)] transition hover:bg-[#E05A0C]"
              >
                <Icon name="arrow-left" className="h-4 w-4 rotate-180 text-white" strokeWidth={2.2} />
                Retour au tableau de bord
              </Link>
              <Link
                to={`${gerantPath}/chambres`}
                className="flex h-[43px] w-[160px] items-center justify-center gap-2 rounded-lg border-[1.5px] border-[#F26B1D] bg-white text-[13px] font-semibold text-[#F26B1D] transition hover:bg-[#FFF2EA]"
              >
                <Icon name="home" className="h-[17px] w-[17px]" strokeWidth={1.9} />
                Voir mes chambres
              </Link>
            </div>
          </div>
        </div>

        <aside className="space-y-[13px] xl:-mt-[2px]">
          <section className="rounded-xl border border-[#EEF2F8] bg-white px-[13px] pb-[14px] pt-3 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <div className="h-[226px] rounded-lg border border-[#E1E9F5] bg-[#F4F8FD] pl-[13px] pr-[3px] pt-2">
              <div className="flex items-start gap-5">
                <Icon name="shield-check" className="mt-[3px] h-[30px] w-[30px] shrink-0 text-[#1B3A82]" strokeWidth={1.6} />
                <div>
                  <h3 className="text-[14px] font-bold leading-5 tracking-[-0.02em]">Pourquoi cette vérification ?</h3>
                  <p className="mt-[6px] whitespace-nowrap text-[10.5px] leading-[21px] text-[#5F7396]">
                    La vérification permet de sécuriser la plateforme, de protéger les
                    <br />
                    voyageurs et de vous offrir plus de visibilité.
                  </p>
                </div>
              </div>
              <ul className="mt-[11px] pl-[9px] text-[11px] text-[#3D4F73]">
                {['Confiance des voyageurs', 'Moins de risques de fraude', 'Accès aux fonctionnalités Premium', 'Meilleure visibilité de vos annonces'].map((item) => (
                  <li key={item} className="flex h-8 items-center gap-3">
                    <OkBadge className="h-5 w-5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="h-[271px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <header className="flex h-[50px] items-center justify-between pl-[14px] pr-[13px]">
              <h3 className="text-[16px] font-bold tracking-[-0.03em]">Statut de vérification</h3>
              <span className="flex h-[25px] items-center rounded-full bg-[#DDF4E8] px-4 text-[12px] font-semibold text-[#17A06B]">
                Validée
              </span>
            </header>
            <ol className="relative mx-[13px]">
              <span aria-hidden="true" className="absolute bottom-[26px] left-[23px] top-[26px] w-[2px] bg-[#8FD9BB]" />
              {STATUS_ROWS.map((row, index) => (
                <li
                  key={row.label}
                  className={`relative flex h-[49px] items-center pl-[11px] ${
                    index < STATUS_ROWS.length - 1 ? 'border-b border-[#EAEFF7]' : ''
                  }`}
                >
                  <OkBadge className="h-[26px] w-[26px] shrink-0" />
                  <span className={`ml-[13px] flex-1 text-[12.5px] ${row.weight}`}>{row.label}</span>
                  <span className="w-[72px] text-center text-[11.5px] font-bold text-[#17A06B]">{row.state}</span>
                  <Icon name="chevron-right" className="ml-[10px] mr-[11px] h-3 w-3 shrink-0 text-[#93A1BD]" strokeWidth={2.2} />
                </li>
              ))}
            </ol>
          </section>

          <section className="flex rounded-xl border border-[#EEF2F8] bg-white px-[14px] pb-[23px] pt-[10px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full bg-[#F0F4FB]">
              <Icon name="headset" className="h-6 w-6 text-[#1B3A82]" strokeWidth={1.7} />
            </span>
            <div className="ml-[23px] pt-2">
              <h3 className="text-[15px] font-bold leading-5 tracking-[-0.02em]">Besoin d&apos;aide ?</h3>
              <p className="mt-1 whitespace-nowrap text-[11px] leading-[18px] text-[#5F7396]">
                Notre équipe reste disponible si vous avez des questions.
              </p>
              <Link
                to="/contact"
                className="mt-[17px] flex h-[39px] w-[198px] items-center rounded-lg border-[1.5px] border-[#2F5FC4] bg-white pl-[21px] text-[12px] font-semibold text-[#2F5FC4] transition hover:bg-[#F4F8FD]"
              >
                <Icon name="mail" className="h-[17px] w-[17px]" strokeWidth={1.75} />
                <span className="ml-[19px]">Contacter le support</span>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
