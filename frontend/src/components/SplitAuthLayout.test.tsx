import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SplitAuthLayout, {
  clerkFormAppearance,
  type AuthBenefit,
} from './SplitAuthLayout';

const benefits: AuthBenefit[] = [
  { icon: 'search', title: 'Trouvez votre séjour', text: 'Des chambres partout au pays.' },
  { icon: 'calendar', title: 'Réservez en 2 clics', text: 'Confirmation immédiate.' },
  { icon: 'star', title: 'Hôtes vérifiés', text: 'Sécurité et qualité garanties.' },
];

function renderLayout(
  overrides: Partial<{
    title: string;
    subtitle: string;
    benefits?: AuthBenefit[];
    formLabel: string;
  }> = {},
) {
  return render(
    <SplitAuthLayout
      title={overrides.title ?? 'Créez votre compte'}
      subtitle={overrides.subtitle ?? 'Rejoignez la communauté Ileyha.'}
      benefits={'benefits' in overrides ? overrides.benefits : benefits}
      formLabel={overrides.formLabel ?? 'Inscription'}
    >
      <button type="button">Continuer</button>
    </SplitAuthLayout>,
  );
}

afterEach(() => {
  cleanup();
});

describe('SplitAuthLayout', () => {
  it('affiche le titre et le sous-titre dans le panneau info', () => {
    renderLayout();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Créez votre compte' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Rejoignez la communauté Ileyha.'),
    ).toBeInTheDocument();
  });

  it('étiquette le côté formulaire avec la prop formLabel', () => {
    renderLayout({ formLabel: 'Création de compte' });

    const formSide = screen.getByRole('region', { name: 'Création de compte' });
    expect(formSide).toBeInTheDocument();
    expect(within(formSide).getByRole('button', { name: 'Continuer' })).toBeInTheDocument();
  });

  it('rend les children dans la zone de formulaire', () => {
    const { container } = renderLayout();

    const formZone = container.querySelector('.register-page__form');
    expect(formZone).not.toBeNull();
    expect(formZone!.textContent).toContain('Continuer');
  });

  it('liste chaque bénéfice avec son titre et son texte', () => {
    renderLayout();

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Trouvez votre séjour')).toBeInTheDocument();
    expect(screen.getByText('Des chambres partout au pays.')).toBeInTheDocument();
    expect(screen.getByText('Réservez en 2 clics')).toBeInTheDocument();
    expect(screen.getByText('Hôtes vérifiés')).toBeInTheDocument();
  });

  it('masque les icônes de bénéfices aux technologies d’assistance', () => {
    const { container } = renderLayout();

    const icons = container.querySelectorAll('.register-page__benefit-icon');
    expect(icons).toHaveLength(3);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon.querySelector('svg')).not.toBeNull();
    });
  });

  it('n’affiche aucune liste de bénéfices sans la prop', () => {
    renderLayout({ benefits: undefined });

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('n’affiche aucune liste de bénéfices pour un tableau vide', () => {
    renderLayout({ benefits: [] });

    expect(screen.queryByRole('list')).toBeNull();
  });

  it("honorise une icône de bénéfice de type 'user'", () => {
    renderLayout({
      benefits: [{ icon: 'user', title: 'Profil', text: 'Votre espace personnel.' }],
    });

    expect(screen.getByText('Profil')).toBeInTheDocument();
    const icons = document.querySelectorAll('.register-page__benefit-icon');
    expect(icons).toHaveLength(1);
    expect(icons[0].querySelector('svg')).not.toBeNull();
  });

  it('exporte l’apparence Clerk utilisée par les pages de connexion', () => {
    expect(clerkFormAppearance.variables.colorPrimary).toBe('#1e293b');
    expect(clerkFormAppearance.variables.colorBackground).toBe('transparent');
    expect(clerkFormAppearance.elements.card).toBe('none');
  });

  it('reste utilisable avec un formulaire interactif en enfant', async () => {
    render(
      <SplitAuthLayout
        title="Connexion"
        subtitle="Content de vous revoir."
        formLabel="Connexion"
      >
        <label htmlFor="email-test">Adresse e-mail</label>
        <input id="email-test" type="email" />
      </SplitAuthLayout>,
    );

    const input = screen.getByLabelText('Adresse e-mail');
    await userEvent.type(input, 'awa@ilehya.ci');

    expect(input).toHaveValue('awa@ilehya.ci');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Connexion' }),
    ).toBeInTheDocument();
  });
});
