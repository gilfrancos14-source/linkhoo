import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' }
  ];

  const current = languages.find((l) => l.code === i18n.language) ?? languages[0];

  void current;

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    setOpen(false);
  };

  // Fermer le menu au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (compact) {
    return (
      <div className="language-switcher language-switcher--compact" ref={ref}>
        <button
          type="button"
          className="language-globe-btn"
          aria-label="Choose language"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          🌐
        </button>
        {open && (
          <div className="language-globe-menu">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={`language-globe-item${i18n.language === lang.code ? ' language-globe-item--active' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                {lang.flag} {lang.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="language-switcher">
      <select
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="language-select"
        aria-label="Choose language"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;