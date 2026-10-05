import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../contexts/MarketContext';
import ContactPage from './ContactPage';

const mocks = vi.hoisted(() => ({
  send: vi.fn<() => Promise<{ message?: string }>>(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return { ...original, apiContact: { send: mocks.send } };
});

function renderContact(entry = '/contact') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

function nom(): HTMLInputElement {
  return screen.getByLabelText('Nom *') as HTMLInputElement;
}

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
}

async function fillValid() {
  await userEvent.type(nom(), 'Kouassi');
  await userEvent.type(screen.getByLabelText('Prénom'), 'Awa');
  await userEvent.type(screen.getByLabelText('Email *'), 'awa@example.com');
  await userEvent.type(screen.getByLabelText('Téléphone'), '+225 07 00 00 00 00');
  await userEvent.selectOptions(screen.getByLabelText('Sujet *'), 'reservation');
  await userEvent.selectOptions(screen.getByLabelText('Pays *'), "Côte d'Ivoire");
  await userEvent.type(
    screen.getByLabelText('Votre message *'),
    'Bonjour, je souhaite réserver une chambre à Abidjan.',
  );
}

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  cleanup();
  setOnline(true);
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ message: 'Message envoyé avec succès.' });
});

describe('ContactPage', () => {
  it('affiche le titre, le retour accueil et les deux colonnes', () => {
    renderContact();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Contactez-nous' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "← Retour à l'accueil" })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Envoyez un message' }),
    ).toBeInTheDocument();
  });

  it("propose les 12 pays et les 5 sujets de la page de référence", () => {
    renderContact();

    const paysSelect = screen.getByLabelText('Pays *') as HTMLSelectElement;
    expect(
      Array.from(paysSelect.options)
        .map((option) => option.textContent)
        .filter((label) => label && label !== 'Pays'),
    ).toEqual([
      'Bénin',
      'Burkina Faso',
      'Cameroun',
      'Congo',
      "Côte d'Ivoire",
      'Gabon',
      'Guinée',
      'Mali',
      'Niger',
      'RDC',
      'Sénégal',
      'Togo',
    ]);

    const sujetSelect = screen.getByLabelText('Sujet *') as HTMLSelectElement;
    expect(
      Array.from(sujetSelect.options)
        .map((option) => option.textContent)
        .filter((label) => label && label !== 'Choisir un sujet'),
    ).toEqual(['Réservation', 'Compte gérant', 'Partenariat', 'Presse', 'Autre demande']);
  });

  it('masque le champ pot de miel aux robots comme au clavier', () => {
    renderContact();

    const honeypot = document.querySelector<HTMLInputElement>('#contact-website');
    expect(honeypot).not.toBeNull();
    expect(honeypot!.tabIndex).toBe(-1);
    expect(honeypot!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("refuse un formulaire vide sans rien envoyer", async () => {
    renderContact();

    await submit();

    expect(screen.getByText('Veuillez indiquer votre nom.')).toBeInTheDocument();
    expect(screen.getByText('Adresse email invalide.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez choisir un pays.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez choisir un sujet.')).toBeInTheDocument();
    expect(
      screen.getByText('Le message doit contenir au moins 10 caractères.'),
    ).toBeInTheDocument();
    expect(nom()).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("accepte les erreurs champ par champ puis les efface à la saisie", async () => {
    renderContact();

    await userEvent.type(screen.getByLabelText('Email *'), 'pas-une-adresse');
    await submit();

    expect(screen.getByText('Adresse email invalide.')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Votre message *'),
    ).toHaveAttribute('aria-describedby', 'contact-message-error');

    await userEvent.type(nom(), 'Kouassi');

    expect(screen.queryByText('Veuillez indiquer votre nom.')).not.toBeInTheDocument();
  });

  it('envoie le message avec le marché par défaut et confirme la réception', async () => {
    renderContact();

    await fillValid();
    await submit();

    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith({
        nom: 'Kouassi',
        prenom: 'Awa',
        email: 'awa@example.com',
        telephone: '+225 07 00 00 00 00',
        pays: "Côte d'Ivoire",
        sujet: 'reservation',
        message: 'Bonjour, je souhaite réserver une chambre à Abidjan.',
        market: 'CI',
        website: '',
      }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Message envoyé avec succès.',
    );
    expect(
      screen.getByRole('button', { name: 'Envoyer un autre message' }),
    ).toBeInTheDocument();
  });

  it("remonte l'erreur du serveur et garde les valeurs saisies", async () => {
    mocks.send.mockRejectedValue(new Error("L'envoi a échoué. Veuillez réessayer."));
    renderContact();

    await fillValid();
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "L'envoi a échoué. Veuillez réessayer.",
    );
    expect((screen.getByLabelText('Email *') as HTMLInputElement).value).toBe(
      'awa@example.com',
    );
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
  });

  it("n'essaie pas d'envoyer hors-ligne", async () => {
    setOnline(false);
    renderContact();

    await fillValid();
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connexion internet requise pour envoyer votre message.',
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Email *') as HTMLInputElement).value).toBe(
      'awa@example.com',
    );
  });

  it('repart d’un formulaire vide après confirmation', async () => {
    renderContact();

    await fillValid();
    await submit();
    await screen.findByRole('status');

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer un autre message' }));

    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
    expect(nom().value).toBe('');
  });
});
