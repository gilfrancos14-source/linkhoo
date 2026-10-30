import { Briefcase } from 'lucide-react';

interface ProfessionalInfoProps {
  marketLabel: string;
  verificationLabel: string;
  premium: boolean;
}

/**
 * Section "Informations professionnelles".
 */
export function ProfessionalInfoSection({ marketLabel, verificationLabel, premium }: ProfessionalInfoProps) {
  return (
    <section className="relative mt-[15px] h-[164px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <h2 className="absolute left-6 top-4 flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
        <Briefcase size={20} className="stroke-[1.75] text-[#2F5FC4]" />Informations professionnelles
      </h2>

      <dl className="absolute left-[22px] top-[47px] text-[12px]">
        <div className="flex h-6 items-center">
          <dt className="w-[190px] font-medium text-[#1F3566]">Marché</dt>
          <dd className="text-[#2F4472]">{marketLabel}</dd>
        </div>
        <div className="flex h-6 items-center">
          <dt className="w-[190px] font-medium text-[#1F3566]">Rôle</dt>
          <dd className="text-[#2F4472]">Gérant</dd>
        </div>
        <div className="mt-px flex h-6 items-center">
          <dt className="w-[190px] font-medium text-[#1F3566]">Vérification</dt>
          <dd className="text-[#2F4472]">{verificationLabel}</dd>
        </div>
        <div className="mt-[3px] flex h-6 items-center">
          <dt className="w-[190px] font-medium text-[#1F3566]">Premium</dt>
          <dd className="text-[#2F4472]">{premium ? 'Actif' : 'Inactif'}</dd>
        </div>
      </dl>
    </section>
  );
}
