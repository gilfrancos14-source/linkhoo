import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import gerantsRouter from './gerants';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from '../utils/realtime';
import {
  buildTestApp,
  clerkBearer,
  defaultVerifyToken,
  fakeChain,
  supabaseStorage,
  useSupabaseTables,
  type FakeChain,
} from '../testHelpers/supertestApp';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
  createClerkClient: vi.fn(),
}));

// P1 #8 : publication Realtime neutralisée, assertion via le spy.
vi.mock('../utils/realtime', () => ({
  publishNotificationChanged: vi.fn(async () => {}),
}));

const app = buildTestApp('/api/gerants', gerantsRouter, {
  middlewares: [requireClerkAuth],
});

const validGerant = {
  clerk_user_id: 'user_1',
  email: 'gerant@example.ci',
  nom: 'Koné',
  prenom: 'Aya',
  market: 'CI',
};

const validDoc = {
  document_type: 'id_card_front',
  file_url: 'https://storage.test/verification-docs/front.webp',
  file_path: 'verification-docs/front.webp',
  original_filename: 'recto.png',
  mime_type: 'image/png',
  file_size: 12345,
};

let gerants: FakeChain | FakeChain[];
let clients: FakeChain;
let documents: FakeChain;
let notifications: FakeChain;

type TableName = 'gerants' | 'clients' | 'verification_documents' | 'notifications';

function stubTables(tables: Partial<Record<TableName, FakeChain | FakeChain[]>>): void {
  useSupabaseTables(supabaseAdmin.from, {
    gerants,
    clients,
    verification_documents: documents,
    notifications,
    ...tables,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockImplementation(defaultVerifyToken);
  gerants = fakeChain({ data: null, error: null });
  clients = fakeChain({ data: null, error: null });
  documents = fakeChain({ data: null, error: null });
  notifications = fakeChain({ data: null, error: null });
  stubTables({});
});

describe('POST /api/gerants', () => {
  it('401 sans token', async () => {
    const res = await request(app).post('/api/gerants').send(validGerant);
    expect(res.status).toBe(401);
  });

  it('400 sur un corps invalide', async () => {
    const res = await request(app)
      .post('/api/gerants')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validGerant, market: 'XX' });
    expect(res.status).toBe(400);
  });

  it('403 si le profil cible nest pas celui de lutilisateur connecté', async () => {
    const res = await request(app)
      .post('/api/gerants')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validGerant, clerk_user_id: 'user_2' });
    expect(res.status).toBe(403);
  });

  it('409 si le compte existe déjà comme client', async () => {
    clients = fakeChain({ data: { id: 'c1' }, error: null });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants')
      .set('Authorization', clerkBearer('user_1'))
      .send(validGerant);
    expect(res.status).toBe(409);
    expect(res.body.role).toBe('client');
  });

  it('409 si le profil gérant existe déjà', async () => {
    const existingGerant = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables({ gerants: [existingGerant, fakeChain({ data: { id: 'g2' }, error: null })] });

    const res = await request(app)
      .post('/api/gerants')
      .set('Authorization', clerkBearer('user_1'))
      .send(validGerant);
    expect(res.status).toBe(409);
    expect(res.body.role).toBe('gerant');
  });

  it('201 : crée le profil gérant', async () => {
    const created = fakeChain({ data: { id: 'g1', ...validGerant }, error: null });
    stubTables({ gerants: [fakeChain({ data: null, error: null }), created] });

    const res = await request(app)
      .post('/api/gerants')
      .set('Authorization', clerkBearer('user_1'))
      .send(validGerant);

    expect(res.status).toBe(201);
    expect(created.insert).toHaveBeenCalledWith(validGerant);
  });
});

describe('GET /api/gerants/me', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/gerants/me');
    expect(res.status).toBe(401);
  });

  it('403 pour un compte qui nest pas gérant', async () => {
    const res = await request(app)
      .get('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('200 pour un profil gérant existant', async () => {
    gerants = fakeChain({ data: { id: 'g1', clerk_user_id: 'user_1' }, error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('g1');
  });
});

describe('PATCH /api/gerants/me', () => {
  it('400 sur un corps vide', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables({});

    const res = await request(app)
      .patch('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 sur un champ inconnu (strict)', async () => {
    gerants = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables({});

    const res = await request(app)
      .patch('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ is_verified: true });
    expect(res.status).toBe(400);
  });

  it('404 si le profil disparaît entre les deux lectures', async () => {
    const profileCheck = fakeChain({ data: { id: 'g1' }, error: null });
    stubTables({ gerants: [profileCheck, fakeChain({ data: null, error: null })] });

    const res = await request(app)
      .patch('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ nom: 'Nouveau' });
    expect(res.status).toBe(404);
  });

  it('200 : met à jour le profil', async () => {
    const profileCheck = fakeChain({ data: { id: 'g1' }, error: null });
    const existing = fakeChain({ data: { id: 'g1' }, error: null });
    const updated = fakeChain({ data: { id: 'g1', nom: 'Nouveau' }, error: null });
    stubTables({ gerants: [profileCheck, existing, updated] });

    const res = await request(app)
      .patch('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({ nom: 'Nouveau' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ nom: 'Nouveau' }),
    );
  });

  it('200 : enregistre les coordonnées de la vérification', async () => {
    const profileCheck = fakeChain({ data: { id: 'g1' }, error: null });
    const existing = fakeChain({ data: { id: 'g1' }, error: null });
    const updated = fakeChain({
      data: { id: 'g1', address: 'Cocody Angré, Abidjan' },
      error: null,
    });
    stubTables({ gerants: [profileCheck, existing, updated] });

    const res = await request(app)
      .patch('/api/gerants/me')
      .set('Authorization', clerkBearer('user_1'))
      .send({
        nom: 'Kouassi',
        prenom: 'Awa',
        phone: '+2250700000000',
        address: 'Cocody Angré, Abidjan',
      });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Kouassi',
        prenom: 'Awa',
        phone: '+2250700000000',
        address: 'Cocody Angré, Abidjan',
      }),
    );
  });
});

describe('POST /api/gerants/:id/documents', () => {
  it('400 sur un identifiant vide', async () => {
    const res = await request(app)
      .post('/api/gerants/%20/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send(validDoc);
    expect(res.status).toBe(400);
  });

  it('403 si le dossier appartient à un autre gérant', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'autre_user', verification_status: 'none' },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send(validDoc);
    expect(res.status).toBe(403);
  });

  it('400 pendant une révision en cours', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'under_review' },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send(validDoc);
    expect(res.status).toBe(400);
  });

  it('400 si un champ obligatoire manque', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send({ document_type: 'id_card_front' });
    expect(res.status).toBe(400);
  });

  it('400 si le type de document est inconnu', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send({ ...validDoc, document_type: 'passeport' });
    expect(res.status).toBe(400);
  });

  it('409 si un document du même type existe déjà', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    const duplicated = fakeChain({ data: { id: 'doc-1' }, error: null });
    stubTables({ verification_documents: [duplicated, fakeChain({ data: null, error: null })] });

    const res = await request(app)
      .post('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send(validDoc);
    expect(res.status).toBe(409);
  });

  it('201 : enregistre le document', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    const createdDoc = fakeChain({ data: { id: 'doc-1', ...validDoc }, error: null });
    stubTables({ verification_documents: [fakeChain({ data: null, error: null }), createdDoc] });

    const res = await request(app)
      .post('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'))
      .send(validDoc);

    expect(res.status).toBe(201);
    expect(createdDoc.insert).toHaveBeenCalledWith(
      expect.objectContaining({ gerant_id: 'g1', document_type: 'id_card_front' }),
    );
  });
});

describe('GET /api/gerants/:id/documents', () => {
  it('403 si le dossier appartient à un autre gérant', async () => {
    gerants = fakeChain({ data: { clerk_user_id: 'autre_user' }, error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('200 : renouvelle les URL signées', async () => {
    gerants = fakeChain({ data: { clerk_user_id: 'user_1' }, error: null });
    documents = fakeChain({
      data: [{ id: 'doc-1', file_path: 'verification-docs/front.webp', file_url: 'ancienne' }],
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/documents')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(supabaseStorage().createSignedUrl).toHaveBeenCalledWith(
      'verification-docs/front.webp',
      3600,
    );
    expect(res.body[0].file_url).toBe('https://storage.test/signed/fichier-test');
  });
});

describe('DELETE /api/gerants/:id/documents/:docId', () => {
  it('404 si le document nexiste pas', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    documents = fakeChain({ data: null, error: null });
    stubTables({});

    const res = await request(app)
      .delete('/api/gerants/g1/documents/doc-1')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(404);
  });

  it('204 : supprime le fichier puis la ligne', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    const foundDoc = fakeChain({
      data: { id: 'doc-1', file_path: 'verification-docs/front.webp' },
      error: null,
    });
    const deleteResult = fakeChain({ data: null, error: null });
    stubTables({ verification_documents: [foundDoc, deleteResult] });

    const res = await request(app)
      .delete('/api/gerants/g1/documents/doc-1')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(204);
    expect(supabaseStorage().remove).toHaveBeenCalledWith(['verification-docs/front.webp']);
    expect(deleteResult.delete).toHaveBeenCalled();
  });
});

describe('PATCH /api/gerants/:id/property-address', () => {
  it('400 si lat est fourni sans lng (refine)', async () => {
    const res = await request(app)
      .patch('/api/gerants/g1/property-address')
      .set('Authorization', clerkBearer('user_1'))
      .send({ maps_url: 'https://www.google.com/maps/place/X/@5.3,4.0,17z', lat: 5.3 });
    expect(res.status).toBe(400);
  });

  it('403 si ladresse concerne un autre gérant', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'autre_user', verification_status: 'none' },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .patch('/api/gerants/g1/property-address')
      .set('Authorization', clerkBearer('user_1'))
      .send({ maps_url: 'https://www.google.com/maps/place/X/@5.3,4.0,17z' });
    expect(res.status).toBe(403);
  });

  it('400 si lURL nest pas un lien Google Maps', async () => {
    gerants = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .patch('/api/gerants/g1/property-address')
      .set('Authorization', clerkBearer('user_1'))
      .send({ maps_url: 'https://exemple.com/ma-maison' });
    expect(res.status).toBe(400);
  });

  it('200 : extrait les coordonnées du lien Google Maps', async () => {
    const fetched = fakeChain({
      data: { clerk_user_id: 'user_1', verification_status: 'none' },
      error: null,
    });
    const updated = fakeChain({
      data: { id: 'g1', property_lat: 5.35, property_lng: 4.01 },
      error: null,
    });
    stubTables({ gerants: [fetched, updated] });

    const res = await request(app)
      .patch('/api/gerants/g1/property-address')
      .set('Authorization', clerkBearer('user_1'))
      .send({ maps_url: 'https://www.google.com/maps/place/Test/@5.35,4.01,17z' });

    expect(res.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith(
      expect.objectContaining({ property_lat: 5.35, property_lng: 4.01 }),
    );
  });
});

describe('POST /api/gerants/:id/submit-verification', () => {
  const readyGerant = {
    clerk_user_id: 'user_1',
    email: 'gerant@example.ci',
    verification_status: 'none',
    market: 'CI',
    property_lat: 5.3,
    property_lng: 4.0,
    property_maps_url: 'https://www.google.com/maps/place/X/@5.3,4.0,17z',
  };

  it('403 si le dossier appartient à un autre gérant', async () => {
    gerants = fakeChain({ data: { clerk_user_id: 'autre_user' }, error: null });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/submit-verification')
      .set('Authorization', clerkBearer('user_1'))
      .send({});
    expect(res.status).toBe(403);
  });

  it('400 sans les deux faces de la pièce didentité', async () => {
    gerants = fakeChain({ data: readyGerant, error: null });
    documents = fakeChain({ data: [{ document_type: 'selfie' }], error: null });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/submit-verification')
      .set('Authorization', clerkBearer('user_1'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 sans adresse Google Maps', async () => {
    gerants = fakeChain({
      data: { ...readyGerant, property_lat: null, property_lng: null, property_maps_url: null },
      error: null,
    });
    documents = fakeChain({
      data: [{ document_type: 'id_card_front' }, { document_type: 'id_card_back' }],
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/submit-verification')
      .set('Authorization', clerkBearer('user_1'))
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 quand une demande de vérification est déjà en cours', async () => {
    gerants = fakeChain({ data: { ...readyGerant, verification_status: 'pending' }, error: null });
    documents = fakeChain({
      data: [{ document_type: 'id_card_front' }, { document_type: 'id_card_back' }],
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/submit-verification')
      .set('Authorization', clerkBearer('user_1'))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Une demande de vérification est déjà en cours');
    expect((gerants as FakeChain).update).not.toHaveBeenCalled();
  });

  it('200 : soumet le dossier sans paiement, le passe en attente et notifie admin', async () => {
    gerants = fakeChain({ data: readyGerant, error: null });
    documents = fakeChain({
      data: [{ document_type: 'id_card_front' }, { document_type: 'id_card_back' }],
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/submit-verification')
      .set('Authorization', clerkBearer('user_1'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, gerant: readyGerant });
    expect(res.body.payment_url).toBeUndefined();
    expect(res.body.transaction_id).toBeUndefined();
    expect((gerants as FakeChain).update).toHaveBeenCalledWith(
      expect.objectContaining({
        verification_status: 'pending',
        verification_rejection_reason: null,
      }),
    );
    expect(notifications.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'verification_submitted',
        gerant_id: 'user_1',
      }),
    );
    expect(publishNotificationChanged).toHaveBeenCalledWith('admin', 'gerant');
  });

  it('200 : na besoin ni demail ni de paiement pour soumettre', async () => {
    gerants = fakeChain({ data: { ...readyGerant, email: null }, error: null });
    documents = fakeChain({
      data: [{ document_type: 'id_card_front' }, { document_type: 'id_card_back' }],
      error: null,
    });
    stubTables({});

    const res = await request(app)
      .post('/api/gerants/g1/submit-verification')
      .set('Authorization', clerkBearer('user_1'))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/gerants/:id/verification-status', () => {
  it('403 si le dossier appartient à un autre gérant', async () => {
    gerants = fakeChain({ data: { clerk_user_id: 'autre_user' }, error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/verification-status')
      .set('Authorization', clerkBearer('user_1'));
    expect(res.status).toBe(403);
  });

  it('400 quand lidentifiant du dossier dépasse la longueur maximale', async () => {
    const res = await request(app)
      .get(`/api/gerants/${'x'.repeat(201)}/verification-status`)
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Identifiant invalide');
  });

  it('404 quand le gérant nexiste pas', async () => {
    gerants = [fakeChain({ data: null, error: null })];
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/verification-status')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Gérant introuvable');
  });

  it('500 quand la lecture du dossier échoue en base', async () => {
    gerants = [fakeChain({ data: null, error: { message: 'connexion perdue' } })];
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/verification-status')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur interne du serveur');
  });

  it('500 quand la lecture des documents échoue en base', async () => {
    gerants = [fakeChain({ data: { clerk_user_id: 'user_1', verification_status: 'none' }, error: null })];
    documents = fakeChain({ data: null, error: { message: 'connexion perdue' } });
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/verification-status')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Erreur interne du serveur');
  });

  it('200 : renvoie létat de la demande et les documents', async () => {
    gerants = fakeChain({
      data: {
        clerk_user_id: 'user_1',
        verification_status: 'rejected',
        verification_rejection_reason: 'Photo illisible',
        verification_submitted_at: '2026-01-01T00:00:00Z',
        verification_reviewed_at: '2026-01-02T00:00:00Z',
        property_maps_url: null,
        property_lat: null,
        property_lng: null,
      },
      error: null,
    });
    documents = fakeChain({ data: [{ id: 'doc-1', document_type: 'id_card_front' }], error: null });
    stubTables({});

    const res = await request(app)
      .get('/api/gerants/g1/verification-status')
      .set('Authorization', clerkBearer('user_1'));

    expect(res.status).toBe(200);
    expect(res.body.verification_status).toBe('rejected');
    expect(res.body.documents).toHaveLength(1);
  });
});
