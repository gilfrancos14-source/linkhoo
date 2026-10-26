import type { MouseEvent } from 'react';
import { useGerantSignOut } from '../contexts/GerantSessionContext';

interface GerantLogoutButtonProps {
  className?: string;
}

export default function GerantLogoutButton({ className = '' }: GerantLogoutButtonProps) {
  const signOut = useGerantSignOut();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (signOut) void signOut();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Se déconnecter"
      title="Se déconnecter"
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#C23B3B] transition hover:bg-[#FDE8E8] hover:text-[#B02F2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D64545]/30 ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>
  );
}
