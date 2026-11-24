import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe2 } from 'lucide-react';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
];

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Le détecteur peut renvoyer `en-US` / `es-ES` : on compare sur la langue
  // de base, sinon le menu affiche FR alors que l'anglais est actif.
  const baseLanguage = (i18n.language || 'fr').split('-')[0];
  const current = LANGUAGES.find((l) => l.code === baseLanguage) ?? LANGUAGES[0];

  const handleLanguageChange = (code: string) => {
    void i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    setOpen(false);
  };

  // Fermeture au clic extérieur et avec Échap.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (compact) {
    return (
      <div className="language-switcher language-switcher--compact" ref={ref}>
        <button
          type="button"
          className={`language-globe-btn${open ? ' is-open' : ''}`}
          aria-label={t('landing.language.choose')}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Globe2 size={18} strokeWidth={1.9} aria-hidden="true" />
          <span className="language-globe-btn__code">{current.code.toUpperCase()}</span>
          <ChevronDown size={13} strokeWidth={2.2} className="language-globe-btn__caret" aria-hidden="true" />
        </button>

        {open && (
          <div className="language-globe-menu" role="menu" aria-label={t('landing.language.choose')}>
            <span className="language-globe-menu__title">{t('landing.language.interfaceTitle')}</span>
            {LANGUAGES.map((lang) => {
              const active = baseLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  className={`language-globe-item${active ? ' language-globe-item--active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <span className="language-globe-item__badge" aria-hidden="true">
                    {lang.code.toUpperCase()}
                  </span>
                  <span className="language-globe-item__name">{lang.name}</span>
                  {active && <Check size={14} strokeWidth={2.6} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="language-switcher">
      <div className="language-select-wrap">
        <Globe2 size={16} strokeWidth={1.9} aria-hidden="true" />
        <select
          value={i18n.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="language-select"
          aria-label={t('landing.language.choose')}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
      </div>
    </div>
  );
};

export default LanguageSwitcher;
