import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MarketProvider } from '../../contexts/MarketContext';
import ReservationsPage from './ReservationsPage';
import type { Reservation } from '../../lib/reservations';
import type { GerantData } from '../../lib/api';

const mocks = vi.hoisted(() => ({
  getReservations: vi.fn<() => Promise<Reservation[]>>(),
  updateReservationStatut: vi.fn<
    (id: string, statut: 'confirmee' | 'annulee') => Promise<void>
  >(),
  checkDateConflict: vi.fn<
    (
      roomId: string,
      dateDebut: string,
      dateFin: string,
      excludeId?: string,
    ) => Promise<{ hasConflict: boolean }>
  >(),
  addClientNotification: vi.fn<(payload: unknown) => Promise<void>>(),
  getMe: vi.fn<() => Promise<GerantData>>(),
}));

// On garde les helpers purs (statutLabels) et on neutralise les accès réseau.
vi.mock('../../lib/reservations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/reservations')>();
  return {
    ...actual,
    getReservations: mocks.getReservations,
    updateReservationStatut: mocks.updateReservationStatut,
    checkDateConflict: mocks.checkDateConflict,
  };
});

vi.mock('../../lib/notifications', () => ({
  addClientNotification: mocks.addClientNotification,
}));

vi.mock('../../lib/api', () => ({
  apiGerants: { getMe: mocks.getMe },
}));

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    clientName: 'Awa Traoré',
    clientEmail: 'client@ilehya.ci',
    clientPhone: '+225 01 01 01 01',
    roomId: 'room-1',
    roomTitle: 'Suite vue mer',
    dateDebut: '2026-10-05',
    dateFin: '2026-10-08',
    dureeNombre: 3,
    dureeUnite: 'nuit',
    montant: 75000,
    message: 'Arrivée tardive',
    statut: 'en_attente',
    createdAt: '2026-09-20T10:00:00.000Z',
    gerantIsVerified: false,
    gerantIsPremium: false,
    ...overrides,
  };
}

function makeGerant(overrides: Partial<GerantData> = {}): GerantData {
  return {
    id: 'gerant-1',
    clerk_user_id: 'clerk_1',
    email: 'awa@ilehya.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    phone: '+225 07 00 00 00',
    market: 'CI',
    is_verified: true,
    verified_at: '2026-01-05T12:00:00.000Z',
    verification_requested_at: null,
    verification_status: 'approved',
    verification_rejection_reason: null,
    verification_submitted_at: null,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    is_premium: true,
    premium_expires_at: '2027-06-01T00:00:00.000Z',
    created_at: '2025-11-01T09:00:00.000Z',
    ...overrides,
  };
}

function renderReservations(entry = '/ci/gerant/reservations') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <MarketProvider>
        <Routes>
          <Route
            path="/ci/gerant/reservations"
            element={<ReservationsPage />}
          />
          <Route path="/bj/gerant/reservations" element={<ReservationsPage />} />
          <Route path="/ci/gerant" element={<p>Tableau de bord gérant</p>} />
          <Route path="/bj/gerant" element={<p>Tableau de bord gérant BJ</p>} />
        </Routes>
      </MarketProvider>
    </MemoryRouter>,
  );
}

function overlay(): HTMLElement | null {
  return document.querySelector('.verify-overlay');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMe.mockResolvedValue(makeGerant());
  mocks.getReservations.mockResolvedValue([makeReservation()]);
  mocks.updateReservationStatut.mockResolvedValue(undefined);
  mocks.checkDateConflict.mockResolvedValue({ hasConflict: false });
  mocks.addClientNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('ReservationsPage', () => {
  it("affiche l'état de chargement avant la réponse de l'API", () => {
    mocks.getMe.mockImplementation(() => new Promise<GerantData>(() => {}));

    renderReservations();

    expect(
      screen.getByRole('heading', { name: 'Gestion des réservations' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('redirige vers le tableau de bord d’un gérant non vérifié', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ is_verified: false }));

    renderReservations();

    expect(
      await screen.findByText('Tableau de bord gérant'),
    ).toBeInTheDocument();
    expect(mocks.getReservations).not.toHaveBeenCalled();
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
  });

  it('redirige quand le premium est expiré', async () => {
    mocks.getMe.mockResolvedValue(
      makeGerant({ premium_expires_at: '2025-06-01T00:00:00.000Z' }),
    );

    renderReservations();

    expect(
      await screen.findByText('Tableau de bord gérant'),
    ).toBeInTheDocument();
    expect(mocks.getReservations).not.toHaveBeenCalled();
  });

  it('redirige quand le profil premium est absent', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ is_premium: false }));

    renderReservations();

    expect(
      await screen.findByText('Tableau de bord gérant'),
    ).toBeInTheDocument();
    expect(mocks.getReservations).not.toHaveBeenCalled();
  });

  it('respecte le marché BJ pour la redirection', async () => {
    mocks.getMe.mockResolvedValue(makeGerant({ is_verified: false }));

    renderReservations('/bj/gerant/reservations');

    expect(
      await screen.findByText('Tableau de bord gérant BJ'),
    ).toBeInTheDocument();
  });

  it('bascule en accès refusé sur une erreur 403 de la liste', async () => {
    mocks.getReservations.mockRejectedValue(new Error('403 Forbidden'));

    renderReservations();

    expect(
      await screen.findByText('Tableau de bord gérant'),
    ).toBeInTheDocument();
  });

  it('bascule en accès refusé sur un refus « gérées par l’administrateur »', async () => {
    mocks.getReservations.mockRejectedValue(
      new Error("Réservations gérées par l'administrateur"),
    );

    renderReservations();

    expect(
      await screen.findByText('Tableau de bord gérant'),
    ).toBeInTheDocument();
  });

  it('garde la page vide mais affichée quand la liste échoue pour une autre raison', async () => {
    mocks.getReservations.mockRejectedValue(new Error('réseau coupé'));

    renderReservations();

    // Comportement actuel : l'erreur est avalée, aucune mention d'échec.
    expect(
      await screen.findByText('Aucune réservation trouvée'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord gérant')).not.toBeInTheDocument();
    expect(
      screen.queryByText('réseau coupé'),
    ).not.toBeInTheDocument();
  });

  it('affiche les réservations avec dates, montant et statut', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation(),
      makeReservation({
        id: 'res-2',
        roomTitle: 'Chambre économique',
        statut: 'confirmee',
        montant: 40000,
        dateDebut: '2026-11-01',
        dateFin: '2026-11-03',
      }),
      makeReservation({
        id: 'res-3',
        roomTitle: 'Suite familiale',
        statut: 'annulee',
        montant: 12000,
        dateDebut: '',
        dateFin: '',
      }),
    ]);

    renderReservations();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Suite vue mer')).toBeInTheDocument();
    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    // « En attente / Confirmée / Annulée » existent aussi en options du
    // filtre : on les cherche dans chaque ligne du corps du tableau.
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText('En attente')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Confirmée')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Annulée')).toBeInTheDocument();
    // Les deux bornes de dates vivent dans deux <span> distincts.
    const datesCell = rows[1].querySelector('.admin-table__dates');
    expect(datesCell).toHaveTextContent(
      new Date('2026-10-05').toLocaleDateString('fr-FR'),
    );
    expect(datesCell).toHaveTextContent(
      `→ ${new Date('2026-10-08').toLocaleDateString('fr-FR')}`,
    );
    expect(screen.getByText('Dates à confirmer')).toBeInTheDocument();
    expect(
      screen.getByText(`${(75000).toLocaleString()} FCFA`),
    ).toBeInTheDocument();
  });

  it('additionne les montants des réservations confirmées', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation({ id: 'a', statut: 'confirmee', montant: 75000 }),
      makeReservation({ id: 'b', statut: 'confirmee', montant: 40000 }),
      makeReservation({ id: 'c', statut: 'en_attente', montant: 99999 }),
      makeReservation({ id: 'd', statut: 'annulee', montant: 12345 }),
    ]);

    renderReservations();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(
      screen.getByText(`Montant cumulé (confirmées) :`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${(75000 + 40000).toLocaleString()} FCFA`),
    ).toBeInTheDocument();
  });

  it('filtre les réservations par titre de chambre', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation(),
      makeReservation({ id: 'res-2', roomTitle: 'Chambre économique' }),
    ]);
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.type(
      screen.getByPlaceholderText('Rechercher par chambre...'),
      'économique',
    );

    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it('filtre les réservations par statut', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation(),
      makeReservation({
        id: 'res-2',
        roomTitle: 'Chambre économique',
        statut: 'confirmee',
      }),
    ]);
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.selectOptions(screen.getByRole('combobox'), 'confirmee');

    expect(screen.getByText('Chambre économique')).toBeInTheDocument();
    expect(screen.queryByText('Suite vue mer')).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand aucune réservation ne correspond", async () => {
    mocks.getReservations.mockResolvedValue([]);
    renderReservations();

    expect(
      await screen.findByText('Aucune réservation trouvée'),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(document.querySelector('.admin-pagination')).toBeNull();
  });

  it('ne propose la vérification que pour les réservations en attente', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation(),
      makeReservation({ id: 'res-2', statut: 'confirmee' }),
      makeReservation({ id: 'res-3', statut: 'annulee' }),
    ]);

    renderReservations();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Vérifier' })).toHaveLength(1);
  });

  it('annonce la disponibilité puis permet de confirmer', async () => {
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(mocks.checkDateConflict).toHaveBeenCalledWith(
      'room-1',
      '2026-10-05',
      '2026-10-08',
      'res-1',
    );
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(
      // Le titre de la chambre est découpé par un <strong> : on cible la fin.
      screen.getByText(/est disponible pour les dates demandées/),
    ).toBeInTheDocument();
    expect(overlay()).not.toBeNull();

    await user.click(
      screen.getByRole('button', { name: /Confirmer/ }),
    );

    expect(mocks.updateReservationStatut).toHaveBeenCalledWith(
      'res-1',
      'confirmee',
    );
    expect(overlay()).toBeNull();
    expect(mocks.getReservations).toHaveBeenCalledTimes(2);
  });

  it('notififie le client avec la mention de l’administrateur', async () => {
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByText('Disponible');
    await user.click(screen.getByRole('button', { name: /Confirmer/ }));

    expect(mocks.addClientNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reservation_confirmed',
        roomTitle: 'Suite vue mer',
        roomId: 'room-1',
        clientEmail: 'client@ilehya.ci',
        message:
          'Votre réservation pour "Suite vue mer" a été confirmée par l\'administrateur.',
      }),
    );
  });

  it('attribue la confirmation au gérant quand il est vérifié et premium', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation({
        gerantIsVerified: true,
        gerantIsPremium: true,
        gerantPrenom: 'Awa',
        gerantNom: 'Kouassi',
      }),
    ]);
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByText('Disponible');
    await user.click(screen.getByRole('button', { name: /Confirmer/ }));

    expect(mocks.addClientNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Votre réservation pour "Suite vue mer" a été confirmée par Awa Kouassi.',
      }),
    );
  });

  it('annonce l’indisponibilité et permet de refuser', async () => {
    mocks.checkDateConflict.mockResolvedValue({ hasConflict: true });
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(await screen.findByText('Non disponible')).toBeInTheDocument();
    expect(
      screen.getByText(/n'est pas disponible pour les dates demandées/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refuser/ }));

    expect(mocks.updateReservationStatut).toHaveBeenCalledWith(
      'res-1',
      'annulee',
    );
    expect(mocks.addClientNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reservation_rejected',
        message:
          'Désolé, "Suite vue mer" n\'est pas disponible pour les dates souhaitées.',
      }),
    );
    expect(overlay()).toBeNull();
  });

  it('classe une réservation sans dates comme indisponible sans appel API', async () => {
    mocks.getReservations.mockResolvedValue([
      makeReservation({ dateDebut: '', dateFin: '' }),
    ]);
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(await screen.findByText('Non disponible')).toBeInTheDocument();
    expect(mocks.checkDateConflict).not.toHaveBeenCalled();
  });

  it('affiche l’indisponibilité pendant le contrôle des dates', async () => {
    mocks.checkDateConflict.mockImplementation(
      () => new Promise<{ hasConflict: boolean }>(() => {}),
    );
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));

    expect(
      await screen.findByText('Vérification de la disponibilité...'),
    ).toBeInTheDocument();
    // La chambre apparaît aussi dans le tableau : on cible la modale.
    expect(document.querySelector('.verify-modal__room')).toHaveTextContent(
      'Suite vue mer',
    );
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
  });

  it('ferme la modale avec le bouton Annuler sans rien changer', async () => {
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByText('Disponible');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(overlay()).toBeNull();
    expect(mocks.updateReservationStatut).not.toHaveBeenCalled();
    expect(mocks.addClientNotification).not.toHaveBeenCalled();
  });

  it('ferme la modale en cliquant sur le fond mais pas sur son contenu', async () => {
    const user = userEvent.setup();
    renderReservations();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Vérifier' }));
    await screen.findByText('Disponible');

    fireEvent.click(document.querySelector('.verify-modal')!);
    expect(overlay()).not.toBeNull();

    fireEvent.click(overlay()!);
    expect(overlay()).toBeNull();
    expect(mocks.updateReservationStatut).not.toHaveBeenCalled();
  });

  it('pagine au-delà de huit réservations', async () => {
    mocks.getReservations.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) =>
        makeReservation({ id: `res-${i + 1}`, roomTitle: `Chambre ${i + 1}` }),
      ),
    );
    const user = userEvent.setup();
    renderReservations();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Chambre 1')).toBeInTheDocument();
    expect(screen.getByText('Chambre 8')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 9')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '→' }));

    expect(screen.getByText('Chambre 9')).toBeInTheDocument();
    expect(screen.getByText('Chambre 10')).toBeInTheDocument();
    expect(screen.queryByText('Chambre 1')).not.toBeInTheDocument();
  });
});
