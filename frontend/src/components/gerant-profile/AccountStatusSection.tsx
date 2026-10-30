import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export type AccountRowStatus = 'validated' | 'progress' | 'rejected' | 'missing' | 'unknown';

export interface AccountRow {
  label: string;
  status: AccountRowStatus;
}

const ACCOUNT_STATUS_LABEL: Record<AccountRow['status'], string> = {
  validated: 'Validé',
  progress: 'En attente',
  rejected: 'Rejeté',
  missing: 'À fournir',
  unknown: '—',
};

const ACCOUNT_STATUS_BADGE: Record<AccountRow['status'], string> = {
  validated: 'bg-[#E6F6EF] text-[#3AA57D]',
  progress: 'bg-[#FFF1E8] text-[#F26B1D]',
  rejected: 'bg-[#FDE8E8] text-[#D64545]',
  missing: 'bg-[#EDF1F8] text-[#8393B0]',
  unknown: 'bg-[#EDF1F8] text-[#8393B0]',
};

interface AccountStatusSectionProps {
  rows: AccountRow[];
  suiviPath: string;
}

/**
 * Section "État de votre compte" avec liste des statuts de vérification.
 */
export function AccountStatusSection({ rows, suiviPath }: AccountStatusSectionProps) {
  return (
    <section className="mt-[18px] h-[263px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <h3 className="mt-[18px] flex h-5 items-center gap-[15px] pl-[27px] text-[14px] font-bold tracking-[-0.01em]">
        <svg className="ic h-5 w-5 stroke-[1.75] text-[#1B3A82]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>État de votre compte
      </h3>
      <ul className="mx-[26px] mt-[15px]">
        {rows.map((row) => {
          const isValid = row.status === 'validated';
          return (
            <li key={row.label} className="flex h-[37.5px] items-center gap-4 border-b border-[#EEF2F8] last:border-b-0">
              {isValid ? (
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#27B585" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <span
                  aria-hidden="true"
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold leading-none ${ACCOUNT_STATUS_BADGE[row.status]}`}
                >
                  {row.status === 'rejected' ? '×' : row.status === 'progress' ? '…' : '–'}
                </span>
              )}
              <span className="flex-1 text-[11.5px] text-[#3D4F73]">{row.label}</span>
              <span
                className={`rounded-md px-2 py-[2px] text-[10px] font-medium leading-[13px] ${ACCOUNT_STATUS_BADGE[row.status]}`}
              >
                {ACCOUNT_STATUS_LABEL[row.status]}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        to={suiviPath}
        className="mx-[26px] mt-[15px] flex h-[34px] items-center justify-center gap-2 rounded-lg border border-[#E3E9F4] bg-[#FAFBFE] text-[10px] font-semibold transition hover:bg-[#F3F6FC]"
      >
        Voir le suivi de vérification
        <ArrowRight size={10} className="stroke-[2.4]" />
      </Link>
    </section>
  );
}
