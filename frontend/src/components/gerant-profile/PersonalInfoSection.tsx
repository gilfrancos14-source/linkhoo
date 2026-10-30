import { User as LucideUser } from 'lucide-react';

interface PersonalInfoProps {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  nationality: string;
  marketLabel: string;
  address: string;
  memberSince: string;
}

/**
 * Section "Informations personnelles" sous forme de liste de définitions.
 */
export function PersonalInfoSection({
  fullName, email, phone, birthDate, nationality, marketLabel, address, memberSince,
}: PersonalInfoProps) {
  return (
    <section className="relative mt-[15px] h-[286px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <h2 className="absolute left-6 top-[14px] flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
        <LucideUser size={20} className="stroke-[1.75] text-[#2F5FC4]" />Informations personnelles
      </h2>

      <dl className="absolute left-[22px] top-[59px] text-[12px] text-[#1F3566]">
        <div>
          <dt className="font-medium leading-[18px]">Nom complet</dt>
          <dd className="leading-[17px] text-[#2A416F]">{fullName}</dd>
        </div>
        <div className="mt-[5px]">
          <dt className="font-medium leading-[18px]">Email</dt>
          <dd className="leading-[17px] text-[#2A416F]">{email}</dd>
        </div>
        <div className="mt-[7px]">
          <dt className="font-medium leading-[18px]">Téléphone</dt>
          <dd className="leading-[17px] text-[#2A416F]">{phone}</dd>
        </div>
        <div className="mt-[10px]">
          <dt className="font-medium leading-[18px]">Date de naissance</dt>
          <dd className="leading-[17px] text-[#2A416F]">{birthDate}</dd>
        </div>
        <div className="mt-3">
          <dt className="font-medium leading-[18px]">Nationalité</dt>
          <dd className="leading-[17px] text-[#2A416F]">{nationality}</dd>
        </div>
      </dl>

      <dl className="absolute left-[457px] top-[59px] text-[12px] text-[#1F3566]">
        <div>
          <dt className="font-medium leading-[18px]">Adresse</dt>
          <dd className="leading-[17px] text-[#2A416F]">{address}</dd>
        </div>
        <div className="mt-[13px]">
          <dt className="font-medium leading-[18px]">Marché</dt>
          <dd className="leading-[17px] text-[#2A416F]">{marketLabel}</dd>
        </div>
        <div className="mt-4">
          <dt className="font-medium leading-[18px]">Rôle</dt>
          <dd className="leading-[17px] text-[#2A416F]">Gérant</dd>
        </div>
        <div className="mt-[17px]">
          <dt className="font-medium leading-[18px]">Membre depuis</dt>
          <dd className="leading-[17px] text-[#2A416F]">{memberSince}</dd>
        </div>
      </dl>
    </section>
  );
}
