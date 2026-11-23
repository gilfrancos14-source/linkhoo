import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const i18nMock = vi.hoisted(() => ({
  language: 'fr' as string,
  changeLanguage: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: i18nMock,
    t: (key: string) =>
      ({
        'landing.language.choose': 'Choisir la langue',
        'landing.language.interfaceTitle': "Langue de l'interface",
      })[key] ?? key,
  }),
}));

import LanguageSwitcher from './LanguageSwitcher';

beforeEach(() => {
  i18nMock.language = 'fr';
  i18nMock.changeLanguage.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('LanguageSwitcher — version compacte', () => {
  it('affiche une icône SVG et le code de la langue courante', () => {
    render(<LanguageSwitcher compact />);

    const button = screen.getByRole('button', { name: 'Choisir la langue' });
    expect(button).toHaveTextContent('FR');
    expect(button.querySelector('svg')).toBeTruthy();
    expect(button.textContent).not.toContain('🌐');
  });

  it('ouvre un menu avec les trois langues et marque la langue active', () => {
    render(<LanguageSwitcher compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Choisir la langue' }));

    const menu = screen.getByRole('menu', { name: 'Choisir la langue' });
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    expect(screen.getByRole('menuitemradio', { name: /Français/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('change la langue, la persiste et ferme le menu', () => {
    render(<LanguageSwitcher compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Choisir la langue' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /English/ }));

    expect(i18nMock.changeLanguage).toHaveBeenCalledWith('en');
    expect(window.localStorage.getItem('language')).toBe('en');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('se ferme avec Échap', () => {
    render(<LanguageSwitcher compact />);
    const button = screen.getByRole('button', { name: 'Choisir la langue' });
    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('LanguageSwitcher — version sélecteur', () => {
  it('affiche un select des langues', () => {
    render(<LanguageSwitcher />);

    const select = screen.getByRole('combobox', { name: 'Choisir la langue' });
    expect(select).toHaveValue('fr');
    expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
  });
});
