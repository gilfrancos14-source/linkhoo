import { Bell, Box } from 'lucide-react';

export type PreferenceKey = 'reservations' | 'messages' | 'marketing';

interface PreferenceItem {
  key: PreferenceKey;
  label: string;
}

interface PreferencesSectionProps {
  preferences: Record<PreferenceKey, boolean>;
  onToggle: (key: PreferenceKey) => void;
}

const PREFERENCE_ITEMS: PreferenceItem[] = [
  { key: 'reservations', label: 'Recevoir les demandes de réservation' },
  { key: 'messages', label: 'Recevoir les messages de clients' },
  { key: 'marketing', label: 'Recevoir les notifications marketing' },
];

/**
 * Section "Préférences & notifications" avec interrupteurs à bascule.
 */
export function PreferencesSection({ preferences, onToggle }: PreferencesSectionProps) {
  return (
    <section className="relative mt-[14px] h-[160px] rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <h2 className="absolute left-6 top-5 flex h-5 items-center gap-[15px] text-[13.5px] font-bold tracking-[-0.01em]">
        <Bell size={20} className="stroke-[1.75] text-[#2F5FC4]" />Préférences &amp; notifications
      </h2>

      <ul className="absolute left-[22px] right-5 top-[47px] text-[11.5px] text-[#1F3566]">
        {PREFERENCE_ITEMS.map((item) => {
          const isActive = preferences[item.key] ?? false;
          return (
            <li key={item.key} className="flex h-[29px] items-center">
              <Box size={14} className="shrink-0 stroke-[1.75] text-[#6F82A6]" />
              <span className="ml-[18px] flex-1">{item.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-label={item.label}
                onClick={() => onToggle(item.key)}
                className={`relative h-[18px] w-[31px] rounded-full transition ${isActive ? 'bg-[#27B585]' : 'bg-[#CBD3E1]'}`}
              >
                <span
                  className={`absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition ${isActive ? 'translate-x-[13px]' : ''}`}
                />
              </button>
              <span className="ml-2 w-[61px] text-[11px] text-[#5F7396]">{isActive ? 'Active' : 'Désactivée'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
