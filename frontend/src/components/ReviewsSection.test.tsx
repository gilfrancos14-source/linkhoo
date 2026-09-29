import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import ReviewsSection from './ReviewsSection';
import type { FeaturedReviewData } from '../lib/api';

const mocks = vi.hoisted(() => ({
  featured: vi.fn<() => Promise<FeaturedReviewData[]>>(),
}));

vi.mock('../lib/api', () => ({ apiReviews: { featured: mocks.featured } }));

function review(overrides: Partial<FeaturedReviewData> = {}): FeaturedReviewData {
  return {
    id: 'r1',
    client_name: 'Awa Diabaté',
    note_appartement: 5,
    commentaire: 'Séjour parfait, vue magnifique sur la lagune.',
    created_at: '2026-01-10',
    room: { title: 'Suite Azur' },
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReviewsSection', () => {
  it('affiche les squelettes tant que les avis ne sont pas chargés', async () => {
    const pending = deferred<FeaturedReviewData[]>();
    mocks.featured.mockReturnValue(pending.promise);

    const { container } = render(<ReviewsSection />);

    expect(container.querySelector('.reviews__grid')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.card-skeleton')).toHaveLength(3);
    expect(screen.queryByText(/Séjour parfait/)).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve([]);
    });
  });

  it('affiche le commentaire, l’auteur et la notation de chaque avis', async () => {
    mocks.featured.mockResolvedValue([
      review(),
      review({
        id: 'r2',
        client_name: 'Kofi',
        note_appartement: 3,
        commentaire: 'Bon accueil mais un peu bruyant.',
        room: null,
      }),
    ]);

    const { container } = render(<ReviewsSection />);

    expect(
      await screen.findByText('« Séjour parfait, vue magnifique sur la lagune. »'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: "Ce qu'ils en disent" }),
    ).toBeInTheDocument();
    expect(screen.getByText('« Bon accueil mais un peu bruyant. »')).toBeInTheDocument();
    expect(screen.getByText('Awa Diabaté')).toBeInTheDocument();
    expect(container.querySelector('.reviews__grid')).toHaveAttribute('aria-busy', 'false');
  });

  it('nombre les étoiles selon la note et annonce la notation', async () => {
    mocks.featured.mockResolvedValue([
      review(),
      review({ id: 'r2', client_name: 'Kofi', note_appartement: 3, room: null }),
    ]);

    const { container } = render(<ReviewsSection />);
    await screen.findByText('Awa Diabaté');

    const stars = container.querySelectorAll('.review__stars');
    expect(stars).toHaveLength(2);
    expect(stars[0]).toHaveAttribute('aria-label', 'Note : 5 étoiles sur 5');
    expect(stars[0].querySelectorAll('svg')).toHaveLength(5);
    expect(stars[1]).toHaveAttribute('aria-label', 'Note : 3 étoiles sur 5');
    expect(stars[1].querySelectorAll('svg')).toHaveLength(3);
  });

  it('affiche les initiales de l’auteur et le séjour associé', async () => {
    mocks.featured.mockResolvedValue([
      review(),
      review({ id: 'r2', client_name: 'Kofi Mensah', commentaire: 'Court séjour.', room: null }),
    ]);

    const { container } = render(<ReviewsSection />);
    await screen.findByText('Awa Diabaté');

    const avatars = container.querySelectorAll('.review__avatar');
    expect(avatars[0]).toHaveTextContent('AD');
    expect(avatars[1]).toHaveTextContent('KM');
    expect(screen.getByText('Séjour — Suite Azur')).toBeInTheDocument();
  });

  it("n'affiche pas de mention de séjour quand l'avis n'est rattaché à aucun bien", async () => {
    mocks.featured.mockResolvedValue([
      review({ id: 'r2', client_name: 'Kofi', commentaire: 'Sans bien.', room: null }),
    ]);

    render(<ReviewsSection />);
    await screen.findByText('Kofi');

    expect(screen.queryByText(/Séjour —/)).not.toBeInTheDocument();
  });

  it("gère un avis sans note : aucune étoile mais l'annonce reste lisible", async () => {
    mocks.featured.mockResolvedValue([
      review({ id: 'r0', client_name: 'Zoé', note_appartement: 0, commentaire: 'Sans note.', room: null }),
    ]);

    const { container } = render(<ReviewsSection />);
    await screen.findByText('Zoé');

    const stars = container.querySelector('.review__stars');
    expect(stars).toHaveAttribute('aria-label', 'Note : 0 étoiles sur 5');
    expect(stars?.querySelectorAll('svg')).toHaveLength(0);
  });

  it('masque la section quand aucun avis renvoyé', async () => {
    mocks.featured.mockResolvedValue([]);

    const { container } = render(<ReviewsSection />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("masque la section quand l'API des avis échoue", async () => {
    mocks.featured.mockRejectedValue(new Error('Réseau indisponible'));

    const { container } = render(<ReviewsSection />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());

    expect(mocks.featured).toHaveBeenCalledTimes(1);
  });
});
