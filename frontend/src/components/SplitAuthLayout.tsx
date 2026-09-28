import type { ReactNode } from 'react';

export interface AuthBenefit {
  icon: 'search' | 'calendar' | 'star' | 'user' | 'home' | 'trending';
  title: string;
  text: string;
}

function BenefitIcon({ icon }: { icon: AuthBenefit['icon'] }) {
  switch (icon) {
    case 'search':
      return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
    case 'calendar':
      return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>;
    case 'star':
      return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.8 6.6 19.8l1-6.1L3.2 9.4l6.1-.9L12 3z" /></svg>;
    case 'user':
      return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'home':
      return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10z" /></svg>;
    case 'trending':
      return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" /></svg>;
  }
}

export const clerkFormAppearance = {
  variables: {
    colorBackground: 'transparent',
    colorPrimary: '#1e293b',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
  },
  elements: {
    card: 'none',
    rootBox: 'width: 100%; background: transparent;',
    cardBox: 'box-shadow: none; border: none; background: transparent; padding: 0; margin: 0;',
  },
} as const;

interface SplitAuthLayoutProps {
  title: string;
  subtitle: string;
  benefits?: AuthBenefit[];
  formLabel: string;
  children: ReactNode;
}

export default function SplitAuthLayout({
  title,
  subtitle,
  benefits,
  formLabel,
  children,
}: SplitAuthLayoutProps) {
  return (
    <main className="register-page">
      <div className="register-page__inner">
        <aside className="register-page__info">
          <h1 className="register-page__title">{title}</h1>
          <p className="register-page__subtitle">{subtitle}</p>

          {benefits && benefits.length > 0 && (
            <ul className="register-page__benefits">
              {benefits.map((b) => (
                <li key={b.title} className="register-page__benefit">
                  <span className="register-page__benefit-icon" aria-hidden="true">
                    <BenefitIcon icon={b.icon} />
                  </span>
                  <div>
                    <strong>{b.title}</strong>
                    <p>{b.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="register-page__form-side" aria-label={formLabel}>
          <div className="register-page__form">{children}</div>
        </section>
      </div>
    </main>
  );
}
