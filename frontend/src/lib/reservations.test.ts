import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addReservation,
  cancelMyReservation,
  checkDateConflict,
  getMyReservations,
  getReservations,
  statutColors,
  statutLabels,
  updateReservationStatut,
} from './reservations';
import type { ClientMineReservationData, ReservationData } from '../lib/api';

const mocks = vi.hoisted(() => ({
  list: vi.fn<() => Promise<unknown[]>>(),
  create: vi.fn<(data: unknown) => Promise<unknown>>(),
  listMine: vi.fn<() => Promise<unknown[]>>(),
  cancelMine: vi.fn<(id: string) => Promise<unknown>>(),
  updateStatut: vi.fn<(id: string, statut: string) => Promise<unknown>>(),
  checkConflict: vi.fn<(roomId: string, dateDebut: string, dateFin: string, excludeId?: string) => Promise<{ hasConflict: boolean }>>(),
}));

vi.mock('../lib/api', () => ({
  apiReservations: {
    list: mocks.list,
    create: mocks.create,
    listMine: mocks.listMine,
    cancelMine: mocks.cancelMine,
    updateStatut: mocks.updateStatut,
    checkConflict: mocks.checkConflict,
  },
}));

function apiReservation(overrides: Partial<ReservationData> = {}): ReservationData {
  return {
    id: 'res-1',
    client_name: 'Aya Koffi',
    client_email: 'aya@mail.ci',
    client_phone: '+225 01 02 03 04',
    room_id: 'room-1',
    room_title: 'Suite vue mer',
    date_debut: '2030-06-01',
    date_fin: '2030-06-05',
    duree_nombre: 4,
    duree_unite: 'nuit',
    montant: 120000,
    statut: 'confirmee',
    created_at: '2030-05-01T10:00:00Z',
    responded_at: '2030-05-02T10:00:00Z',
    gerant_phone: '+225 07 08 09 10',
    gerant_nom: 'Koné',
    gerant_prenom: 'Bakary',
    gerant_is_verified: true,
    gerant_is_premium: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

describe('libellés et couleurs de statut', () => {
  it('expose les trois statuts', () => {
    expect(Object.keys(statutLabels).sort()).toEqual(['annulee', 'confirmee', 'en_attente']);
    expect(Object.keys(statutColors).sort()).toEqual(['annulee', 'confirmee', 'en_attente']);
  });

  it('associe chaque statut à son libellé français', () => {
    expect(statutLabels.en_attente).toBe('En attente');
    expect(statutLabels.confirmee).toBe('Confirmée');
    expect(statutLabels.annulee).toBe('Annulée');
  });

  it('associe chaque statut à une couleur CSS distincte', () => {
    const colors = Object.values(statutColors);
    expect(new Set(colors).size).toBe(3);
    expect(statutColors.confirmee).toBe('#22c55e');
    expect(statutColors.annulee).toBe('#ef4444');
  });
});

describe('getReservations', () => {
  it('transforme les champs snake_case en camelCase', async () => {
    mocks.list.mockResolvedValue([apiReservation()]);

    const [reservation] = await getReservations();

    expect(reservation).toEqual({
      id: 'res-1',
      clientName: 'Aya Koffi',
      clientEmail: 'aya@mail.ci',
      clientPhone: '+225 01 02 03 04',
      roomId: 'room-1',
      roomTitle: 'Suite vue mer',
      dateDebut: '2030-06-01',
      dateFin: '2030-06-05',
      dureeNombre: 4,
      dureeUnite: 'nuit',
      montant: 120000,
      statut: 'confirmee',
      createdAt: '2030-05-01T10:00:00Z',
      respondedAt: '2030-05-02T10:00:00Z',
      gerantPhone: '+225 07 08 09 10',
      gerantNom: 'Koné',
      gerantPrenom: 'Bakary',
      gerantIsVerified: true,
      gerantIsPremium: true,
    });
  });

  it("applique les valeurs par défaut quand le gérant n'est pas renseigné", async () => {
    mocks.list.mockResolvedValue([
      apiReservation({
        responded_at: null,
        gerant_phone: null,
        gerant_nom: null,
        gerant_prenom: null,
        gerant_is_verified: undefined,
        gerant_is_premium: undefined,
      }),
    ]);

    const [reservation] = await getReservations();

    expect(reservation.respondedAt).toBeUndefined();
    expect(reservation.gerantPhone).toBeUndefined();
    expect(reservation.gerantNom).toBeUndefined();
    expect(reservation.gerantIsVerified).toBe(false);
    expect(reservation.gerantIsPremium).toBe(false);
  });

  it("retombe sur 1 nuit quand les colonnes de durée sont nulles (lignes d'avant la migration)", async () => {
    mocks.list.mockResolvedValue([
      apiReservation({ duree_nombre: null, duree_unite: null }),
    ]);

    const [reservation] = await getReservations();

    expect(reservation.dureeNombre).toBe(1);
    expect(reservation.dureeUnite).toBe('nuit');
  });

  it('renvoie un tableau vide quand il n’y a aucune réservation', async () => {
    mocks.list.mockResolvedValue([]);

    await expect(getReservations()).resolves.toEqual([]);
  });

  it('propage une erreur de l’API', async () => {
    mocks.list.mockRejectedValue(new Error('Réseau indisponible'));

    await expect(getReservations()).rejects.toThrow('Réseau indisponible');
  });
});

describe('addReservation', () => {
  it('envoie le payload en snake_case et transforme la réponse', async () => {
    mocks.create.mockResolvedValue(apiReservation({ id: 'res-new' }));

    const created = await addReservation({
      clientName: 'Aya Koffi',
      clientEmail: 'aya@mail.ci',
      clientPhone: '+225 01 02 03 04',
      roomId: 'room-1',
      roomTitle: 'Suite vue mer',
      dateDebut: '2030-06-01',
      dateFin: '2030-06-05',
      dureeNombre: 4,
      dureeUnite: 'nuit',
      montant: 120000,
    });

    expect(mocks.create).toHaveBeenCalledWith({
      client_name: 'Aya Koffi',
      client_email: 'aya@mail.ci',
      client_phone: '+225 01 02 03 04',
      room_id: 'room-1',
      room_title: 'Suite vue mer',
      date_debut: '2030-06-01',
      date_fin: '2030-06-05',
      duree_nombre: 4,
      duree_unite: 'nuit',
      montant: 120000,
    });
    expect(created.id).toBe('res-new');
    expect(created.clientName).toBe('Aya Koffi');
    expect(created.statut).toBe('confirmee');
  });
});

describe('appels délégués à apiReservations', () => {
  it('getMyReservations délègue à listMine', async () => {
    const mine: ClientMineReservationData[] = [
      {
        id: 'res-9',
        room_id: 'room-2',
        room_title: 'Chambre standard',
        date_debut: '2030-07-01',
        date_fin: '2030-07-03',
        duree_nombre: 2,
        duree_unite: 'nuit',
        statut: 'en_attente',
        created_at: '2030-06-01T08:00:00Z',
        montant: 45000,
        responded_at: null,
      },
    ];
    mocks.listMine.mockResolvedValue(mine);

    await expect(getMyReservations()).resolves.toEqual(mine);
    expect(mocks.listMine).toHaveBeenCalledTimes(1);
  });

  it('cancelMyReservation délègue l’identifiant', async () => {
    mocks.cancelMine.mockResolvedValue(undefined);

    await cancelMyReservation('res-42');

    expect(mocks.cancelMine).toHaveBeenCalledWith('res-42');
  });

  it('updateReservationStatut délègue l’identifiant et le statut', async () => {
    mocks.updateStatut.mockResolvedValue(undefined);

    await updateReservationStatut('res-42', 'annulee');

    expect(mocks.updateStatut).toHaveBeenCalledWith('res-42', 'annulee');
  });

  it('checkDateConflict sans excludeId', async () => {
    mocks.checkConflict.mockResolvedValue({ hasConflict: true });

    await expect(checkDateConflict('room-1', '2030-06-01', '2030-06-05')).resolves.toEqual({
      hasConflict: true,
    });
    expect(mocks.checkConflict).toHaveBeenCalledWith('room-1', '2030-06-01', '2030-06-05', undefined);
  });

  it('checkDateConflict avec excludeId', async () => {
    mocks.checkConflict.mockResolvedValue({ hasConflict: false });

    await expect(
      checkDateConflict('room-1', '2030-06-01', '2030-06-05', 'res-1'),
    ).resolves.toEqual({ hasConflict: false });
    expect(mocks.checkConflict).toHaveBeenCalledWith('room-1', '2030-06-01', '2030-06-05', 'res-1');
  });
});
