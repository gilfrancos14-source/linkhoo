import { Bell } from 'lucide-react';

/**
 * En-tête de la page Mes informations : barre de recherche, notifications,
 * et profil utilisateur avec menu déroulant.
 * Remplace les icônes SVG inline par lucide-react.
 */
export function ProfileHeader({ userName }: { userName: string }) {
  return (
    <header className="flex h-[64px] items-center justify-between pl-[19px] pr-[26px]">
      <label className="flex h-9 w-full max-w-[590px] items-center gap-[15px] rounded-lg bg-white pl-6 pr-4 shadow-[0_1px_6px_rgba(20,40,90,0.05)] ring-1 ring-[#EEF2F8]">
        <Search className="text-[#0F2150]" />
        <input
          type="search"
          placeholder="Rechercher une chambre, une catégorie..."
          className="w-full bg-transparent text-[11.5px] text-[#0F2150] placeholder:text-[#8A99B5] focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-[28px]">
        <button type="button" aria-label="Notifications" className="relative text-[#0F2150]">
          <Bell size={20} />
          <span className="absolute -right-[9px] -top-[8px] grid h-[15px] w-[15px] place-items-center rounded-full bg-[#F26B1D] text-[9px] font-bold text-white">2</span>
        </button>

        <div className="flex h-[46px] w-[190px] items-center rounded-xl bg-white pl-[7px] pr-[9px] text-left shadow-[0_1px_6px_rgba(20,40,90,0.06)] ring-1 ring-[#EEF2F8]">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Photo de profil">
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
          </span>
          <span className="ml-[11px] leading-none">
            <span className="block max-w-[95px] truncate text-[12px] font-bold">{userName}</span>
            <span className="mt-[7px] block text-[11px] text-[#8A99B5]">Gérant</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function Search({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
