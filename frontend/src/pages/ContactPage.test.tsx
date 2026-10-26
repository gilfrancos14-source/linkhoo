import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContactPage from './ContactPage';

function renderContact() {
  return render(
    <MemoryRouter initialEntries={['/contact']}>
      <Routes>
        <Route path="/" element={<div>Accueil</div>} />
        <Route path="/a-propos" element={<div>À propos</div>} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function nom(): HTMLInputElement {
  return screen.getByLabelText(/Nom complet/) as HTMLInputElement;
}

async function fillValidForm() {
  await userEvent.type(nom(), 'Awa Kouassi');
  await userEvent.type(screen.getByLabelText(/^Email/), 'awa@example.com');
  await userEvent.selectOptions(screen.getByLabelText(/Objet/), 'Question générale');
  await userEvent.type(
    screen.getByLabelText(/Votre message/),
    'Bonjour, je souhaite avoir plus d’informations.',
  );
}

afterEach(() => {
  cleanup();
});

describe('ContactPage', () => {
  it('affiche le hero et les promesses de réponse', () => {
    renderContact();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Une question \?[\s\S]*Nous sommes là pour vous !/,
    );
    expect(screen.getAllByText('Nous contacter').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3, name: 'Réponse rapide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Équipe disponible' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Aide personnalisée' }),
    ).toBeInTheDocument();
  });

  it('marque Contact comme page active dans la navigation', () => {
    renderContact();

    const active = screen
      .getAllByRole('link', { name: 'Contact' })
      .find((link) => link.getAttribute('aria-current') === 'page');
    expect(active).toBeDefined();
    expect(active).toHaveAttribute('href', '/contact');
    for (const link of screen.getAllByRole('link', { name: 'À propos' })) {
      expect(link).toHaveAttribute('href', '/a-propos');
    }
  });

  it('affiche le formulaire, les coordonnées et la FAQ', () => {
    renderContact();

    expect(screen.getByRole('heading', { level: 2, name: 'Envoyez-nous un message' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Nos coordonnées' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Notre localisation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Questions fréquentes' })).toBeInTheDocument();
    expect(screen.getByText('contact@linkhoo.com')).toBeInTheDocument();
    expect(screen.getAllByText('Cotonou, Bénin').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /Voir sur Google Maps/ }),
    ).toHaveAttribute('href', 'https://www.google.com/maps/place/Cotonou');
  });

  it('signale les champs obligatoires vides', async () => {
    renderContact();

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    expect(
      screen.getByRole('button', { name: 'Veuillez remplir les champs obligatoires' }),
    ).toBeInTheDocument();
    expect(nom()).toHaveClass('ct-input--error');
    expect(screen.getByLabelText(/^Email/)).toHaveClass('ct-input--error');
    expect(screen.getByLabelText(/Votre message/)).toHaveClass('ct-input--error');
  });

  it('refuse une adresse email invalide', async () => {
    renderContact();

    await userEvent.type(nom(), 'Awa Kouassi');
    await userEvent.type(screen.getByLabelText(/^Email/), 'awa@');
    await userEvent.selectOptions(screen.getByLabelText(/Objet/), 'Paiement');
    await userEvent.type(screen.getByLabelText(/Votre message/), 'Une question sur mon paiement.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    expect(screen.getByLabelText(/^Email/)).toHaveClass('ct-input--error');
    expect(screen.getByLabelText(/Votre message/)).not.toHaveClass('ct-input--error');
  });

  it('confirme l’envoi et vide le formulaire', async () => {
    renderContact();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    expect(await screen.findByRole('button', { name: 'Message envoyé ✓' })).toBeInTheDocument();
    expect(nom()).toHaveValue('');
    expect(screen.getByLabelText(/Votre message/)).toHaveValue('');
  }, 15000);

  it('change de pays depuis le sélecteur', async () => {
    renderContact();

    await userEvent.click(screen.getByRole('button', { name: "Pays : Côte d'Ivoire" }));
    expect(screen.getByRole('listbox', { name: 'Choisir le pays' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Sénégal' }));

    expect(screen.getByRole('button', { name: 'Pays : Sénégal' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Choisir le pays' })).toBeNull();
  });

  it('ouvre le menu mobile et ferme le bandeau d’annonce', async () => {
    renderContact();

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('ct-mobile-menu')).toHaveClass('ct-mobile-menu--open');

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByText(/Louez en toute confiance/)).toBeNull();
  });

  it('liste les questions fréquentes et renvoie vers le formulaire', () => {
    renderContact();

    expect(screen.getByText('Comment réserver un logement sur Linkhoo ?')).toBeInTheDocument();
    expect(screen.getByText('Comment se règle le loyer ?')).toBeInTheDocument();
    expect(screen.getByText('Pourquoi mon compte gérant doit-il être vérifié ?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nous contacter/ })).toHaveAttribute(
      'href',
      '#contactForm',
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
