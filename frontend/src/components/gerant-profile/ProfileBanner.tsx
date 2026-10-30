import { Mail, Phone, MapPin, Camera } from 'lucide-react';
import { marketByCode } from '../../config/markets';

/**
 * Bannière de profil : photo, nom, email, téléphone, ville.
 */
interface ProfileBannerProps {
  fullName: string;
  email: string;
  phone: string;
  market: string | null;
  verified: boolean;
}

export function ProfileBanner({ fullName, email, phone, market, verified }: ProfileBannerProps) {
  const marketLabel = market ? marketByCode(market as any).label : '';

  return (
    <section className="relative mt-[13px] h-[151px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <div className="absolute left-[21px] top-[19px] h-[111px] w-[114px]">
        <div className="h-full w-full overflow-hidden rounded-[20px]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-label="Photo de profil">
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
          </svg>
        </div>
        <span className="absolute bottom-[6px] right-[3px] grid h-[22px] w-[22px] place-items-center rounded-full bg-[#1D7CF2] ring-2 ring-white">
          <Camera size={12} className="stroke-white stroke-[2.2]" />
        </span>
      </div>

      <div className="absolute left-[162px] top-[21px]">
        <div className="flex h-7 items-center gap-[10px]">
          <h2 className="text-[20px] font-bold tracking-[-0.01em]">{fullName}</h2>
          <span className={`rounded-full bg-[#E6F6EF] px-[10px] py-[2px] text-[12px] font-semibold leading-4 ${verified ? 'text-[#2E9E78]' : 'text-[#5F7396]'}`}>
            {verified ? 'Gérant vérifié' : 'Gérant'}
          </span>
        </div>
        <ul className="mt-[3px]">
          <li className="flex h-[26px] items-center gap-2 text-[13.5px] text-[#1E3A74]">
            <Mail size={16} className="ml-px stroke-[1.75] text-[#40527C]" />{email}
          </li>
          <li className="flex h-[27px] items-center gap-2 text-[13.5px] text-[#5F7396]">
            <Phone size={16} className="ml-px stroke-[1.75] text-[#40527C]" />{phone}
          </li>
          <li className="flex h-[26px] items-center gap-2 text-[13.5px] text-[#5F7396]">
            <MapPin size={16} className="ml-px stroke-[1.75] text-[#40527C]" />{marketLabel}
          </li>
        </ul>
      </div>
    </section>
  );
}
