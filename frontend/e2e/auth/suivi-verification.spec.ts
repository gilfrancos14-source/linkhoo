import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures';

/**
 * Suivi de vérification, gérant connecté.
 *
 * Vérifie de bout en bout que la page ne rend plus de données fictives :
 * le statut, les dates et les documents affichés viennent des réponses
 * `GET /gerants/me` et `GET /gerants/:id/verification-status`.
 */

async function signIn(page: Page, role: 'client' | 'gerant'): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('e2e:auth', JSON.stringify({ signedIn: true, role: value }));
  }, role);
}

const SUBMITTED_AT = '2026-10-20T10:24:00.000Z';
const REVIEWED_AT = '2026-10-21T09:05:00.000Z';

const gerant = {
  id: 'gerant-1',
  email: 'awa@ilehya.ci',
  nom: 'Kouassi',
  prenom: 'Awa',
  verification_status: 'under_review',
  verification_submitted_at: SUBMITTED_AT,
  verification_reviewed_at: null,
  is_verified: false,
  is_premium: false,
};

function makeVerification(overrides: Record<string, unknown> = {}) {
  return {
    verification_status: 'under_review',
    verification_rejection_reason: null,
    verification_submitted_at: SUBMITTED_AT,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    documents: [
      { id: 'doc-1', document_type: 'national_id', status: 'pending', rejection_reason: null, created_at: SUBMITTED_AT },
      { id: 'doc-2', document_type: 'proof_of_address', status: 'pending', rejection_reason: null, created_at: SUBMITTED_AT },
      { id: 'doc-3', document_type: 'selfie', status: 'pending', rejection_reason: null, created_at: SUBMITTED_AT },
    ],
    ...overrides,
  };
}

test.describe('suivi de vérification — gérant connecté', () => {
  test('affiche le dossier en cours d’examen renvoyé par l’API', async ({ page }) => {
    await signIn(page, 'gerant');
    await mockApi(page, { role: 'gerant', gerant, verification: makeVerification() });

    await page.goto('/ci/gerant/verification/suivi');

    await expect(
      page.getByRole('heading', { name: "Votre dossier est en cours d'examen" }),
    ).toBeVisible();

    // Identité et complétude réelles, plus « Koffi Mensah » / « 3 / 3 » fictifs.
    await expect(page.getByText('Awa Kouassi').first()).toBeVisible();
    await expect(page.getByText('awa@ilehya.ci')).toBeVisible();
    await expect(page.getByText('3 / 3')).toBeVisible();

    // Date de soumission issue de la base (fuseau Africa/Abidjan = UTC).
    await expect(page.getByText('20 oct. 2026 • 10:24').first()).toBeVisible();

    // L'étape d'examen est celle en cours.
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  });

  test('affiche le motif de refus et le lien de correction', async ({ page }) => {
    await signIn(page, 'gerant');
    await mockApi(page, {
      role: 'gerant',
      gerant: { ...gerant, verification_status: 'rejected' },
      verification: makeVerification({
        verification_status: 'rejected',
        verification_rejection_reason: 'La photo de vous est floue.',
        verification_reviewed_at: REVIEWED_AT,
        documents: [
          { id: 'doc-1', document_type: 'national_id', status: 'approved', rejection_reason: null, created_at: SUBMITTED_AT },
          { id: 'doc-2', document_type: 'proof_of_address', status: 'approved', rejection_reason: null, created_at: SUBMITTED_AT },
          { id: 'doc-3', document_type: 'selfie', status: 'rejected', rejection_reason: 'Document illisible.', created_at: SUBMITTED_AT },
        ],
      }),
    });

    await page.goto('/ci/gerant/verification/suivi');

    await expect(page.getByRole('heading', { name: 'Votre dossier a été refusé' })).toBeVisible();
    await expect(page.getByText('La photo de vous est floue.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Corriger mon dossier' })).toHaveAttribute(
      'href',
      '/ci/gerant/verification',
    );
    await expect(page.getByText('21 oct. 2026 • 09:05').first()).toBeVisible();
  });
});
