import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n/config';
import AProposPage from './AProposPage';
import ContactPage from './ContactPage';

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('fr');
  });
});

afterEach(async () => {
  cleanup();
  await act(async () => {
    await i18n.changeLanguage('fr');
  });
});

async function setLanguage(language: string) {
  await act(async () => {
    await i18n.changeLanguage(language);
  });
}

describe('Internationalisation — page À propos', () => {
  it('traduit le hero, le bandeau et le CTA en anglais', async () => {
    render(<AProposPage />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Notre mission');

    await setLanguage('en');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Our mission');
    expect(screen.getByText(/Rent with confidence/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore our markets/ })).toBeInTheDocument();
    expect(screen.getByText('Our values')).toBeInTheDocument();
  });

  it('traduit le contenu en espagnol', async () => {
    render(<AProposPage />, { wrapper: MemoryRouter });

    await setLanguage('es');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nuestra misión');
    expect(screen.getByText(/¡Alquila con confianza/)).toBeInTheDocument();
    expect(screen.getByText('Nuestros valores')).toBeInTheDocument();
  });
});

describe('Internationalisation — page Contact', () => {
  it('traduit le hero, le formulaire et la FAQ en anglais', async () => {
    render(<ContactPage />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Une question ?');

    await setLanguage('en');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Have a question?');
    expect(screen.getByText('Send us a message')).toBeInTheDocument();
    expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'General question' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send message/ })).toBeInTheDocument();
  });

  it('traduit le contenu en espagnol', async () => {
    render(<ContactPage />, { wrapper: MemoryRouter });

    await setLanguage('es');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¿Una pregunta?');
    expect(screen.getByText('Envíanos un mensaje')).toBeInTheDocument();
    expect(screen.getByText('Preguntas frecuentes')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pregunta general' })).toBeInTheDocument();
  });
});
