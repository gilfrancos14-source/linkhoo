import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import GerantLogoutButton from '../../../components/GerantLogoutButton';
import {
  apiGerants,
  apiUpload,
  type GerantData,
  type VerificationDocument,
  type VerificationStatusResponse,
} from '../../../lib/api';

interface VerificationStaticSectionProps {
  gerantPath: string;
}

type DocKey = 'national_id' | 'proof_of_address' | 'selfie';

interface DocState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: VerificationDocument | null;
  error: string | null;
}

type DocStates = Record<DocKey, DocState>;

const EMPTY_DOC: DocState = {
  file: null,
  preview: null,
  uploading: false,
  uploaded: null,
  error: null,
};

const EMPTY_DOCS: DocStates = {
  national_id: { ...EMPTY_DOC },
  proof_of_address: { ...EMPTY_DOC },
  selfie: { ...EMPTY_DOC },
};

interface PersonalInfoForm {
  prenom: string;
  nom: string;
  date_of_birth: string;
  nationality: string;
  phone: string;
  address: string;
}

type PersonalInfoFields = {
  [K in keyof PersonalInfoForm]?: string | null;
};

const EMPTY_PERSONAL_INFO: PersonalInfoForm = {
  prenom: '',
  nom: '',
  date_of_birth: '',
  nationality: '',
  phone: '',
  address: '',
};

const PERSONAL_INFO_FIELDS = [
  ['prenom', 'Prénom', 'text', 'Ex. Awa', 'given-name'],
  ['nom', 'Nom', 'text', 'Ex. Kouassi', 'family-name'],
  ['date_of_birth', 'Date de naissance', 'date', '', 'bday'],
  ['nationality', 'Nationalité', 'text', 'Ex. Ivoirienne', 'country-name'],
  ['phone', 'Téléphone', 'tel', 'Ex. +225 07 00 00 00', 'tel'],
] as const;

const FIELD_LABEL_CLASS = 'block text-[12px] font-bold text-[#1F3566]';
const FIELD_INPUT_BASE =
  'mt-2 flex h-11 w-full rounded-lg border px-3.5 text-[13px] font-medium outline-none transition';
const FIELD_INPUT_CLASS = `${FIELD_INPUT_BASE} border-[#8AA8DD] bg-[#EEF4FF] text-[#0F2150] shadow-[inset_0_1px_2px_rgba(20,40,90,0.05)] placeholder:font-normal placeholder:text-[#8A99B5] hover:border-[#6F92CF] hover:bg-[#E6EEFF] focus:border-[#3563C8] focus:bg-white focus:ring-2 focus:ring-[#3563C8]/20 disabled:cursor-not-allowed disabled:border-[#C7D4E8] disabled:bg-[#F7F9FD] disabled:text-[#5F7396]`;
const FIELD_INPUT_READONLY_CLASS = `${FIELD_INPUT_BASE} border-[#C7D4E8] bg-[#E9EFF9] text-[#5F7396]`;

function isPersonalInfoComplete(info: PersonalInfoFields): boolean {
  return Object.values(info).every((value) => Boolean(value?.trim()));
}

function personalInfoFromGerant(gerant: GerantData): PersonalInfoForm {
  return {
    prenom: gerant.prenom ?? '',
    nom: gerant.nom ?? '',
    date_of_birth: gerant.date_of_birth?.slice(0, 10) ?? '',
    nationality: gerant.nationality ?? '',
    phone: gerant.phone ?? '',
    address: gerant.address ?? '',
  };
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'shield'
  | 'shield-check'
  | 'id'
  | 'doc'
  | 'camera'
  | 'bulb'
  | 'check'
  | 'headset';

const ICONS: Record<IconName, ReactNode> = {
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
  shield: (
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  ),
  'shield-check': (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  id: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2.5" />
      <circle cx="8.5" cy="10.5" r="2" />
      <path d="M5 16.5c.6-1.8 1.8-2.5 3.5-2.5s2.9.7 3.5 2.5" />
      <path d="M14.5 9.5H19" />
      <path d="M14.5 13H19" />
    </>
  ),
  doc: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h2" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  bulb: (
    <>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  headset: (
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  ),
};

function Icon({
  name,
  className = 'h-4 w-4',
  strokeWidth = 2,
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

function OkBadge({ className = 'h-[14px] w-[14px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#27B585" />
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

function IdPreview() {
  return (
    <div className="h-[56px] overflow-hidden rounded-md">
      <svg viewBox="0 0 114 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-label="Aperçu de la pièce d'identité">
        <defs>
          <linearGradient id="verif-static-id-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D9E0EF" />
            <stop offset="1" stopColor="#A9B7D6" />
          </linearGradient>
        </defs>
        <rect width="114" height="56" fill="url(#verif-static-id-gradient)" />
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

function AddressPreview() {
  return (
    <div className="h-[56px] overflow-hidden rounded-md">
      <svg viewBox="0 0 114 56" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-label="Aperçu du justificatif">
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

function SelfiePreview() {
  return (
    <div className="h-[70px] overflow-hidden rounded-md">
      <svg viewBox="0 14 100 61" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-label="Aperçu du selfie">
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
  );
}

const STEPS = [
  { title: 'Informations personnelles', description: 'Vos coordonnées et identité', lineWidth: 'w-[160px]' },
  { title: 'Documents', description: 'Pièce d’identité et justificatifs', lineWidth: '' },
];

const DOC_CONFIGS = [
  {
    key: 'national_id' as const,
    title: "Pièce d'identité",
    description:
      "Téléchargez une photo claire de votre pièce d'identité (carte nationale, passeport ou permis de conduire).",
    accept: '.jpg,.jpeg,.png,.pdf',
    formats: 'Formats acceptés : JPG, PNG, PDF',
    icon: 'id' as const,
    cardHeight: 'h-[176px]',
    dropHeight: 'h-[96px]',
    previewTop: 'top-[63px]',
    previewHeight: 'h-[94px]',
    previewInnerHeight: 'h-[56px]',
    preview: <IdPreview />,
  },
  {
    key: 'proof_of_address' as const,
    title: 'Justificatif de domicile',
    description:
      'Téléchargez une facture récente (électricité, eau, internet) ou un document officiel à votre nom.',
    accept: '.jpg,.jpeg,.png,.pdf',
    formats: 'Formats acceptés : JPG, PNG, PDF',
    icon: 'doc' as const,
    cardHeight: 'h-[177px]',
    dropHeight: 'h-[96px]',
    previewTop: 'top-[63px]',
    previewHeight: 'h-[94px]',
    previewInnerHeight: 'h-[56px]',
    preview: <AddressPreview />,
  },
  {
    key: 'selfie' as const,
    title: 'Photo de vous',
    description:
      'Prenez un selfie clair pour confirmer que vous êtes bien le propriétaire du compte.',
    accept: '.jpg,.jpeg,.png',
    formats: 'Formats acceptés : JPG, PNG',
    icon: 'camera' as const,
    cardHeight: 'h-[153px]',
    dropHeight: 'h-[80px]',
    previewTop: 'top-[38px]',
    previewHeight: 'h-[105px]',
    previewInnerHeight: 'h-[70px]',
    preview: <SelfiePreview />,
  },
];

export default function VerificationStaticSection({ gerantPath }: VerificationStaticSectionProps) {
  const chambresPath = `${gerantPath}/chambres`;
  const reservationsPath = `${gerantPath}/reservations`;
  const messagesPath = `${gerantPath}/messages/boite-reception`;
  const online = useOnlineStatus();

  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusResponse | null>(null);
  const [docs, setDocs] = useState<DocStates>(EMPTY_DOCS);
  const [step, setStep] = useState<1 | 2>(1);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfoForm>(EMPTY_PERSONAL_INFO);
  const [savingPersonalInfo, setSavingPersonalInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const currentGerant = await apiGerants.getMe();
      setGerant(currentGerant);
      setPersonalInfo(personalInfoFromGerant(currentGerant));
      setStep(isPersonalInfoComplete(personalInfoFromGerant(currentGerant)) ? 2 : 1);
      const [status, documents] = await Promise.all([
        apiGerants.getVerificationStatus(currentGerant.id),
        apiGerants.getDocuments(currentGerant.id),
      ]);
      setVerificationStatus(status);

      const byType = new Map<VerificationDocument['document_type'], VerificationDocument>();
      for (const doc of documents) {
        byType.set(doc.document_type, doc);
      }

      setDocs({
        national_id: { ...EMPTY_DOC, uploaded: byType.get('national_id') ?? null },
        proof_of_address: { ...EMPTY_DOC, uploaded: byType.get('proof_of_address') ?? null },
        selfie: { ...EMPTY_DOC, uploaded: byType.get('selfie') ?? null },
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Impossible de charger votre dossier.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const overallStatus = verificationStatus?.verification_status ?? 'none';
  const canEdit = !loading && (overallStatus === 'none' || overallStatus === 'rejected');
  const allDocsUploaded = Boolean(
    docs.national_id.uploaded && docs.proof_of_address.uploaded && docs.selfie.uploaded,
  );
  const personalInfoComplete = isPersonalInfoComplete(personalInfo);

  const handlePersonalInfoChange = (key: keyof PersonalInfoForm, value: string) => {
    setPersonalInfo((prev) => ({ ...prev, [key]: value }));
  };

  const handleSavePersonalInfo = async () => {
    if (!gerant || !canEdit) return;
    if (!personalInfoComplete) {
      setActionError('Complétez tous les champs de vos informations personnelles.');
      return;
    }
    if (!online) {
      setActionError('Connexion requise pour enregistrer vos informations.');
      return;
    }

    setSavingPersonalInfo(true);
    setActionError('');
    setSuccess('');
    try {
      const updated = await apiGerants.updateMe({
        prenom: personalInfo.prenom.trim(),
        nom: personalInfo.nom.trim(),
        date_of_birth: personalInfo.date_of_birth,
        nationality: personalInfo.nationality.trim(),
        phone: personalInfo.phone.trim(),
        address: personalInfo.address.trim(),
      });
      setGerant(updated);
      setPersonalInfo(personalInfoFromGerant(updated));
      setSuccess('Vos informations personnelles ont été enregistrées.');
      setStep(2);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement de vos informations.",
      );
    } finally {
      setSavingPersonalInfo(false);
    }
  };

  const handleFileSelect = async (key: DocKey, file: File) => {
    if (!gerant || !canEdit) return;
    const config = DOC_CONFIGS.find((item) => item.key === key);
    if (!config) return;

    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    const accepted = config.accept.split(',').includes(extension);
    if (!accepted) {
      setDocs((prev) => ({
        ...prev,
        [key]: { ...prev[key], error: `Format non accepté. ${config.formats}.` },
      }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setDocs((prev) => ({
        ...prev,
        [key]: { ...prev[key], error: 'Fichier trop volumineux (5 Mo maximum).' },
      }));
      return;
    }

    const localPreview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    const previousDoc = docs[key].uploaded;

    setActionError('');
    setSuccess('');
    setDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], file, preview: localPreview, uploading: true, error: null },
    }));

    try {
      const upload = await apiUpload.upload(file, 'verification-docs');
      const saved = await apiGerants.addDocument(gerant.id, {
        document_type: key,
        file_path: upload.path,
        original_filename: file.name,
        mime_type: file.type || undefined,
        file_size: file.size,
        replace: Boolean(previousDoc),
      });

      setDocs((prev) => ({
        ...prev,
        [key]: { ...EMPTY_DOC, uploaded: saved },
      }));
      setVerificationStatus((prev) =>
        prev
          ? {
              ...prev,
              documents: [...prev.documents.filter((doc) => doc.document_type !== key), saved],
            }
          : prev,
      );
      setSuccess(`« ${config.title} » a bien été ajouté.`);
    } catch (err) {
      setDocs((prev) => ({
        ...prev,
        [key]: {
          ...EMPTY_DOC,
          uploaded: previousDoc,
          error: err instanceof Error ? err.message : "Erreur lors de l'envoi du document.",
        },
      }));
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview);
    }
  };

  const handleRemove = async (key: DocKey) => {
    const doc = docs[key].uploaded;
    if (!gerant || !doc || !canEdit) return;

    setActionError('');
    setSuccess('');
    setDocs((prev) => ({ ...prev, [key]: { ...prev[key], uploading: true, error: null } }));
    try {
      await apiGerants.deleteDocument(gerant.id, doc.id);
      setDocs((prev) => ({ ...prev, [key]: { ...EMPTY_DOC } }));
      setVerificationStatus((prev) =>
        prev
          ? { ...prev, documents: prev.documents.filter((item) => item.document_type !== key) }
          : prev,
      );
      setSuccess('Document supprimé.');
    } catch (err) {
      setDocs((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          uploading: false,
          error: err instanceof Error ? err.message : 'Erreur lors de la suppression.',
        },
      }));
    }
  };

  const handleSubmit = async () => {
    if (!gerant) return;
    if (!personalInfoComplete) {
      setActionError('Complétez vos informations personnelles avant de soumettre votre dossier.');
      setStep(1);
      return;
    }
    if (!allDocsUploaded) {
      setActionError('Ajoutez les trois documents avant de soumettre votre dossier.');
      return;
    }
    if (!online) {
      setActionError('Connexion requise pour envoyer votre demande.');
      return;
    }

    setSubmitting(true);
    setActionError('');
    setSuccess('');
    try {
      const result = await apiGerants.submitVerification(gerant.id);
      setGerant(result.gerant);
      setVerificationStatus((prev) =>
        prev
          ? {
              ...prev,
              verification_status: result.gerant.verification_status,
              verification_submitted_at: result.gerant.verification_submitted_at,
              verification_rejection_reason: null,
            }
          : prev,
      );
      setDocs((prev) => ({
        national_id: {
          ...prev.national_id,
          uploaded: prev.national_id.uploaded
            ? { ...prev.national_id.uploaded, status: 'pending', rejection_reason: null }
            : null,
        },
        proof_of_address: {
          ...prev.proof_of_address,
          uploaded: prev.proof_of_address.uploaded
            ? { ...prev.proof_of_address.uploaded, status: 'pending', rejection_reason: null }
            : null,
        },
        selfie: {
          ...prev.selfie,
          uploaded: prev.selfie.uploaded
            ? { ...prev.selfie.uploaded, status: 'pending', rejection_reason: null }
            : null,
        },
      }));
      setSuccess('Votre demande a été soumise. Un administrateur va examiner vos documents.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = gerant ? `${gerant.prenom} ${gerant.nom}`.trim() || 'Gérant' : 'Gérant';

  const statusRows = DOC_CONFIGS.map((config) => {
    const doc = docs[config.key].uploaded;
    const label =
      config.key === 'national_id'
        ? "Pièce d'identité"
        : config.key === 'proof_of_address'
          ? 'Justificatif de domicile'
          : 'Photo de vous';

    if (!doc) return { label, state: 'À ajouter', status: 'waiting' as const };
    if (doc.status === 'approved') return { label, state: 'Validé', status: 'validated' as const };
    if (doc.status === 'rejected') return { label, state: 'Rejeté', status: 'rejected' as const };
    if (overallStatus === 'pending' || overallStatus === 'under_review') {
      return { label, state: 'En cours', status: 'progress' as const };
    }
    return { label, state: 'Ajouté', status: 'waiting' as const };
  });
  statusRows.unshift({
    label: 'Informations personnelles',
    state: personalInfoComplete ? 'Validé' : 'À compléter',
    status: personalInfoComplete ? ('validated' as const) : ('waiting' as const),
  });
  statusRows.push({
    label: 'Validation finale',
    state:
      overallStatus === 'approved'
        ? 'Validé'
        : overallStatus === 'rejected'
          ? 'Rejeté'
          : overallStatus === 'pending' || overallStatus === 'under_review'
            ? 'En cours'
            : 'En attente',
    status:
      overallStatus === 'approved'
        ? 'validated'
        : overallStatus === 'rejected'
          ? 'rejected'
          : overallStatus === 'pending' || overallStatus === 'under_review'
            ? 'progress'
            : 'waiting',
  });

  const statusBadge =
    overallStatus === 'approved'
      ? { label: 'Validé', className: 'bg-[#E5F6EE] text-[#35A57A]' }
      : overallStatus === 'rejected'
        ? { label: 'Rejeté', className: 'bg-[#FDE8E8] text-[#D64545]' }
        : overallStatus === 'pending'
          ? { label: 'En attente', className: 'bg-[#FFF2E6] text-[#F26B1D]' }
          : overallStatus === 'under_review'
            ? { label: 'En cours', className: 'bg-[#EAF1FD] text-[#3563C8]' }
            : { label: 'À compléter', className: 'bg-[#EDF1F8] text-[#8393B0]' };

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
        <symbol id="i-card" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" /></symbol>
        <symbol id="i-id" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2.5" /><circle cx="8.5" cy="10.5" r="2" /><path d="M5 16.5c.6-1.8 1.8-2.5 3.5-2.5s2.9.7 3.5 2.5" /><path d="M14.5 9.5H19" /><path d="M14.5 13H19" /></symbol>
        <symbol id="i-doc" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M8 13h8" /><path d="M8 17h8" /><path d="M8 9h2" /></symbol>
        <symbol id="i-camera" viewBox="0 0 24 24"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></symbol>
        <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></symbol>
        <symbol id="i-headset" viewBox="0 0 24 24"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
        <symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>
        <symbol id="i-chev-up" viewBox="0 0 24 24"><path d="m18 15-6-6-6 6" /></symbol>
        <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></symbol>
        <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></symbol>
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
            <Link to={`${gerantPath}/verification`} aria-current="page" className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg bg-[#FDEDE2] px-[11px] text-[12.5px] font-bold text-[#F26B1D]">
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] shrink-0" aria-hidden="true">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="#F26B1D" stroke="#F26B1D" strokeWidth="2" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>Vérification
            </Link>
            <div className="mt-[5px]">
              <Link to={`${gerantPath}/verification`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-file-text" /></svg>Mes documents</Link>
              <Link to={`${gerantPath}/verification/suivi`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]"><svg className="ic h-[14px] w-[14px] shrink-0 text-[#6F82A6]"><use href="#i-user-check" /></svg>Suivi de vérification</Link>
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
                <span className="block max-w-[95px] truncate text-[12px] font-bold">{displayName}</span>
                <span className="mt-[7px] block text-[11px] text-[#8A99B5]">Gérant</span>
              </span>
              <GerantLogoutButton className="ml-auto" />
            </div>
          </div>
        </header>

        <main className="pb-10 pl-[23px] pr-[25px]">
          <Link
            to={gerantPath}
            className="ml-[5px] mt-[14px] inline-flex items-center gap-[10px] text-[12.5px] font-bold"
          >
            <Icon name="arrow-left" className="h-[13px] w-[13px]" strokeWidth={2.4} />
            Retour
          </Link>

          <h1 className="mt-px text-[31px] font-extrabold leading-[36px] tracking-[-0.01em] text-[#0D2150]">Vérification</h1>
          <p className="mt-px text-[15px] leading-5 text-[#5F7396]">
            Vérifiez votre identité pour publier vos annonces et gagner la confiance des voyageurs.
          </p>

          {loadError && (
            <p role="alert" className="mt-3 rounded-lg border border-[#F5C2C2] bg-[#FDF1F1] px-4 py-2.5 text-[12px] text-[#C23B3B]">
              {loadError}
            </p>
          )}
          {actionError && (
            <p role="alert" className="mt-3 rounded-lg border border-[#F5C2C2] bg-[#FDF1F1] px-4 py-2.5 text-[12px] text-[#C23B3B]">
              {actionError}
            </p>
          )}
          {success && (
            <p role="status" className="mt-3 rounded-lg border border-[#BFE8D5] bg-[#F1FAF6] px-4 py-2.5 text-[12px] text-[#238A62]">
              {success}
            </p>
          )}

          <ol className="mt-[21px] flex h-[74px] items-center overflow-hidden rounded-xl border border-[#EEF2F8] bg-white px-[23px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            {STEPS.map((stepConfig, index) => {
              const stepNumber = (index + 1) as 1 | 2;
              const active = step === stepNumber;
              const completed = stepNumber < step;
              const locked = stepNumber === 2 && !personalInfoComplete;
              return (
                <Fragment key={stepConfig.title}>
                  <li className="flex shrink-0 items-center" aria-current={active ? 'step' : undefined}>
                    <button
                      type="button"
                      onClick={() => setStep(stepNumber)}
                      disabled={locked}
                      className="flex items-center gap-[14px] text-left disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span
                        className={`grid h-[33px] w-[33px] place-items-center rounded-full text-[13px] font-bold ${
                          active
                            ? 'bg-[#F26B1D] text-white'
                            : completed
                              ? 'bg-[#E5F6EE] text-[#2FA67B]'
                              : 'border-[1.5px] border-[#D9E4F8] text-[#2D4C8A]'
                        }`}
                      >
                        {completed ? <Icon name="check" className="h-[15px] w-[15px]" strokeWidth={3} /> : stepNumber}
                      </span>
                      <div>
                        <p className={`text-[12.5px] font-bold leading-4 ${active ? 'text-[#F26B1D]' : 'text-[#37588F]'}`}>
                          {stepConfig.title}
                        </p>
                        <p className={`mt-[3px] text-[11px] leading-4 ${active ? 'text-[#F26B1D]' : 'text-[#8A99B5]'}`}>
                          {stepConfig.description}
                        </p>
                      </div>
                    </button>
                  </li>
                  {index < STEPS.length - 1 && (
                    <li aria-hidden="true" className={`mx-4 h-px shrink bg-[#E6ECF6] ${stepConfig.lineWidth}`} />
                  )}
                </Fragment>
              );
            })}
          </ol>

          <div className="mt-[18px] grid items-start gap-[22px] xl:grid-cols-[minmax(0,1fr)_426px]">
            <section className="rounded-xl border border-[#EEF2F8] bg-white p-[17px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
              {step === 1 ? (
                <>
                  <div className="flex items-center gap-[13px]">
                    <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full bg-[#F26B1D]">
                      <Icon name="id" className="h-[22px] w-[22px] text-white" strokeWidth={2} />
                    </span>
                    <div>
                      <h2 className="text-[18px] font-bold leading-[24px]">Informations personnelles</h2>
                      <p className="mt-px text-[12.5px] leading-[18px] text-[#5F7396]">
                        Ces informations seront comparées avec vos documents par notre équipe.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-x-4 gap-y-4 sm:grid-cols-2">
                    {PERSONAL_INFO_FIELDS.map(([key, label, type, placeholder, autoComplete]) => (
                      <label key={key} className={FIELD_LABEL_CLASS}>
                        {label}
                        <input
                          type={type}
                          value={personalInfo[key]}
                          onChange={(event) => handlePersonalInfoChange(key, event.target.value)}
                          placeholder={placeholder}
                          autoComplete={autoComplete}
                          disabled={!canEdit || savingPersonalInfo}
                          className={FIELD_INPUT_CLASS}
                        />
                      </label>
                    ))}

                    <label className={FIELD_LABEL_CLASS}>
                      Email
                      <input
                        type="email"
                        value={gerant?.email ?? ''}
                        readOnly
                        className={FIELD_INPUT_READONLY_CLASS}
                      />
                    </label>

                    <label className={`${FIELD_LABEL_CLASS} sm:col-span-2`}>
                      Adresse complète
                      <input
                        type="text"
                        value={personalInfo.address}
                        onChange={(event) => handlePersonalInfoChange('address', event.target.value)}
                        placeholder="Ex. Houeto, Cotonou, Bénin"
                        autoComplete="street-address"
                        disabled={!canEdit || savingPersonalInfo}
                        className={FIELD_INPUT_CLASS}
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E3EAF6] bg-[#F5F8FE] px-4 py-3">
                    <p className="max-w-[360px] text-[11.5px] leading-5 text-[#5F7396]">
                      <span className="font-semibold text-[#1F3566]">Tous les champs sont obligatoires.</span>{' '}
                      Vérifiez l&apos;orthographe de votre nom et votre date de naissance : ils doivent
                      correspondre à votre pièce d&apos;identité.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSavePersonalInfo()}
                      disabled={!canEdit || !personalInfoComplete || savingPersonalInfo || !online}
                      className="flex h-[35px] items-center justify-center gap-2 rounded-lg bg-[#F26B1D] px-4 text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(242,107,29,0.25)] transition hover:bg-[#E05A0C] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPersonalInfo ? 'Enregistrement...' : 'Continuer vers les documents'}
                      <Icon name="arrow-right" className="h-[12px] w-[12px]" strokeWidth={2.6} />
                    </button>
                  </div>
                </>
              ) : (
                <>
              <div className="flex items-center gap-[13px]">
                <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full bg-[#F26B1D]">
                  <Icon name="shield" className="h-[22px] w-[22px] text-white" strokeWidth={2.2} />
                </span>
                <div>
                  <h2 className="text-[18px] font-bold leading-[24px]">Vérification de votre compte</h2>
                  <p className="mt-px text-[12.5px] leading-[18px] text-[#5F7396]">
                    Téléchargez les documents nécessaires pour confirmer votre identité et devenir un hôte de confiance.
                  </p>
                </div>
              </div>

              {DOC_CONFIGS.map((config, index) => {
                const state = docs[config.key];
                const doc = state.uploaded;
                const previewSrc =
                  state.preview ??
                  (doc?.file_url && doc.mime_type?.startsWith('image/') ? doc.file_url : null);
                const isPdf = Boolean(doc && !doc.mime_type?.startsWith('image/'));
                const margin = index === 0 ? 'mt-5' : index === 1 ? 'mt-3' : 'mt-[13px]';

                return (
                  <article
                    key={config.key}
                    className={`relative ${margin} ${config.cardHeight} rounded-lg border border-[#E8EDF6] bg-white`}
                  >
                    <span className="absolute left-[12px] top-[13px] grid h-[30px] w-[30px] place-items-center rounded-full bg-[#EAF1FD] text-[12.5px] font-bold text-[#3563C8]">
                      {index + 1}
                    </span>
                    <div className="pl-[57px] pt-[13px]">
                      <h3 className="text-[13px] font-bold leading-5">{config.title}</h3>
                      <p className="mt-[2px] text-[10.5px] leading-4 text-[#5F7396]">
                        {config.description}
                      </p>
                    </div>
                    <label
                      className={`ml-[57px] mr-[183px] mt-[13px] flex ${config.dropHeight} items-center rounded-lg border-[1.5px] border-dashed border-[#D3DDEE] bg-white pl-[31px] transition ${
                        canEdit
                          ? 'cursor-pointer hover:border-[#F26B1D]/60 hover:bg-[#FFF2EA]/40'
                          : 'cursor-not-allowed opacity-70'
                      }`}
                    >
                      <input
                        type="file"
                        accept={config.accept}
                        aria-label={`Téléverser ${config.title}`}
                        className="sr-only"
                        disabled={!canEdit || state.uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleFileSelect(config.key, file);
                          event.target.value = '';
                        }}
                      />
                      <Icon name={config.icon} className="h-[42px] w-[42px] shrink-0 text-[#1F3C88]" strokeWidth={1.5} />
                      <span className="ml-[29px]">
                        <span className="block text-[12px] font-medium text-[#3F5683]">
                          Glissez votre fichier ici ou <b className="font-bold text-[#1F3C7A]">cliquez pour parcourir</b>
                        </span>
                        {state.error ? (
                          <span className="mt-[7px] block text-[10px] text-[#C23B3B]">{state.error}</span>
                        ) : (
                          <span className="mt-[7px] block text-[10px] text-[#8A99B5]">
                            {config.formats} <span className="mx-1.5">•</span> Taille max : 5 Mo
                          </span>
                        )}
                      </span>
                    </label>

                    <div
                      className={`absolute right-[29px] ${config.previewTop} ${config.previewHeight} w-[130px] rounded-lg border border-[#E6ECF5] bg-white p-2 shadow-sm ${
                        config.key === 'selfie' ? 'pb-[7px]' : ''
                      }`}
                    >
                      <div className={`${config.previewInnerHeight} overflow-hidden rounded-md`}>
                        {previewSrc ? (
                          <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                        ) : isPdf ? (
                          <div className="grid h-full place-items-center bg-[#F5F8FE] text-[10px] font-semibold text-[#5F7396]">
                            PDF
                          </div>
                        ) : (
                          config.preview
                        )}
                      </div>
                      <p
                        className={`flex items-center justify-between gap-1.5 text-[10px] font-semibold leading-[14px] ${
                          config.key === 'selfie' ? 'mt-[6px]' : 'mt-2'
                        }`}
                      >
                        <span
                          className={`flex items-center gap-1.5 ${
                            doc ? 'text-[#2E9E78]' : state.uploading ? 'text-[#F26B1D]' : 'text-[#8A99B5]'
                          }`}
                        >
                          {doc ? (
                            <OkBadge className="h-3 w-3" />
                          ) : state.uploading ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[#F26B1D] border-t-transparent" />
                          ) : (
                            <span className="h-3 w-3 rounded-full border-[1.5px] border-[#C9D2E4]" />
                          )}
                          {state.uploading ? 'Envoi...' : doc ? 'Ajouté' : 'À ajouter'}
                        </span>
                        {doc && canEdit && !state.uploading && (
                          <button
                            type="button"
                            onClick={() => void handleRemove(config.key)}
                            className="text-[9px] font-semibold text-[#8A99B5] underline decoration-[#C9D2E4] hover:text-[#C23B3B]"
                          >
                            Retirer
                          </button>
                        )}
                      </p>
                    </div>
                  </article>
                );
              })}

              <div className="relative mt-3 h-[82px] rounded-lg border border-[#FDE2D0] bg-[#FFF2EA]">
                <Icon name="bulb" className="absolute left-[14px] top-[12px] h-[20px] w-[20px] text-[#F26B1D]" strokeWidth={1.75} />
                <div className="pl-[45px] pt-[10px]">
                  <p className="text-[11px] font-bold leading-[14px] text-[#F26B1D]">Conseils pour une validation rapide</p>
                  <ul className="mt-[5px] space-y-0 text-[10px] leading-[15px] text-[#4A5878]">
                    <li className="flex items-center gap-[5px]">
                      <Icon name="check" className="h-[9px] w-[9px] text-[#F26B1D]" strokeWidth={3.2} />
                      Utilisez des documents lisibles et non flous
                    </li>
                    <li className="flex items-center gap-[5px]">
                      <Icon name="check" className="h-[9px] w-[9px] text-[#F26B1D]" strokeWidth={3.2} />
                      Assurez-vous que vos informations sont à jour
                    </li>
                    <li className="flex items-center gap-[5px]">
                      <Icon name="check" className="h-[9px] w-[9px] text-[#F26B1D]" strokeWidth={3.2} />
                      La vérification peut prendre entre 24 et 48 heures
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canEdit || !personalInfoComplete || !allDocsUploaded || submitting || !online}
                  className="absolute right-[10px] top-[23px] flex h-[35px] w-[181px] items-center justify-center gap-2 rounded-lg bg-[#F26B1D] text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(242,107,29,0.25)] transition hover:bg-[#E05A0C] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Envoi en cours...'
                    : loading
                      ? 'Chargement...'
                      : !canEdit
                        ? overallStatus === 'approved'
                          ? 'Compte vérifié'
                          : 'Demande en cours'
                        : !personalInfoComplete
                          ? 'Complétez vos informations'
                          : !allDocsUploaded
                            ? 'Ajoutez les 3 documents'
                            : !online
                              ? 'Hors ligne'
                              : 'Soumettez pour vérification'}
                  <Icon name="arrow-right" className="h-[12px] w-[12px]" strokeWidth={2.6} />
                </button>
              </div>
                </>
              )}
            </section>

            <aside className="space-y-[14.5px] rounded-xl border border-[#EEF2F8] bg-white px-[13px] pb-[15px] pt-[14px] shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
              <section className="h-[239px] rounded-xl border border-[#E3EAF6] bg-[#F5F8FE] px-[19px] pt-[12px]">
                <div className="flex items-start gap-[15px]">
                  <Icon name="shield-check" className="mt-[1px] h-[24px] w-[24px] shrink-0 text-[#2F5FC4]" strokeWidth={1.75} />
                  <div>
                    <h3 className="text-[13.5px] font-bold leading-5">Pourquoi cette vérification ?</h3>
                    <p className="mt-2 text-[11.5px] leading-5 text-[#5F7396]">
                      La vérification permet de sécuriser la plateforme, de protéger les
                      <br />
                      voyageurs et de vous offrir plus de visibilité.
                    </p>
                  </div>
                </div>
                <ul className="mt-[13px] pl-[10px] text-[11px] text-[#3D4F73]">
                  {['Confiance des voyageurs', 'Moins de risques de fraude', 'Accès aux fonctionnalités Premium', 'Meilleure visibilité de vos annonces'].map((item) => (
                    <li key={item} className="flex h-[33px] items-center gap-[15px]">
                      <OkBadge className="h-[14px] w-[14px] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="h-[327px] overflow-hidden rounded-xl border border-[#E8EDF6] bg-white">
                <header className="flex h-[47px] items-center justify-between border-b border-[#EEF2F8] pl-[20px] pr-[19px]">
                  <h3 className="text-[15px] font-bold">Statut de vérification</h3>
                  <span className={`rounded-full px-[9px] py-[2px] text-[10px] font-medium leading-[14px] ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </header>
                <ul>
                  {statusRows.map((row, index) => (
                    <li
                      key={row.label}
                      className={`flex h-[56px] items-start pl-[25px] pr-[19px] pt-[9px] ${
                        index < statusRows.length - 1 ? 'border-b border-[#EEF2F8]' : ''
                      }`}
                    >
                      {row.status === 'validated' ? (
                        <OkBadge className="mt-[1px] h-[18px] w-[18px] shrink-0" />
                      ) : row.status === 'progress' ? (
                        <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#F26B1D]">
                          <span className="h-2 w-2 rounded-full border-[1.5px] border-white" />
                        </span>
                      ) : row.status === 'rejected' ? (
                        <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#FDE8E8] text-[11px] font-bold leading-none text-[#D64545]">
                          ×
                        </span>
                      ) : (
                        <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#C9D2E4]">
                          <span className="h-2 w-2 rounded-full border-[1.5px] border-white" />
                        </span>
                      )}
                      <div className="ml-[14px]">
                        <p className="text-[11px] font-bold leading-4">{row.label}</p>
                        {row.status !== 'waiting' && (
                          <p className="mt-[7px] text-[10.5px] leading-[14px] text-[#8A99B5]">
                            {row.status === 'validated'
                              ? 'Validé'
                              : row.status === 'rejected'
                                ? 'Rejeté'
                                : 'En cours'}
                          </p>
                        )}
                      </div>
                      <span
                        className={
                          row.status === 'validated'
                            ? 'ml-auto mt-[8px] rounded-full bg-[#E5F6EE] px-[8px] py-[2px] text-[10px] font-medium leading-[14px] text-[#2FA67B]'
                            : row.status === 'progress'
                              ? 'ml-auto mt-[4px] rounded-full bg-[#FDEBDD] px-[9px] py-[2px] text-[10px] font-medium leading-[14px] text-[#F26B1D]'
                              : row.status === 'rejected'
                                ? 'ml-auto mt-[4px] rounded-full bg-[#FDE8E8] px-[9px] py-[2px] text-[10px] font-medium leading-[14px] text-[#D64545]'
                                : 'ml-auto mt-[4px] rounded-full bg-[#EDF1F8] px-[9px] py-[2px] text-[10px] font-medium leading-[14px] text-[#8393B0]'
                        }
                      >
                        {row.state}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="h-[133px] rounded-xl border border-[#E3EAF6] bg-[#F5F8FE] pl-[19px] pr-[20px] pt-[13px]">
                <div className="flex items-start gap-[17px]">
                  <Icon name="headset" className="mt-[3px] h-[26px] w-[26px] shrink-0 text-[#2F5FC4]" strokeWidth={1.75} />
                  <div>
                    <h3 className="text-[12px] font-bold leading-4">Besoin d&apos;aide ?</h3>
                    <p className="mt-[3px] text-[11px] leading-[19px] text-[#5F7396]">
                      Notre équipe est disponible pour vous accompagner dans votre
                      <br />
                      vérification.
                    </p>
                  </div>
                </div>
                <Link
                  to="/contact"
                  className="ml-[45px] mt-[10px] flex h-[35px] w-[174px] items-center gap-[9px] rounded-lg border border-[#E1E8F4] bg-white pl-[18px] text-[11px] font-bold text-[#2F5FC4] shadow-sm transition hover:border-[#2F5FC4]/40"
                >
                  <Icon name="camera" className="h-[15px] w-[15px]" strokeWidth={1.75} />
                  Contacter le support
                </Link>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
