import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import PartnerBanners from './PartnerBanners';
import type { BannerData } from '../../lib/api';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('../../lib/api', () => ({
  apiBanners: { list: mocks.list },
}));

function adminBanner(overrides: Partial<BannerData> = {}): BannerData {
  return {
    id: 'b1',
    section: 'hero',
    img: '/ads/offre.gif',
    alt: 'Offre Black Friday',
    link: 'https://exemple.com/offre',
    market: 'CI',
    order: 0,
    ...overrides,
  };
}

describe('PartnerBanners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it('récupère les publicités hero du marché et retombe sur les offres d’exemple', async () => {
    render(<PartnerBanners market="CI" />);

    await waitFor(() => expect(mocks.list).toHaveBeenCalledWith('CI', 'hero'));
    expect(screen.getByText(/Linkhoo Voyages/)).toBeInTheDocument();
  });

  it('affiche le visuel et le lien de la bannière publiée par l’administrateur', async () => {
    mocks.list.mockResolvedValue([adminBanner()]);

    const { container } = render(<PartnerBanners market="BJ" />);

    const link = await screen.findByRole('link', { name: /Offre Black Friday/ });
    expect(link).toHaveAttribute('href', 'https://exemple.com/offre');
    const image = container.querySelector('img.partner-banners__img');
    expect(image).toHaveAttribute('src', '/ads/offre.gif');
    expect(image).toHaveAttribute('alt', 'Offre Black Friday');
    expect(screen.queryByText(/Linkhoo Voyages/)).toBeNull();
  });

  it('utilise le libellé par défaut quand la bannière n’a pas de texte alternatif', async () => {
    mocks.list.mockResolvedValue([adminBanner({ alt: '' })]);

    const { container } = render(<PartnerBanners />);

    const image = await waitFor(() => {
      const found = container.querySelector('img.partner-banners__img');
      expect(found).not.toBeNull();
      return found as HTMLImageElement;
    });
    expect(image).toHaveAttribute('alt', 'Offre partenaire');
  });
});
